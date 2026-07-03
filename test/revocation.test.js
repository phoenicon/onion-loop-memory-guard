// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshScenario } from '../src/scenario.js';
import { check } from '../src/engine.js';

test('revoking a source propagates to every derivative in its lineage — same read', () => {
  const { graph, personas, epoch } = freshScenario();
  // Before: Dana (board+eng) can read MEM-01 (SRC-01,SRC-02) and MEM-03 (SRC-01,SRC-03).
  assert.equal(check(graph, 'MEM-01', personas.dana, epoch).decision, 'GRANT');
  assert.equal(check(graph, 'MEM-03', personas.dana, epoch).decision, 'GRANT');

  // Revoke SRC-01 (Q3 board deck).
  graph.sources['SRC-01'].revoked = true;

  // After: both derivatives that touch SRC-01 collapse to ∅ for EVERYONE, instantly.
  for (const p of Object.values(personas)) {
    assert.equal(check(graph, 'MEM-01', p, epoch).decision, 'DENY', `MEM-01 / ${p.name}`);
    assert.equal(check(graph, 'MEM-03', p, epoch).decision, 'DENY', `MEM-03 / ${p.name}`);
  }
  // A derivative NOT descended from SRC-01 is unaffected.
  assert.equal(check(graph, 'MEM-02', personas.carol, epoch).decision, 'GRANT');
});

test('revocation rule shows in the audit trail', () => {
  const { graph, personas, epoch } = freshScenario();
  graph.sources['SRC-02'].revoked = true;
  const r = check(graph, 'MEM-02', personas.alice, epoch);
  assert.equal(r.decision, 'DENY');
  assert.match(r.rule, /revoked/);
});

test('restoring a source restores derived access (no stale state)', () => {
  const { graph, personas, epoch } = freshScenario();
  graph.sources['SRC-01'].revoked = true;
  assert.equal(check(graph, 'MEM-01', personas.alice, epoch).decision, 'DENY');
  graph.sources['SRC-01'].revoked = false;
  assert.equal(check(graph, 'MEM-01', personas.alice, epoch).decision, 'GRANT');
});
