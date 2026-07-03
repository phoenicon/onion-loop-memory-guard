// @ts-check
/**
 * bench/p99.js — proves the bounty's hard requirement: sub-200ms P99 permission
 * checks, with NO LLM call on the decision path.
 *
 * We run the real enforcement path (resolve lineage → intersect ACLs → decide)
 * hundreds of thousands of times across every (persona × memory) pair, including
 * revoked and time-locked states, and report the full latency distribution.
 *
 * Run:  npm run bench   (or: node bench/p99.js)
 */
import { freshScenario } from '../src/scenario.js';
import { resolve, canRead } from '../src/engine.js';

const ITER = Number(process.argv[2]) || 200_000;
const { graph, personas, epoch } = freshScenario();
const memIds = Object.keys(graph.derived);
const people = Object.values(personas);

// Mix in revoked + time-shifted states so we're not measuring a trivial hot path.
const clocks = [epoch, new Date(epoch.getTime() + 40 * 86_400_000)];

const samples = new Float64Array(ITER);
let grants = 0;

// warm up the JIT
for (let i = 0; i < 5000; i++) canRead(resolve(graph, memIds[i % memIds.length], epoch), people[i % people.length]);

for (let i = 0; i < ITER; i++) {
  const mem = memIds[i % memIds.length];
  const persona = people[i % people.length];
  const clock = clocks[i % clocks.length];
  const t0 = performance.now();
  const allowed = canRead(resolve(graph, mem, clock), persona);
  samples[i] = performance.now() - t0;
  if (allowed) grants++;
}

const sorted = Array.from(samples).sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
const fmt = (ms) => (ms >= 1 ? ms.toFixed(3) + ' ms' : (ms * 1000).toFixed(2) + ' µs');

const p99 = pct(0.99);
const budget = 200; // ms, from the bounty

console.log(`\n  Onion Loop Memory Guard — permission-check benchmark`);
console.log(`  ${ITER.toLocaleString()} deterministic checks · ${people.length} personas × ${memIds.length} memories · 0 LLM calls\n`);
console.log(`    mean    ${fmt(mean)}`);
console.log(`    p50     ${fmt(pct(0.5))}`);
console.log(`    p90     ${fmt(pct(0.9))}`);
console.log(`    p99     ${fmt(p99)}`);
console.log(`    p99.9   ${fmt(pct(0.999))}`);
console.log(`    max     ${fmt(sorted[sorted.length - 1])}`);
console.log(`    grants  ${grants.toLocaleString()} / ${ITER.toLocaleString()}\n`);

const headroom = Math.round(budget / p99);
if (p99 < budget) {
  console.log(`  ✅ PASS — P99 ${fmt(p99)} is under the ${budget} ms budget (~${headroom.toLocaleString()}× headroom)\n`);
  process.exit(0);
} else {
  console.log(`  ❌ FAIL — P99 ${fmt(p99)} exceeds the ${budget} ms budget\n`);
  process.exit(1);
}
