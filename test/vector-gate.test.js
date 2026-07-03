// @ts-check
/**
 * The gate must hold in front of a REAL similarity search: no matter how highly
 * the vector store ranks a confidential memory, an uncleared viewer never
 * receives it. Uses the local deterministic embedder so the test is hermetic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNIVERSAL, groups } from '../src/audience.js';
import { check } from '../src/engine.js';
import { embedLocal, cosine, VectorStore } from '../src/vector.js';

const clock = new Date('2026-07-02T09:00:00Z');
const graph = {
  epoch: clock,
  sources: {
    'SRC-BLOG': { id: 'SRC-BLOG', name: 'Harvest blog', level: 0, base: UNIVERSAL(), revoked: false, unlockDays: 0 },
    'SRC-DECK': { id: 'SRC-DECK', name: 'Q3 board deck', level: 2, base: groups('board'), revoked: false, unlockDays: 0 },
  },
  derived: {},
};
const TEXT = {
  'SRC-BLOG': 'Harvest blog: record wheat yields this autumn, open farm day next month.',
  'SRC-DECK': 'Q3 board deck: harvest budget decision approved at 2.4 million pounds, dividend held.',
};

function buildStore() {
  const s = new VectorStore();
  for (const id of Object.keys(TEXT)) s.add(id, embedLocal(TEXT[id]), { id });
  return s;
}

test('embeddings are unit vectors and self-similarity is ~1', () => {
  const v = embedLocal(TEXT['SRC-DECK']);
  assert.ok(Math.abs(cosine(v, v) - 1) < 1e-9);
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9);
});

test('similarity search surfaces the confidential deck for a budget query', () => {
  const store = buildStore();
  const hits = store.search(embedLocal('what was the harvest budget decision?'), 2);
  // The board deck should rank at or near the top — i.e. it IS relevant, which
  // is exactly why enforcement (not relevance) must decide visibility.
  assert.equal(hits[0].id, 'SRC-DECK');
  assert.ok(hits[0].score > hits[1].score);
});

test('the gate blocks the top-ranked confidential hit for an uncleared viewer', () => {
  const store = buildStore();
  const hits = store.search(embedLocal('harvest budget decision'), 2);
  const carol = { id: 'carol', name: 'Carol', role: 'Contractor', groups: new Set() };
  const alice = { id: 'alice', name: 'Alice', role: 'Board', groups: new Set(['board']) };

  const carolAllowed = hits.filter((h) => check(graph, h.id, carol, clock).decision === 'GRANT').map((h) => h.id);
  const aliceAllowed = hits.filter((h) => check(graph, h.id, alice, clock).decision === 'GRANT').map((h) => h.id);

  assert.deepEqual(carolAllowed, ['SRC-BLOG']);       // confidential deck dropped despite ranking #1
  assert.ok(aliceAllowed.includes('SRC-DECK'));        // board member gets it
});

test('invariant: gated results never contain a node the viewer cannot read', () => {
  const store = buildStore();
  const carol = { id: 'carol', name: 'Carol', role: 'Contractor', groups: new Set() };
  const hits = store.search(embedLocal('budget harvest dividend'), 5);
  for (const h of hits) {
    const passed = check(graph, h.id, carol, clock).decision === 'GRANT';
    if (passed) assert.equal(graph.sources[h.id].base.universal, true, `${h.id} passed the gate but is not public`);
  }
});
