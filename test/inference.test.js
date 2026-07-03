// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshScenario } from '../src/scenario.js';
import { redactedView, auditLeaks, reconstructionAudit } from '../src/inference.js';
import { UNIVERSAL, groups } from '../src/audience.js';

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

// --- cross-document reconstruction (combinatorial inference) ---

test('strict enforcement is provably reconstruction-safe for every persona', () => {
  // With the correct (canRead) returned set, no viewer can reconstruct a denied
  // memory from what they legitimately hold. This is the safety proof.
  const { graph, personas, epoch } = freshScenario();
  for (const p of Object.values(personas)) {
    const r = reconstructionAudit(graph, p, epoch);
    assert.equal(r.safe, true, `${p.name}: ${JSON.stringify(r.reconstructable)}`);
  }
});

test('the auditor CATCHES a pipeline that over-shares across a permission boundary', () => {
  // Threat: a buggy/loosened retriever returns a memory that embeds a confidential
  // source. The viewer now holds that source's content and can reconstruct a
  // second memory they were correctly denied.
  const clock = new Date('2026-07-02T09:00:00Z');
  const graph = {
    epoch: clock,
    sources: {
      PUB: { id: 'PUB', name: 'Public brief', level: 0, base: UNIVERSAL(), revoked: false, unlockDays: 0 },
      SEC: { id: 'SEC', name: 'Confidential board source', level: 2, base: groups('board'), revoked: false, unlockDays: 0 },
    },
    derived: {
      LEAK: { id: 'LEAK', name: 'Over-shared digest', kind: 'summary', from: ['PUB', 'SEC'] }, // contains SEC!
      SECRET: { id: 'SECRET', name: 'Confidential note', kind: 'note', from: ['SEC'] },        // correctly board-only
    },
  };
  const carol = { id: 'carol', name: 'Carol', role: 'Contractor', groups: new Set() };

  // Correct behaviour: neither is granted to Carol → safe.
  assert.equal(reconstructionAudit(graph, carol, clock).safe, true);

  // The bug: the pipeline returns LEAK to Carol anyway. Now she holds SEC's content,
  // so the denied SECRET (from SEC) becomes reconstructable. The auditor fires.
  const bad = reconstructionAudit(graph, carol, clock, ['LEAK']);
  assert.equal(bad.safe, false);
  assert.ok(bad.reconstructable.some((x) => x.node === 'SECRET' && x.coveredBy.includes('LEAK')));
});
