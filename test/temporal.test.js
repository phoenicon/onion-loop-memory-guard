// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshScenario } from '../src/scenario.js';
import { check, effectiveAudience } from '../src/engine.js';

const plusDays = (d, n) => new Date(d.getTime() + n * 86_400_000);

test('a time-locked source contributes ∅ until its unlock instant', () => {
  const { graph, personas, epoch } = freshScenario();
  // SRC-04 unlocks after 30 days. MEM-04 derives solely from it.
  assert.equal(check(graph, 'MEM-04', personas.alice, epoch).decision, 'DENY'); // board member, still locked
  assert.equal(check(graph, 'MEM-04', personas.alice, plusDays(epoch, 29)).decision, 'DENY');
});

test('after unlock, normal ACLs apply', () => {
  const { graph, personas, epoch } = freshScenario();
  const t = plusDays(epoch, 30);
  assert.equal(check(graph, 'MEM-04', personas.alice, t).decision, 'GRANT'); // board → allowed
  assert.equal(check(graph, 'MEM-04', personas.dana, t).decision, 'GRANT');  // board → allowed
  assert.equal(check(graph, 'MEM-04', personas.bob, t).decision, 'DENY');    // engineering only
  assert.equal(check(graph, 'MEM-04', personas.carol, t).decision, 'DENY');  // contractor
});

test('the lock boundary is exact', () => {
  const { graph, epoch } = freshScenario();
  const src = graph.sources['SRC-04'];
  assert.equal(effectiveAudience(src, plusDays(epoch, 30 - 1e-6), epoch).state, 'locked');
  assert.equal(effectiveAudience(src, plusDays(epoch, 30), epoch).state, 'open');
});

test('temporal rule surfaces in the audit trail while locked', () => {
  const { graph, personas, epoch } = freshScenario();
  assert.match(check(graph, 'MEM-04', personas.alice, epoch).rule, /temporal|locked/);
});
