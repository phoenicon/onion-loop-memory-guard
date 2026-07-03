// @ts-check
/**
 * examples/eli5.js — the whole idea in one tiny story you can watch run.
 *
 *   Run:  node examples/eli5.js
 *
 * No UI, no jargon. Just the real engine (same src/ the demo uses) narrating
 * every decision it makes. This is the nuts and bolts.
 */
import { UNIVERSAL, groups } from '../src/audience.js';
import { resolve, canRead, requirementString } from '../src/engine.js';
import { createLedger, record, verifyChain } from '../src/audit.js';

// ── tiny print helpers ────────────────────────────────────────────────
const line = () => console.log('─'.repeat(60));
const say = (s) => console.log(s);
const pause = (s) => console.log('\n' + s);

// ── THE CAST ──────────────────────────────────────────────────────────
// Two people. Alice is on the Board. Carol is an outside contractor.
const alice = { id: 'alice', name: 'Alice (Board)',      role: 'board',      groups: new Set(['board']) };
const carol = { id: 'carol', name: 'Carol (Contractor)', role: 'contractor', groups: new Set([]) };

// ── THE STUFF WE KEEP ─────────────────────────────────────────────────
// Two original documents…
//   • a public blog post   → anyone may read it
//   • a secret board deck   → only the Board may read it
// …and one thing the AI MADE by reading BOTH: a summary.
const clock = new Date('2026-07-02T09:00:00Z');
const graph = {
  epoch: clock,
  sources: {
    BLOG: { id: 'BLOG', name: 'Public blog post', level: 0, base: UNIVERSAL(),   revoked: false, unlockDays: 0 },
    DECK: { id: 'DECK', name: 'Secret board deck', level: 2, base: groups('board'), revoked: false, unlockDays: 0 },
  },
  derived: {
    SUMMARY: { id: 'SUMMARY', name: 'AI summary of both', kind: 'summary', from: ['BLOG', 'DECK'] },
  },
};

const ledger = createLedger();

// A helper that asks "can this person read this thing?" and writes it down.
function tryToRead(person, id) {
  const r = resolve(graph, id, clock);
  const allowed = canRead(r, person);
  record(ledger, {
    clock, principal: person.name, object: id,
    decision: allowed ? 'GRANT' : 'DENY',
    rule: `needs: ${requirementString(r)}`, latencyMs: 0.01,
  });
  say(`   ${allowed ? '✅ YES' : '⛔ NO '}  ${person.name.padEnd(20)} → ${graph.derived[id]?.name ?? graph.sources[id]?.name}   (rule: needs ${requirementString(r)})`);
  return allowed;
}

// ── THE STORY ─────────────────────────────────────────────────────────
line();
say('🧅  ONION LOOP — the whole idea in 30 seconds');
line();
say('We have 2 documents and 1 AI-made summary:');
say('   • BLOG  — a public blog post        (anyone can read)');
say('   • DECK  — a secret board deck        (only the Board)');
say('   • SUMMARY — the AI read BOTH and wrote a summary of them');

pause('❓ Question: who is allowed to read the SUMMARY?');
say('   The summary was built from a SECRET deck, so it is only as');
say('   open as its most secret ingredient. Watch:');
console.log();
tryToRead(alice, 'SUMMARY');
tryToRead(carol, 'SUMMARY');
pause('👉 Carol is blocked — even though nobody wrote "secret" on the summary.');
say('   The engine figured it out by looking at where the summary CAME FROM.');
say('   (No AI was asked "should Carol see this?" — it is pure logic.)');

// ── NOW THE MAGIC TRICK: shred the source ─────────────────────────────
pause('🔥 Now the boss shreds the secret DECK (revokes access to it).');
say('   We do NOTHING to the summary itself. We only touch the source.');
graph.sources.DECK.revoked = true;
console.log();
tryToRead(alice, 'SUMMARY');
tryToRead(carol, 'SUMMARY');
pause('👉 The summary vanished for EVERYONE — instantly. Even Alice.');
say('   Because the summary never stored its own permissions. It asks its');
say('   sources every single time. Kill the source, the summary dies with it.');
say('   → That is the bug every other system has, and the one this deletes.');

// ── THE PAPER TRAIL ───────────────────────────────────────────────────
pause('🧾 And every single decision above was written to a tamper-proof log:');
console.log();
for (const e of ledger.chain.filter((x) => !('anchor' in x))) {
  say(`   #${e.seq}  ${e.principal.padEnd(20)} ${e.object.padEnd(9)} ${e.decision.padEnd(6)}  hash:${e.hash}`);
}
const chain = verifyChain(ledger);
pause(`🔒 Log integrity check: ${chain.intact ? 'INTACT ✓ (nobody tampered with the history)' : 'BROKEN at #' + chain.brokenAt}`);
line();
say('That is the whole thing:');
say('   1. permissions live on the SOURCES, never copied onto AI-made stuff');
say('   2. to read AI-made stuff you must be allowed to read all its sources');
say('   3. change a source → everything made from it updates instantly');
say('   4. every yes/no is logged in a chain you can prove was not edited');
line();
