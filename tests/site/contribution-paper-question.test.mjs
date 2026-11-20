import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {PROJECT_ROOT, createRuntime, loadLocalAtlas} from '../../lib/protocol/runtime.mjs';
import {atlasId, atlasVersion} from '../../lib/swampwiki.mjs';
import {contributionQuestionDestination} from '../../web/atlas-panel.mjs';

// SW-006: "Open paper question" on a reviewed source contribution. Every ID below is read back from the frozen release
// through the shared navigator before it is used.
const EXTRA_DIMENSIONS = 'q025-candidate-question:190bdf4415c78268d594ff95';
const LABORATORY = 'q025-candidate-question:64d5f9b67d11b1a4f7f8c113';
const LZ_UNIT = 'unit:04f12a626ec0a647658f6542fc7595e63d90376073441102f08ebefb6114ddc5';
// A real frozen method description of paper 0904.1743, listed on Laboratory as same-paper context. Method descriptions have no
// source-question destination, so this is an unresolved unit.
const METHOD_UNIT = 'unit:098b6ff70ff3b9e0257e992ed7b373ae62b468405b5ca144d4367d6d8640e14f';

let shared;
async function load() {
  const data = path.join(PROJECT_ROOT, 'dist/data');
  const {atlas: loaded, navigator} = await loadLocalAtlas(path.join(data, 'atlas', atlasId, atlasVersion), data);
  return {navigator, runtime: createRuntime(navigator, loaded.manifest.corpusId)};
}
async function atlas() { shared ??= await load(); return shared; }
async function open(destinationId, context) {
  const {runtime} = context || await atlas();
  const {view} = await runtime.action({type: 'navigate', selector: {...runtime.snapshot().view.atlas.selector, destinationId}});
  assert.equal(view.atlas.selector.destinationId, destinationId);
  return view;
}
// Graph relations, default choices and membership of a destination, as the browser reads them.
async function structure(destinationId, context) {
  const {navigator} = context, view = await open(destinationId, context), record = view.atlas.destination;
  return {connections: navigator.connections(destinationId, {limit: 100}).items.map(row => `${row.id}|${row.navigationKind}|${row.traversal}|${row.destinationId}`),
    choices: view.directions.map(direction => `${direction.id}|${direction.navigationKind}|${direction.selector.destinationId}`),
    membershipCount: view.atlas.membershipCount, contextMembershipCount: view.atlas.contextMembershipCount, contributions: (record.sourceContributions || []).length};
}

test('the Laboratory LZ contribution opens the same destination as the Extra Dimensions route, with its role and qualification intact', async () => {
  const {navigator} = await atlas();
  const extra = await open(EXTRA_DIMENSIONS);
  const route = extra.directions.find(direction => direction.navigationKind === 'source_question' && /LZ high-recoil event/.test(direction.label));
  assert.ok(route, 'Extra Dimensions lists the LZ paper question');
  const lab = await open(LABORATORY), rows = lab.atlas.destination.sourceContributions.filter(row => row.unitId === LZ_UNIT);
  assert.equal(rows.length, 1, 'one reviewed LZ contribution on Laboratory');
  const [row] = rows;
  assert.equal(row.role, 'specializes');
  assert.equal(row.basis, 'description_checked');
  assert.equal(row.paperId, '2609.07138');
  assert.match(row.qualification, /the reported LZ event remains motivation without established dark-matter attribution/);
  assert.equal(row.provenance.doesNotAssertDirectHome, true);
  assert.equal(row.provenance.doesNotAssertEquivalence, true);

  const target = await contributionQuestionDestination(navigator, LZ_UNIT, {currentId: LABORATORY});
  assert.deepEqual(target, {destinationId: route.selector.destinationId, title: navigator.destination(route.selector.destinationId).title});
  assert.equal(navigator.destination(target.destinationId).representativeUnitId, LZ_UNIT);
  // Laboratory has no graph relation to the LZ question: the contribution link is the only way there from Laboratory.
  assert.ok(!navigator.connections(LABORATORY, {limit: 100}).items.some(link => link.destinationId === target.destinationId));
});

test('every Laboratory contribution resolves to the destination recorded for its exact unit', async () => {
  const {navigator} = await atlas(), lab = await open(LABORATORY), units = [...new Set(lab.atlas.destination.sourceContributions.map(row => row.unitId))];
  assert.equal(units.length, 19);
  for (const unitId of units) {
    const target = await contributionQuestionDestination(navigator, unitId, {currentId: LABORATORY});
    assert.ok(target, `${unitId} resolves`);
    assert.notEqual(target.destinationId, LABORATORY);
    assert.equal(navigator.destination(target.destinationId).representativeUnitId, unitId);
  }
});

test('an unresolved unit yields no destination, so no link is drawn', async () => {
  const {navigator} = await atlas();
  await navigator.prepareSources(LABORATORY);
  const method = navigator.sources(LABORATORY, {lens: 'method', includeContext: true, limit: 100}).items.find(row => row.unitId === METHOD_UNIT);
  assert.ok(method, 'the method unit is a real frozen description listed on Laboratory');
  assert.equal(method.lens, 'method');
  await assert.rejects(navigator.prepareDestination(`source-question:${METHOD_UNIT.slice(5)}`), /unknown destination/);
  assert.equal(await contributionQuestionDestination(navigator, METHOD_UNIT, {currentId: LABORATORY}), null);
  for (const bad of [undefined, '', 'unit:04f12a', LZ_UNIT.toUpperCase(), `source-question:${LZ_UNIT.slice(5)}`]) assert.equal(await contributionQuestionDestination(navigator, bad), null, String(bad));
  assert.equal(await contributionQuestionDestination(undefined, LZ_UNIT), null, 'no navigator, no link');
});

test('a lookup that fails, names another representative, or reaches the current destination yields no link', async () => {
  const {navigator} = await atlas(), key = `source-question:${LZ_UNIT.slice(5)}`;
  const unavailable = {...navigator, prepareDestination: async () => { throw new Error('lazy shard checksum mismatch'); }, destination: () => { throw new Error('unknown destination'); }};
  assert.equal(await contributionQuestionDestination(unavailable, LZ_UNIT), null);
  const other = {...navigator, destination: id => ({...navigator.destination(id), representativeUnitId: METHOD_UNIT})};
  assert.equal(await contributionQuestionDestination(other, LZ_UNIT), null);
  assert.equal(await contributionQuestionDestination(navigator, LZ_UNIT, {currentId: key}), null);
});

test('resolving contributions leaves graph relations, choice counts and membership unchanged', async () => {
  // A fresh navigator, so "before" is read before any contribution lookup in this process.
  const context = await load(), {navigator} = context, ids = [LABORATORY, EXTRA_DIMENSIONS];
  const before = {}; for (const id of ids) before[id] = await structure(id, context);
  assert.equal(before[LABORATORY].connections.length, 18);
  assert.equal(before[LABORATORY].choices.length, 15);
  assert.equal(before[LABORATORY].contributions, 19);
  assert.equal(before[EXTRA_DIMENSIONS].connections.length, 27);
  assert.equal(before[EXTRA_DIMENSIONS].choices.length, 15);
  let resolved = 0;
  for (const row of (await open(LABORATORY, context)).atlas.destination.sourceContributions) if (await contributionQuestionDestination(navigator, row.unitId, {currentId: LABORATORY})) resolved++;
  assert.equal(resolved, 19);
  const lz = navigator.connections(`source-question:${LZ_UNIT.slice(5)}`).items;
  assert.deepEqual(lz.map(link => `${link.navigationKind}|${link.traversal}|${link.destinationId}`), [`source_question|incoming|${EXTRA_DIMENSIONS}`], 'LZ keeps its one recorded relation');
  for (const id of ids) assert.deepEqual(await structure(id, context), before[id], id);
});
