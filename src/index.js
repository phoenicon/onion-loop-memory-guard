// @ts-check
/**
 * Onion Loop Memory Guard — public API.
 *
 * A deterministic, permission-aware memory layer for AI agents. Access is
 * enforced at the retrieval layer (no LLM on the decision path), derived
 * memories inherit their sources' permissions by lineage, and every decision is
 * written to a tamper-evident, HCS-anchored audit ledger.
 *
 * @example
 *   import { freshScenario, check, createLedger, record } from 'onion-loop-memory-guard';
 *   const { graph, personas } = freshScenario();
 *   const ledger = createLedger();
 *   const r = check(graph, 'MEM-04', personas.carol, graph.epoch);
 *   record(ledger, { clock: graph.epoch, principal: 'Carol', object: 'MEM-04', ...r });
 *   // r.decision === 'DENY'  (SRC-04 is time-locked → ∅)
 */

export * from './audience.js';
export * from './engine.js';
export * from './audit.js';
export * from './inference.js';
export * from './scenario.js';
