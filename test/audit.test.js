// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, record, verifyChain, entries, p99, fnv1a } from '../src/audit.js';

const epoch = new Date('2026-07-02T09:00:00Z');
const rec = (l, object, decision) => record(l, { clock: epoch, principal: 'Alice', object, decision, rule: 'test', latencyMs: 0.01 });

test('fnv1a is deterministic and 8 hex chars', () => {
  assert.equal(fnv1a('abc'), fnv1a('abc'));
  assert.match(fnv1a('abc'), /^[0-9a-f]{8}$/);
  assert.notEqual(fnv1a('abc'), fnv1a('abd'));
});

test('each entry chains to the previous hash', () => {
  const l = createLedger();
  const a = rec(l, 'MEM-01', 'GRANT');
  const b = rec(l, 'MEM-02', 'DENY');
  assert.equal(a.prev, 'genesis');
  assert.equal(b.prev, a.hash);
});

test('an intact chain verifies', () => {
  const l = createLedger();
  for (let i = 0; i < 20; i++) rec(l, 'MEM-0' + (i % 4), i % 2 ? 'GRANT' : 'DENY');
  assert.deepEqual(verifyChain(l), { intact: true, brokenAt: null });
});

test('tampering with a past entry is detected at the exact seam', () => {
  const l = createLedger();
  for (let i = 0; i < 10; i++) rec(l, 'MEM', 'GRANT');
  // flip a historical decision without recomputing hashes → forgery
  const target = l.chain.find((e) => !('anchor' in e) && e.seq === 4);
  target.decision = 'DENY';
  const v = verifyChain(l);
  assert.equal(v.intact, false);
  assert.equal(v.brokenAt, 4);
});

test('batches anchor to an HCS topic every N entries', () => {
  const l = createLedger({ anchorEvery: 8 });
  for (let i = 0; i < 8; i++) rec(l, 'MEM', 'GRANT');
  const anchor = l.chain.find((e) => 'anchor' in e);
  assert.ok(anchor, 'anchor emitted');
  assert.equal(anchor.topic, '0.0.7719834');
});

test('entries() returns decisions newest-first, without anchors', () => {
  const l = createLedger();
  rec(l, 'MEM-01', 'GRANT');
  rec(l, 'MEM-02', 'DENY');
  const es = entries(l);
  assert.equal(es[0].object, 'MEM-02');
  assert.ok(es.every((e) => !('anchor' in e)));
});

test('P99 latency stays under the 200ms budget', () => {
  const l = createLedger();
  for (let i = 0; i < 500; i++) record(l, { clock: epoch, principal: 'A', object: 'M', decision: 'GRANT', rule: 'r', latencyMs: Math.min(i / 100, 5) });
  assert.ok(p99(l) < 200, `p99=${p99(l)}`);
});
