// @ts-check
/**
 * demo-corpus.js — the small ACL'd corpus used by the vector-search demo, shared
 * by examples/vector-gate.js and the server's /api/search endpoint so both index
 * and gate the exact same documents.
 * @typedef {import('./engine.js').Graph} Graph
 * @typedef {import('./audience.js').Persona} Persona
 */
import { UNIVERSAL, groups } from './audience.js';

export const CLOCK = new Date('2026-07-02T09:00:00Z');

/** @returns {{ graph: Graph, text: Record<string,string>, personas: Record<string, Persona> }} */
export function demoCorpus() {
  /** @type {Graph} */
  const graph = {
    epoch: CLOCK,
    sources: {
      'SRC-BLOG': { id: 'SRC-BLOG', name: 'Harvest blog', level: 0, base: UNIVERSAL(), revoked: false, unlockDays: 0 },
      'SRC-DECK': { id: 'SRC-DECK', name: 'Q3 board deck', level: 2, base: groups('board'), revoked: false, unlockDays: 0 },
      'SRC-RUN': { id: 'SRC-RUN', name: 'Infra runbook', level: 1, base: groups('engineering'), revoked: false, unlockDays: 0 },
      'SRC-LEAD': { id: 'SRC-LEAD', name: 'Leadership call', level: 2, base: groups('board'), revoked: false, unlockDays: 0 },
    },
    derived: {
      'MEM-SUM': { id: 'MEM-SUM', name: 'Summary · Q3 performance', kind: 'summary', from: ['SRC-DECK', 'SRC-BLOG'] },
    },
  };
  const text = {
    'SRC-BLOG': 'Harvest blog: our wheat harvest hit record yields this autumn. Open farm day next month, all welcome.',
    'SRC-DECK': 'Q3 board deck. Harvest budget decision: approved at 2.4 million pounds. Dividend held. Somerset land acquisition on track.',
    'SRC-RUN': 'Infra runbook: rotate the irrigation controller keys, restart the sensor gateway, on-call pager escalation steps.',
    'SRC-LEAD': 'Leadership strategy call. Confidential plan to acquire the neighbouring farm and restructure the debt facility.',
    'MEM-SUM': 'Summary of the quarter: strong harvest performance and the approved harvest budget for the year ahead.',
  };
  const personas = {
    alice: { id: 'alice', name: 'Alice', role: 'Board', groups: new Set(['board']) },
    dana: { id: 'dana', name: 'Dana', role: 'Board+Eng', groups: new Set(['board', 'engineering']) },
    bob: { id: 'bob', name: 'Bob', role: 'Engineering', groups: new Set(['engineering']) },
    carol: { id: 'carol', name: 'Carol', role: 'Contractor', groups: new Set([]) },
  };
  return { graph, text, personas };
}

/** node id → display name across sources and derived. */
export function nodeName(graph, id) {
  return (graph.sources[id] || graph.derived[id] || {}).name || id;
}
