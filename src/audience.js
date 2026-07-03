// @ts-check
/**
 * audience.js — the access algebra.
 *
 * An {@link Audience} answers one question: "who may read this?"
 * It is deliberately tiny and deterministic. There is no LLM anywhere on this
 * path — permission is *computed*, never inferred.
 *
 *   universal:true   → everyone (a public source imposes no constraint)
 *   groups:{a,b}     → members of group a OR group b
 *   groups:{}        → nobody (∅) — a revoked or time-locked source
 *
 * @typedef {{ universal: boolean, groups: Set<string> }} Audience
 * @typedef {{ id: string, name: string, role: string, groups: Set<string> }} Persona
 */

/** Everyone. @returns {Audience} */
export const UNIVERSAL = () => ({ universal: true, groups: new Set() });

/** Members of any of the given groups. @param {...string} g @returns {Audience} */
export const groups = (...g) => ({ universal: false, groups: new Set(g) });

/** Nobody. @returns {Audience} */
export const NONE = () => ({ universal: false, groups: new Set() });

/** Deep copy so callers can never mutate a source's base audience. @param {Audience} a @returns {Audience} */
export const clone = (a) => ({ universal: a.universal, groups: new Set(a.groups) });

/**
 * Intersect two audiences — the audience allowed by BOTH.
 * This is the heart of lineage governance: a derivative's audience is the
 * intersection of its sources, so it can never be more permissive than its
 * most restrictive parent.
 * @param {Audience} a
 * @param {Audience} b
 * @returns {Audience}
 */
export function intersect(a, b) {
  if (a.universal && b.universal) return UNIVERSAL();
  if (a.universal) return { universal: false, groups: new Set(b.groups) };
  if (b.universal) return { universal: false, groups: new Set(a.groups) };
  const out = new Set();
  for (const x of a.groups) if (b.groups.has(x)) out.add(x);
  return { universal: false, groups: out };
}

/** Union of two audiences — used by the inference guard, never by enforcement. @param {Audience} a @param {Audience} b @returns {Audience} */
export function union(a, b) {
  if (a.universal || b.universal) return UNIVERSAL();
  return { universal: false, groups: new Set([...a.groups, ...b.groups]) };
}

/**
 * Deterministic membership test. THIS is the enforcement primitive.
 * @param {Audience} aud
 * @param {Persona} persona
 * @returns {boolean}
 */
export function personaAllowed(aud, persona) {
  if (aud.universal) return true;
  for (const g of persona.groups) if (aud.groups.has(g)) return true;
  return false;
}

/** Human-readable form for logs and UI. @param {Audience} aud @returns {string} */
export function audienceToString(aud) {
  if (aud.universal) return 'everyone';
  if (aud.groups.size === 0) return '∅ nobody';
  return '{' + [...aud.groups].join(', ') + '}';
}
