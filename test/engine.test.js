// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshScenario } from '../src/scenario.js';
import { resolve, canRead, check, requirementString } from '../src/engine.js';

test('decision matrix at epoch matches the specified access model', () => {
  const { graph, personas, epoch } = freshScenario();
  const expect = {
    MEM_01: { Alice: 'GRANT', Dana: 'GRANT', Bob: 'DENY', Carol: 'DENY' }, // board ∧ everyone
    MEM_02: { Alice: 'GRANT', Dana: 'GRANT', Bob: 'GRANT', Carol: 'GRANT' }, // everyone
    MEM_03: { Alice: 'DENY', Dana: 'GRANT', Bob: 'DENY', Carol: 'DENY' }, // board ∧ engineering
    MEM_04: { Alice: 'DENY', Dana: 'DENY', Bob: 'DENY', Carol: 'DENY' }, // time-locked
  };
  for (const [mem, row] of Object.entries(expect)) {
    const id = mem.replace('_', '-');
    for (const [name, want] of Object.entries(row)) {
      const persona = Object.values(personas).find((p) => p.name === name);
      assert.equal(check(graph, id, persona, epoch).decision, want, `${id} / ${name}`);
    }
  }
});

test('a derivative requires EVERY source in its lineage (high-water-mark)', () => {
  const { graph, personas, epoch } = freshScenario();
  // MEM-03 = Q3 board deck (board) + infra runbook (engineering)
  // Only a viewer in BOTH groups may read it.
  assert.equal(check(graph, 'MEM-03', personas.alice, epoch).decision, 'DENY'); // board only
  assert.equal(check(graph, 'MEM-03', personas.bob, epoch).decision, 'DENY');   // engineering only
  assert.equal(check(graph, 'MEM-03', personas.dana, epoch).decision, 'GRANT'); // both
});

test('resolve reports the composite requirement string', () => {
  const { graph, epoch } = freshScenario();
  assert.equal(requirementString(resolve(graph, 'MEM-03', epoch)), 'board ∧ engineering');
  assert.equal(requirementString(resolve(graph, 'MEM-02', epoch)), 'everyone');
});

test('access is derived from sources, never stored on the derivative', () => {
  const { graph } = freshScenario();
  // Structural guarantee: derived memories carry only lineage, no audience field.
  for (const d of Object.values(graph.derived)) {
    assert.ok(Array.isArray(d.from), 'has lineage');
    assert.equal('base' in d, false, 'derivative must not carry its own ACL');
    assert.equal('audience' in d, false, 'derivative must not carry its own ACL');
  }
});

test('decisions are deterministic — same inputs, same output, repeatedly', () => {
  const { graph, personas, epoch } = freshScenario();
  const first = Object.keys(graph.derived).map((id) => check(graph, id, personas.dana, epoch).decision);
  for (let i = 0; i < 100; i++) {
    const again = Object.keys(graph.derived).map((id) => check(graph, id, personas.dana, epoch).decision);
    assert.deepEqual(again, first);
  }
});
