// @ts-check
/**
 * engine.js — deterministic retrieval-layer enforcement.
 *
 * Given a memory graph (ACL'd sources + memories derived from them), this
 * computes — for any viewer, at any clock time — exactly which memories are
 * readable. Access is derived from the *source graph* at read time. It is never
 * copied onto the derivative and never decided by a model.
 *
 * Invariants enforced here (see /test):
 *   1. A derivative is readable iff the viewer may read EVERY source in its
 *      lineage (per-source intersection / high-water-mark).
 *   2. Revoking a source removes every derivative that touches it, in the same
 *      read — no cache to invalidate, nothing stale.
 *   3. A time-locked source contributes ∅ until its unlock instant.
 *
 * @typedef {import('./audience.js').Audience} Audience
 * @typedef {import('./audience.js').Persona} Persona
 * @typedef {{ id:string, name:string, level:0|1|2, base:Audience, revoked:boolean, unlockDays:number }} Source
 * @typedef {{ id:string, name:string, kind:string, from:string[] }} Derived
 * @typedef {{ epoch:Date, sources:Record<string,Source>, derived:Record<string,Derived> }} Graph
 */

import { NONE, clone, personaAllowed } from './audience.js';

export const LEVELS = /** @type {const} */ (['Public', 'Internal', 'Confidential']);

/**
 * Effective audience of a single source at `clock`, accounting for revocation
 * and temporal locks. This is where ACL state and time collapse into one answer.
 * @param {Source} src
 * @param {Date} clock
 * @param {Date} epoch  scenario start; unlocks are measured from here
 * @returns {{ audience: Audience, state: 'open'|'revoked'|'locked', until?: Date }}
 */
export function effectiveAudience(src, clock, epoch) {
  if (src.revoked) return { audience: NONE(), state: 'revoked' };
  if (src.unlockDays > 0) {
    const until = new Date(epoch.getTime() + src.unlockDays * 86_400_000);
    if (clock < until) return { audience: NONE(), state: 'locked', until };
  }
  return { audience: clone(src.base), state: 'open' };
}

/**
 * Walk a node's lineage down to its leaf sources. Sources are their own leaf.
 * @param {Graph} graph
 * @param {string} id
 * @returns {string[]}
 */
export function leaves(graph, id) {
  if (graph.sources[id]) return [id];
  const d = graph.derived[id];
  if (!d) throw new Error(`unknown node: ${id}`);
  return d.from.flatMap((f) => leaves(graph, f));
}

/**
 * @typedef {{ id:string, audience:Audience, state:'open'|'revoked'|'locked', until?:Date, base:Audience, level:number }} Requirement
 * @typedef {{ id:string, leaves:string[], reqs:Requirement[], level:number, locked:boolean, revoked:boolean }} Resolution
 */

/**
 * Resolve the composite access requirement a node carries right now.
 * @param {Graph} graph
 * @param {string} id
 * @param {Date} clock
 * @returns {Resolution}
 */
export function resolve(graph, id, clock) {
  const ls = leaves(graph, id);
  /** @type {Requirement[]} */
  const reqs = [];
  let level = 0, locked = false, revoked = false;
  for (const l of ls) {
    const src = graph.sources[l];
    const eff = effectiveAudience(src, clock, graph.epoch);
    level = Math.max(level, src.level);
    if (eff.state === 'revoked') revoked = true;
    if (eff.state === 'locked') locked = true;
    reqs.push({ id: l, audience: eff.audience, state: eff.state, until: eff.until, base: src.base, level: src.level });
  }
  return { id, leaves: ls, reqs, level, locked, revoked };
}

/**
 * THE decision. Deterministic, O(sources): a viewer may read a node iff they
 * may read every source in its lineage. No model call, no I/O.
 * @param {Resolution} resolution
 * @param {Persona} persona
 * @returns {boolean}
 */
export function canRead(resolution, persona) {
  return resolution.reqs.every((req) => personaAllowed(req.audience, persona));
}

/**
 * Human-readable composite requirement (for logs / UI / audit rule strings).
 * @param {Resolution} r
 * @returns {string}
 */
export function requirementString(r) {
  if (r.revoked) return '∅ · source revoked';
  if (r.locked) return '∅ · time-locked';
  const toks = [];
  for (const req of r.reqs) {
    if (req.base.universal) continue; // 'everyone' adds no constraint
    toks.push([...req.base.groups].join(' or '));
  }
  const uniq = [...new Set(toks)];
  return uniq.length === 0 ? 'everyone' : uniq.join(' ∧ ');
}

/**
 * One convenience call: resolve + decide + produce the audit rule, timed.
 * Returns everything the ledger and UI need for a single (viewer, node) check.
 * @param {Graph} graph
 * @param {string} id
 * @param {Persona} persona
 * @param {Date} clock
 * @returns {{ id:string, decision:'GRANT'|'DENY', rule:string, resolution:Resolution, latencyMs:number }}
 */
export function check(graph, id, persona, clock) {
  const t0 = now();
  const resolution = resolve(graph, id, clock);
  const decision = canRead(resolution, persona) ? 'GRANT' : 'DENY';
  const latencyMs = now() - t0;
  let rule;
  if (resolution.revoked) rule = 'lineage: source revoked → ∅';
  else if (resolution.locked) rule = 'temporal: source locked → ∅';
  else rule = `ReBAC ∧ requires ${requirementString(resolution)}`;
  return { id, decision, rule, resolution, latencyMs };
}

/** High-resolution clock that works in Node and the browser. @returns {number} ms */
function now() {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Number(process.hrtime.bigint()) / 1e6;
}
