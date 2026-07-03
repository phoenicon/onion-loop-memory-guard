// @ts-check
/**
 * examples/vector-gate.js — the permission gate standing in front of a REAL
 * similarity search.
 *
 *   Run:  node examples/vector-gate.js
 *   (set OPENAI_API_KEY for production-grade embeddings; otherwise a local,
 *    dependency-free lexical embedder is used — either way the pipeline is real.)
 *
 * Pipeline: embed a corpus → store vectors → embed a query → nearest-dot search
 * → THEN run the Onion Loop engine over the hits to gate them per viewer.
 * Same engine as the console, the tests and the benchmark. The vector store is
 * the "sneeze"; the engine is the bouncer at the door.
 */
import { UNIVERSAL, groups } from '../src/audience.js';
import { check } from '../src/engine.js';
import { createLedger, record, verifyChain } from '../src/audit.js';
import { embed, embedderName, VectorStore } from '../src/vector.js';

const clock = new Date('2026-07-02T09:00:00Z');

// A small corpus: ACL'd source documents + one AI-derived summary. Each carries
// real text we will actually embed and search.
const graph = {
  epoch: clock,
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
const TEXT = {
  'SRC-BLOG': 'Harvest blog: our wheat harvest hit record yields this autumn. Open farm day next month, all welcome.',
  'SRC-DECK': 'Q3 board deck. Harvest budget decision: approved at 2.4 million pounds. Dividend held. Somerset land acquisition on track.',
  'SRC-RUN': 'Infra runbook: rotate the irrigation controller keys, restart the sensor gateway, on-call pager escalation steps.',
  'SRC-LEAD': 'Leadership strategy call. Confidential plan to acquire the neighbouring farm and restructure the debt facility.',
  'MEM-SUM': 'Summary of the quarter: strong harvest performance and the approved harvest budget for the year ahead.',
};
const PERSONAS = {
  alice: { id: 'alice', name: 'Alice', role: 'Board', groups: new Set(['board']) },
  bob: { id: 'bob', name: 'Bob', role: 'Engineering', groups: new Set(['engineering']) },
  carol: { id: 'carol', name: 'Carol', role: 'Contractor', groups: new Set([]) },
};

const say = (s) => console.log(s);
const line = () => say('─'.repeat(66));
const nodeName = (id) => (graph.sources[id] || graph.derived[id] || {}).name || id;

async function main() {
  // 1) embed the corpus into the store (the "sneeze")
  const store = new VectorStore();
  for (const id of Object.keys(TEXT)) store.add(id, await embed(TEXT[id]), { id });

  line();
  say('  VECTOR SEARCH + PERMISSION GATE');
  say('  embedder: ' + embedderName() + '  ·  ' + store.items.length + ' memories indexed');
  line();

  // 2) a real query → nearest-dot search
  const query = 'what was the harvest budget decision?';
  const hits = store.search(await embed(query), 4);
  say('\n🔎 query: "' + query + '"');
  say('   nearest memories by cosine similarity (a naive RAG would return these):\n');
  for (const h of hits) say('   ' + h.score.toFixed(3) + '  ' + h.id.padEnd(9) + ' ' + nodeName(h.id));

  say('\n   ⚠️  the top hit is the confidential board deck. Without a gate, a naive');
  say('       RAG hands it to whoever asked — including a contractor.\n');

  // 3) run the SAME engine over the hits, per viewer
  const ledger = createLedger();
  for (const pid of ['carol', 'alice']) {
    const persona = PERSONAS[pid];
    line();
    say('  retrieving as ' + persona.name + ' (' + persona.role + ')');
    line();
    const allowed = [];
    for (const h of hits) {
      const r = check(graph, h.id, persona, clock);
      record(ledger, { clock, principal: persona.name, object: h.id, decision: r.decision, rule: r.rule, latencyMs: r.latencyMs });
      const nm = nodeName(h.id);
      if (r.decision === 'GRANT') { allowed.push(h.id); say('   ✅ ' + h.id.padEnd(9) + nm + '   (' + r.rule + ')'); }
      else say('   ⛔ ' + h.id.padEnd(9) + nm + '   → blocked: ' + r.rule);
    }
    say('\n   → to the LLM: [' + allowed.join(', ') + ']  ' + (allowed.length ? '' : '(nothing sensitive leaked)'));
  }

  line();
  const chain = verifyChain(ledger);
  say('  🧾 ' + ledger.seq + ' gate decisions logged · chain ' + (chain.intact ? 'intact ✓' : 'BROKEN @' + chain.brokenAt));
  line();
  say('The vector store found what was RELEVANT. The engine decided what was');
  say('ALLOWED — deterministically, per viewer, in front of the real search.');
}

main();
