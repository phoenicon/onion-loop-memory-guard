// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshScenario } from '../src/scenario.js';
import { redactedView, auditLeaks } from '../src/inference.js';

test('denied memories are returned as opaque tombstones — no leakable metadata', () => {
  const { graph, personas, epoch } = freshScenario();
  const view = redactedView(graph, personas.carol, epoch); // contractor: only MEM-02 visible
  const denied = view.filter((v) => !v.visible);
  assert.ok(denied.length >= 1);
  for (const d of denied) {
    assert.equal(d.name, undefined, 'no title leaks');
    assert.equal(d.lineage, undefined, 'no lineage leaks');
    assert.equal(d.requires, undefined, 'no requirement hint leaks');
    assert.deepEqual(Object.keys(d).sort(), ['id', 'visible']);
  }
});

test('a granted view never references a source the viewer cannot read', () => {
  const { graph, personas, epoch } = freshScenario();
  for (const p of Object.values(personas)) {
    const view = redactedView(graph, p, epoch);
    const leak = auditLeaks(graph, p, epoch, view);
    assert.equal(leak.safe, true, `${p.name}: ${JSON.stringify(leak.leaks)}`);
  }
});

test('auditLeaks catches an intentionally leaky view', () => {
  const { graph, personas, epoch } = freshScenario();
  // Forge a bad view: expose the confidential board memory to a contractor.
  const bad = [{ id: 'MEM-01', visible: true, name: 'Summary · Q3 performance', kind: 'summary', lineage: ['SRC-01', 'SRC-02'] }];
  const leak = auditLeaks(graph, personas.carol, epoch, bad);
  assert.equal(leak.safe, false);
  assert.ok(leak.leaks.some((l) => l.leakedSource === 'SRC-01'));
});

test('a tombstone that carries metadata is flagged as a leak', () => {
  const { graph, personas, epoch } = freshScenario();
  const bad = [{ id: 'MEM-04', visible: false, name: 'Summary · leadership strategy' }];
  const leak = auditLeaks(graph, personas.carol, epoch, bad);
  assert.equal(leak.safe, false);
});
