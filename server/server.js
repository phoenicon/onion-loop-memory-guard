// @ts-check
/**
 * server.js — a dependency-free host for the demo.
 *
 * Two jobs:
 *   1. Serve the static console (web/) and the engine source (src/) so the
 *      browser can import the SAME modules the tests and benchmark use.
 *   2. Expose a tiny JSON API that runs that engine SERVER-SIDE, proving the
 *      library is reusable outside the browser and that enforcement +
 *      hash-chained audit work identically on a backend.
 *
 *   GET  /                      → console
 *   GET  /api/health            → { ok, uptime }
 *   GET  /api/scenario          → sources + derived + persona roster
 *   GET  /api/retrieve?as=carol → deterministic redacted view for a persona
 *   GET  /api/audit             → server-side ledger + chain verification + P99
 *   GET  /api/search?as=carol&q=… → REAL embedding + cosine search, then gated
 *
 * Run:  npm run demo   (or: node server/server.js)
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

import { freshScenario } from '../src/scenario.js';
import { check } from '../src/engine.js';
import { redactedView, auditLeaks, reconstructionAudit } from '../src/inference.js';
import { audienceToString } from '../src/audience.js';
import { createLedger, record, entries, verifyChain, p99 } from '../src/audit.js';
import { embed, embedderName, VectorStore } from '../src/vector.js';
import { demoCorpus, CLOCK, nodeName } from '../src/demo-corpus.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4173;
const bootTime = Date.now();

// One long-lived server-side world + audit ledger.
const world = freshScenario();
const ledger = createLedger();

// A real vector index over the demo corpus, built once at boot.
const corpus = demoCorpus();
const store = new VectorStore();
let vectorReady = false;
(async () => {
  for (const id of Object.keys(corpus.text)) store.add(id, await embed(corpus.text[id]), { id });
  vectorReady = true;
  console.log(`  vector index ready · ${store.items.length} memories · embedder ${embedderName()}`);
})();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json',
};

const json = (res, code, body) => {
  const s = JSON.stringify(body, null, 2);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
  res.end(s);
};

/** GET /api/retrieve?as=<personaId> — the deterministic, redacted retrieval a viewer would receive. */
function retrieve(res, personaId) {
  const persona = world.personas[personaId];
  if (!persona) return json(res, 400, { error: `unknown persona '${personaId}'`, personas: Object.keys(world.personas) });
  const clock = world.epoch;
  const decisions = Object.keys(world.graph.derived).map((id) => {
    const r = check(world.graph, id, persona, clock);
    record(ledger, { clock, principal: persona.name, object: id, decision: r.decision, rule: r.rule, latencyMs: r.latencyMs });
    return { id, decision: r.decision, rule: r.rule, latencyMs: r.latencyMs };
  });
  const view = redactedView(world.graph, persona, clock);
  const leak = auditLeaks(world.graph, persona, clock, view);
  const reconstruction = reconstructionAudit(world.graph, persona, clock);
  json(res, 200, {
    viewer: { id: persona.id, name: persona.name, role: persona.role, groups: [...persona.groups] },
    enforcement: 'deterministic · 0 LLM calls',
    consistency: 'no cached permissions — access recomputed from live source ACLs at read time',
    decisions,
    redactedView: view,
    inferenceGuard: { metadata: leak, reconstruction },
    p99Ms: p99(ledger),
  });
}

function scenario(res) {
  json(res, 200, {
    epoch: world.epoch.toISOString(),
    personas: Object.values(world.personas).map((p) => ({ id: p.id, name: p.name, role: p.role, groups: [...p.groups] })),
    sources: Object.values(world.graph.sources).map((s) => ({
      id: s.id, name: s.name, level: ['Public', 'Internal', 'Confidential'][s.level],
      audience: audienceToString(s.base), revoked: s.revoked, unlockDays: s.unlockDays,
    })),
    derived: Object.values(world.graph.derived).map((d) => ({ id: d.id, name: d.name, kind: d.kind, derived_from: d.from })),
  });
}

function audit(res) {
  json(res, 200, { entries: entries(ledger).slice(0, 50), chain: verifyChain(ledger), p99Ms: p99(ledger), count: ledger.seq });
}

/** GET /api/search?as=<persona>&q=<query> — real embedding + cosine search, then gated. */
async function search(res, personaId, query) {
  if (!vectorReady) return json(res, 503, { error: 'vector index warming up, retry shortly' });
  const persona = corpus.personas[personaId];
  if (!persona) return json(res, 400, { error: `unknown persona '${personaId}'`, personas: Object.keys(corpus.personas) });
  const q = (query || 'what was the harvest budget decision?').slice(0, 400);
  const hits = store.search(await embed(q), 5);
  const gated = hits.map((h) => {
    const r = check(corpus.graph, h.id, persona, CLOCK);
    record(ledger, { clock: CLOCK, principal: persona.name, object: h.id, decision: r.decision, rule: r.rule, latencyMs: r.latencyMs });
    return { id: h.id, name: nodeName(corpus.graph, h.id), score: +h.score.toFixed(4), decision: r.decision, rule: r.rule };
  });
  json(res, 200, {
    query: q,
    embedder: embedderName(),
    viewer: { id: persona.id, name: persona.name, role: persona.role },
    note: 'relevance found these; the engine decided which the viewer may see',
    ranked: gated,
    toLLM: gated.filter((g) => g.decision === 'GRANT').map((g) => g.id),
    blocked: gated.filter((g) => g.decision === 'DENY').map((g) => ({ id: g.id, rule: g.rule })),
  });
}

async function serveStatic(res, urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  try {
    let s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, 'index.html');
    const data = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404 · not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const p = url.pathname;
  if (p === '/api/health') return json(res, 200, { ok: true, uptimeMs: Date.now() - bootTime });
  if (p === '/api/scenario') return scenario(res);
  if (p === '/api/retrieve') return retrieve(res, url.searchParams.get('as') || world.defaultPersona);
  if (p === '/api/search') return search(res, url.searchParams.get('as') || 'carol', url.searchParams.get('q') || '');
  if (p === '/api/audit') return audit(res);
  return serveStatic(res, p === '/' ? '/web/index.html' : p);
});

server.listen(PORT, () => {
  console.log(`\n  Onion Loop Memory Guard — console + API`);
  console.log(`  ▸ http://localhost:${PORT}\n`);
  console.log(`  try:  curl "http://localhost:${PORT}/api/retrieve?as=carol"\n`);
});
