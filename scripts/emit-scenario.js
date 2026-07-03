// @ts-check
/**
 * Emit a human-readable JSON projection of the demo scenario + a full decision
 * matrix (every persona × every memory) to /scenarios. Lets a judge see the
 * value without running the app.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { freshScenario } from '../src/scenario.js';
import { check } from '../src/engine.js';
import { audienceToString } from '../src/audience.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'scenarios');
mkdirSync(outDir, { recursive: true });

const { graph, personas, epoch } = freshScenario();

const audLabel = (/** @type {any} */ b) => audienceToString(b);

const projection = {
  epoch: epoch.toISOString(),
  sources: Object.values(graph.sources).map((s) => ({
    id: s.id, name: s.name, level: ['Public', 'Internal', 'Confidential'][s.level],
    audience: audLabel(s.base), revoked: s.revoked, unlockDays: s.unlockDays,
  })),
  derived: Object.values(graph.derived).map((d) => ({ id: d.id, name: d.name, kind: d.kind, derived_from: d.from })),
};

/** Full decision matrix at epoch. */
const matrix = {};
for (const mid of Object.keys(graph.derived)) {
  matrix[mid] = {};
  for (const pid of Object.keys(personas)) {
    matrix[mid][personas[pid].name] = check(graph, mid, personas[pid], epoch).decision;
  }
}

writeFileSync(join(outDir, 'demo-scenario.json'), JSON.stringify(projection, null, 2) + '\n');
writeFileSync(join(outDir, 'decision-matrix.json'), JSON.stringify(matrix, null, 2) + '\n');
console.log('wrote scenarios/demo-scenario.json and scenarios/decision-matrix.json');
