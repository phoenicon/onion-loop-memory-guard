// @ts-check
/**
 * inference.js — bonus challenge: query-time inference prevention.
 *
 * Enforcement (engine.js) already guarantees a viewer never *reads* a memory
 * whose lineage they aren't cleared for. But a naive system can still leak
 * across a permission boundary through METADATA: showing a denied memory's
 * title, its lineage source names, or a "requires {board}" hint tells a
 * contractor that a confidential board artifact exists — inference by side
 * channel.
 *
 * This module does two things:
 *   1. redactedView() — the only object shape that should ever leave the
 *      retrieval layer for a given viewer. Denied nodes are reduced to an opaque
 *      tombstone: no title, no lineage, no requirement text.
 *   2. auditLeaks() — a self-test a regulator can run: scan a proposed view and
 *      assert it references nothing (name, source id, group) the viewer is not
 *      cleared to read. Returns the offending leaks; empty === safe.
 *
 * Scope, stated honestly (the guide says: no overclaiming): this defends the
 * metadata/side-channel vector. It does not attempt to defend against
 * statistical inference over the *content* of legitimately-granted memories —
 * that is a separate, open research problem noted in docs/SECURITY-MODEL.md.
 *
 * @typedef {import('./engine.js').Graph} Graph
 * @typedef {import('./audience.js').Persona} Persona
 */

import { resolve, canRead } from './engine.js';
import { personaAllowed } from './audience.js';

/**
 * Produce the sanitised set of memories safe to hand to `persona` at `clock`.
 * Granted nodes carry full metadata; denied nodes become tombstones.
 * @param {Graph} graph
 * @param {Persona} persona
 * @param {Date} clock
 * @returns {Array<{ id:string, visible:boolean, name?:string, kind?:string, lineage?:string[], requires?:string }>}
 */
export function redactedView(graph, persona, clock) {
  const out = [];
  for (const id of Object.keys(graph.derived)) {
    const r = resolve(graph, id, clock);
    if (canRead(r, persona)) {
      const m = graph.derived[id];
      out.push({ id, visible: true, name: m.name, kind: m.kind, lineage: r.leaves.slice() });
    } else {
      // Tombstone only. No name, no lineage, no requirement — nothing to infer from.
      out.push({ id, visible: false });
    }
  }
  return out;
}

/**
 * Regulator self-test: does `view` leak anything `persona` can't read?
 * Checks every visible item's lineage sources are individually readable.
 * @param {Graph} graph
 * @param {Persona} persona
 * @param {Date} clock
 * @param {ReturnType<typeof redactedView>} view
 * @returns {{ safe:boolean, leaks:Array<{ node:string, leakedSource:string, reason:string }> }}
 */
export function auditLeaks(graph, persona, clock, view) {
  const leaks = [];
  for (const item of view) {
    if (!item.visible) {
      // A tombstone must expose nothing but its id.
      if (item.name || item.lineage || item.requires) {
        leaks.push({ node: item.id, leakedSource: item.id, reason: 'denied node exposed metadata' });
      }
      continue;
    }
    for (const srcId of item.lineage || []) {
      const src = graph.sources[srcId];
      // effective audience at this clock (revoke/lock aware)
      const r = resolve(graph, srcId, clock);
      const aud = r.reqs[0].audience;
      if (!personaAllowed(aud, persona)) {
        leaks.push({ node: item.id, leakedSource: srcId, reason: `viewer not cleared for ${src?.name ?? srcId}` });
      }
    }
  }
  return { safe: leaks.length === 0, leaks };
}

/**
 * Cross-document inference auditor (the "combining permitted docs" case).
 *
 * Metadata redaction (above) stops a *single* denied result from leaking. But
 * the subtler query-time risk is combinatorial: could a viewer RECONSTRUCT a
 * memory they were denied, purely from the union of memories they WERE granted?
 *
 * We answer it concretely: a denied node is "reconstructable" iff every leaf
 * source in its lineage also appears in the combined lineage of the viewer's
 * granted nodes. If so, the viewer holds all the raw inputs and the denial is
 * only skin-deep — an information leak across the permission boundary.
 *
 * In strict lineage enforcement this returns `{ safe: true }` by construction
 * (you can't be denied a node whose sources you can all read), which is exactly
 * the *proof* the architecture is sound. The auditor earns its keep the moment a
 * policy loosens — e.g. a declassified/level-based grant, or a derived-node
 * override — by catching the hole immediately. See test/inference.test.js.
 *
 * Honest scope: this detects reconstruction from *lineage overlap*. It does NOT
 * defend against statistical inference over the *content* of legitimately
 * granted memories — that is a separate open problem (see SECURITY-MODEL.md).
 *
 * It audits the set of memories a pipeline is ABOUT TO RETURN (`grantedIds`),
 * not an idealised recomputation — so it catches a buggy or loosened retriever
 * that over-shares. When `grantedIds` is omitted it defaults to the correct
 * `canRead` set, in which case it returns `safe:true` by construction: the
 * mathematical proof that strict lineage enforcement cannot be reconstructed.
 *
 * @param {Graph} graph
 * @param {Persona} persona
 * @param {Date} clock
 * @param {string[]|null} [grantedIds]  the derived-node ids actually being returned
 * @returns {{ safe:boolean, reconstructable:Array<{ node:string, coveredBy:string[] }> }}
 */
export function reconstructionAudit(graph, persona, clock, grantedIds = null) {
  const allIds = Object.keys(graph.derived);
  const granted = new Set(grantedIds ?? allIds.filter((id) => canRead(resolve(graph, id, clock), persona)));

  // Sources the viewer effectively holds via everything being returned to them.
  const heldSources = new Set();
  const grantedLeaves = {};
  for (const id of granted) {
    const ls = resolve(graph, id, clock).leaves;
    grantedLeaves[id] = new Set(ls);
    for (const s of ls) heldSources.add(s);
  }

  const reconstructable = [];
  for (const id of allIds) {
    if (granted.has(id)) continue;
    // Only worry about nodes this viewer is genuinely NOT cleared for.
    if (canRead(resolve(graph, id, clock), persona)) continue;
    const leaves = resolve(graph, id, clock).leaves;
    if (leaves.every((s) => heldSources.has(s))) {
      const coveredBy = [...granted].filter((g) => leaves.some((s) => grantedLeaves[g].has(s)));
      reconstructable.push({ node: id, coveredBy });
    }
  }
  return { safe: reconstructable.length === 0, reconstructable };
}
