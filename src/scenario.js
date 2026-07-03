// @ts-check
/**
 * scenario.js — the canonical demo world.
 *
 * ONE scenario factory, imported by the browser console, the test suite and the
 * benchmark, so all three reason about the exact same graph. Sets can't live in
 * JSON, so this is a factory rather than a data file. A frozen JSON projection
 * (for judges who just want to read the ACLs) is emitted to /scenarios.
 *
 * @typedef {import('./engine.js').Graph} Graph
 * @typedef {import('./audience.js').Persona} Persona
 */

import { UNIVERSAL, groups } from './audience.js';

/** Fixed epoch so temporal rules are deterministic and reproducible. */
export const EPOCH = new Date('2026-07-02T09:00:00Z');

/** @returns {{ epoch: Date, personas: Record<string, Persona>, graph: Graph, defaultPersona: string }} */
export function freshScenario() {
  /** @type {Record<string, Persona>} */
  const personas = {
    alice: { id: 'alice', name: 'Alice', role: 'Board', groups: new Set(['board']) },
    dana: { id: 'dana', name: 'Dana', role: 'Board+Eng', groups: new Set(['board', 'engineering']) },
    bob: { id: 'bob', name: 'Bob', role: 'Engineering', groups: new Set(['engineering']) },
    carol: { id: 'carol', name: 'Carol', role: 'Contractor', groups: new Set([]) },
  };

  /** @type {Graph} */
  const graph = {
    epoch: EPOCH,
    sources: {
      'SRC-01': { id: 'SRC-01', name: 'Q3 Board Deck', level: 2, base: groups('board'), revoked: false, unlockDays: 0 },
      'SRC-02': { id: 'SRC-02', name: 'Blog: Harvest Report', level: 0, base: UNIVERSAL(), revoked: false, unlockDays: 0 },
      'SRC-03': { id: 'SRC-03', name: 'Infra Runbook', level: 1, base: groups('engineering'), revoked: false, unlockDays: 0 },
      'SRC-04': { id: 'SRC-04', name: 'Leadership Call — Strategy', level: 2, base: groups('board'), revoked: false, unlockDays: 30 },
    },
    derived: {
      'MEM-01': { id: 'MEM-01', name: 'Summary · Q3 performance', kind: 'summary', from: ['SRC-01', 'SRC-02'] },
      'MEM-02': { id: 'MEM-02', name: 'Embedding · harvest blog', kind: 'embedding', from: ['SRC-02'] },
      'MEM-03': { id: 'MEM-03', name: 'Note · infra ↔ board actions', kind: 'note', from: ['SRC-01', 'SRC-03'] },
      'MEM-04': { id: 'MEM-04', name: 'Summary · leadership strategy', kind: 'summary', from: ['SRC-04'] },
    },
  };

  return { epoch: EPOCH, personas, graph, defaultPersona: 'alice' };
}
