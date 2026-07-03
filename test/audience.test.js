// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNIVERSAL, groups, NONE, intersect, union, personaAllowed, audienceToString } from '../src/audience.js';

const persona = (...g) => ({ id: 'x', name: 'X', role: 'r', groups: new Set(g) });

test('universal audience admits everyone', () => {
  assert.equal(personaAllowed(UNIVERSAL(), persona()), true);
  assert.equal(personaAllowed(UNIVERSAL(), persona('board')), true);
});

test('empty audience (∅) admits nobody', () => {
  assert.equal(personaAllowed(NONE(), persona('board')), false);
  assert.equal(personaAllowed(NONE(), persona()), false);
});

test('group audience admits only matching members', () => {
  const aud = groups('board');
  assert.equal(personaAllowed(aud, persona('board')), true);
  assert.equal(personaAllowed(aud, persona('engineering')), false);
  assert.equal(personaAllowed(aud, persona('board', 'engineering')), true);
});

test('intersection never widens access (the core lineage guarantee)', () => {
  // {board} ∩ {engineering} = ∅  → readable by no single-group member
  const i = intersect(groups('board'), groups('engineering'));
  assert.equal(i.groups.size, 0);
  assert.equal(personaAllowed(i, persona('board')), false);
  assert.equal(personaAllowed(i, persona('board', 'engineering')), false); // per-source model handles this, not raw ∩
});

test('intersection with universal is the other audience', () => {
  const i = intersect(UNIVERSAL(), groups('board'));
  assert.deepEqual([...i.groups], ['board']);
  assert.equal(i.universal, false);
});

test('intersection keeps shared groups only', () => {
  const i = intersect(groups('board', 'ops'), groups('ops', 'engineering'));
  assert.deepEqual([...i.groups].sort(), ['ops']);
});

test('union is for inference analysis, not enforcement', () => {
  const u = union(groups('a'), groups('b'));
  assert.deepEqual([...u.groups].sort(), ['a', 'b']);
  assert.equal(union(UNIVERSAL(), groups('a')).universal, true);
});

test('audienceToString is stable and readable', () => {
  assert.equal(audienceToString(UNIVERSAL()), 'everyone');
  assert.equal(audienceToString(NONE()), '∅ nobody');
  assert.equal(audienceToString(groups('board')), '{board}');
});
