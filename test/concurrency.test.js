// @ts-check
/**
 * Concurrent-update evidence.
 *
 * The bounty asks the layer to "stay synchronized with source ACLs under
 * concurrent updates." The architectural claim we make is precise:
 *
 *   Permissions are never cached on derived memories. Every retrieval recomputes
 *   effective access directly from current source ACLs, so there is no
 *   read-modify-write window in which a stale permission can be served.
 *
 * This suite *demonstrates* that. We interleave ACL mutations (revoke / restore
 * / advance-clock) with retrievals across many async ticks, and for every read
 * we capture an ATOMIC witness — the effective state of each lineage source at
 * the instant of the decision. We then assert the read is consistent with its
 * own witness. A stale read would show GRANT while its witness shows a
 * revoked/locked source; it never does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshScenario } from '../src/scenario.js';
import { resolve, canRead, effectiveAudience } from '../src/engine.js';

/** One synchronous, non-interruptible read that returns the decision AND the
 *  exact source states it was computed from. This atomicity is the whole point. */
function readWithWitness(graph, nodeId, persona, clock) {
  const r = resolve(graph, nodeId, clock);
  const decision = canRead(r, persona);
  const witness = r.leaves.map((s) => ({ id: s, state: effectiveAudience(graph.sources[s], clock, graph.epoch).state }));
  return { decision, witness };
}

const tick = () => new Promise((res) => setImmediate(res));
const rand = (n) => Math.floor(Math.random() * n);

test('reads are never stale while ACLs mutate concurrently (interleaved)', async () => {
  const { graph, personas, epoch } = freshScenario();
  const clock = { now: new Date(epoch) };
  const people = Object.values(personas);
  const srcIds = Object.keys(graph.sources);
  const memIds = Object.keys(graph.derived);

  let reads = 0, mutations = 0;
  let running = true;

  // Mutator: flips revokes and advances the clock between awaits.
  const mutator = (async () => {
    while (running) {
      const s = srcIds[rand(srcIds.length)];
      graph.sources[s].revoked = !graph.sources[s].revoked;
      if (rand(3) === 0) clock.now = new Date(clock.now.getTime() + 15 * 86_400_000);
      mutations++;
      await tick();
    }
  })();

  // Readers: continuously retrieve and self-check against the atomic witness.
  const reader = async () => {
    for (let i = 0; i < 4000; i++) {
      const node = memIds[rand(memIds.length)];
      const persona = people[rand(people.length)];
      const { decision, witness } = readWithWitness(graph, node, persona, clock.now);
      // INVARIANT: a GRANT can never have been computed from a revoked/locked source.
      if (decision) {
        for (const w of witness) {
          assert.equal(w.state, 'open', `stale GRANT on ${node}: source ${w.id} was ${w.state}`);
        }
      }
      reads++;
      if (i % 200 === 0) await tick(); // yield, letting the mutator run mid-flight
    }
  };

  await Promise.all([reader(), reader(), reader()]);
  running = false;
  await mutator;

  assert.ok(reads >= 12000, `expected many reads, got ${reads}`);
  assert.ok(mutations >= 1, `mutator ran ${mutations} times mid-flight`);
});

test('a revoke issued between two reads is reflected on the very next read', async () => {
  const { graph, personas, epoch } = freshScenario();
  // Dana can read MEM-03 (board ∧ eng).
  assert.equal(readWithWitness(graph, 'MEM-03', personas.dana, epoch).decision, true);
  await tick();
  graph.sources['SRC-03'].revoked = true; // concurrent ACL change
  await tick();
  // No stale grant — next read already reflects it.
  assert.equal(readWithWitness(graph, 'MEM-03', personas.dana, epoch).decision, false);
});
