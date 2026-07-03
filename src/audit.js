// @ts-check
/**
 * audit.js — a tamper-evident, hash-chained decision ledger.
 *
 * Every permission decision appends an entry whose hash folds in the previous
 * hash (`hash = fnv1a(prevHash + payload)`). Change any past entry and every
 * subsequent hash breaks — {@link verifyChain} finds the exact seam.
 *
 * Batches are periodically "anchored": in production the batch hash is written
 * to Hedera Consensus Service (HCS) for an independent, immutable timestamp.
 * Here we record the anchor event with a real testnet topic id so the demo and
 * a live deployment share one shape.
 *
 * @typedef {'GRANT'|'DENY'} Decision
 * @typedef {{ seq:number, ts:string, principal:string, object:string, decision:Decision, rule:string, latencyMs:number, prev:string, hash:string }} Entry
 * @typedef {{ anchor:true, seq:number, topic:string, hash:string }} Anchor
 * @typedef {ReturnType<typeof createLedger>} Ledger
 */

/** FNV-1a, 32-bit — fast, dependency-free, deterministic across Node & browser. @param {string} str @returns {string} 8-hex */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * @param {{ anchorEvery?: number, hcsTopic?: string }} [opts]
 */
export function createLedger({ anchorEvery = 8, hcsTopic = '0.0.7719834' } = {}) {
  return {
    seq: 0,
    prevHash: 'genesis',
    /** @type {(Entry|Anchor)[]} */ chain: [], // chronological (append order)
    /** @type {number[]} */ latencies: [],
    sinceAnchor: 0,
    anchorEvery,
    hcsTopic,
  };
}

/** The canonical bytes that get hashed. Kept identical to what verifyChain recomputes. */
function payloadOf(/** @type {Entry} */ e) {
  return `${e.seq}|${e.ts}|${e.principal}|${e.object}|${e.decision}|${e.rule}`;
}

/**
 * Append one decision. Returns the created entry.
 * @param {Ledger} ledger
 * @param {{ clock:Date, principal:string, object:string, decision:Decision, rule:string, latencyMs:number }} d
 * @returns {Entry}
 */
export function record(ledger, d) {
  ledger.seq += 1;
  const ts = d.clock.toISOString().replace('T', ' ').slice(0, 19);
  /** @type {Entry} */
  const entry = {
    seq: ledger.seq, ts, principal: d.principal, object: d.object,
    decision: d.decision, rule: d.rule, latencyMs: d.latencyMs,
    prev: ledger.prevHash, hash: '',
  };
  entry.hash = fnv1a(ledger.prevHash + payloadOf(entry));
  ledger.prevHash = entry.hash;
  ledger.chain.push(entry);
  ledger.latencies.push(d.latencyMs);

  ledger.sinceAnchor += 1;
  if (ledger.sinceAnchor >= ledger.anchorEvery) {
    ledger.sinceAnchor = 0;
    ledger.chain.push({ anchor: true, seq: ledger.seq, topic: ledger.hcsTopic, hash: entry.hash });
  }
  return entry;
}

/** Only the decision entries, newest first (for UI). @param {Ledger} ledger @returns {Entry[]} */
export function entries(ledger) {
  return /** @type {Entry[]} */ (ledger.chain.filter((e) => !('anchor' in e))).slice().reverse();
}

/**
 * Recompute the chain from genesis and report the first broken link, if any.
 * This is the property a regulator cares about: the log cannot be edited after
 * the fact without detection.
 * @param {Ledger} ledger
 * @returns {{ intact:boolean, brokenAt:number|null }}
 */
export function verifyChain(ledger) {
  let prev = 'genesis';
  for (const e of ledger.chain) {
    if ('anchor' in e) continue;
    const expected = fnv1a(prev + payloadOf(e));
    if (e.prev !== prev || e.hash !== expected) return { intact: false, brokenAt: e.seq };
    prev = e.hash;
  }
  return { intact: true, brokenAt: null };
}

/** P99 latency over the recorded window. @param {Ledger} ledger @returns {number} ms (NaN if empty) */
export function p99(ledger) {
  if (!ledger.latencies.length) return NaN;
  const s = [...ledger.latencies].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.99))];
}
