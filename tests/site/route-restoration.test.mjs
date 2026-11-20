import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PROJECT_ROOT} from '../../lib/protocol/runtime.mjs';
import {loadAtlas, createAtlasNavigator, createAtlasSourceReader, atlasAddress} from '../../lib/geometry/prepared-atlas.mjs';
import {atlasId, atlasVersion} from '../../lib/swampwiki.mjs';
import {currentState, exportSession, importSession, applyAction, normalizeState} from '../../lib/protocol/session.mjs';
import {routeTarget, routeSession} from '../../web/physics-path.mjs';

// SW-006: a valid prepared-atlas address whose browser history entry was recorded under an older computation must open from the
// address, while matching history keeps its path and explicit imports keep the computation check. The fixture is the history entry a
// browser holds after Collection → Dark sectors → Extra dimensions (physical-question lens, recent, ON), recorded by an engine build
// whose prepared-source hash was the one at upstream commit 8b65b4b (lib/geometry/prepared-identity.mjs). Any deploy that changes
// prepared-atlas.mjs changes that hash, so tabs left open across it hold exactly such entries. The test re-derives the fixture from
// the frozen release and compares it with the stored copy. The browser receipts inject an entry with the same SHA-256.
const OLDER_ENGINE_SHA256 = 'b23d4767901321588374a3d4573c7305cfa5dff85611f44e892edf71dcc8d7b0';
const FIXTURE = path.join(PROJECT_ROOT, 'tests/site/fixtures/stale-computation-route.json');
const FIXTURE_SHA256 = '2b2e44bcd52e19e7c3e435396dbdee926de12307649aee7dd6cc124b3e73d228';
const HOME = 'collection:q025-quantum-gravity', DARK_SECTORS = 'q025-candidate-region:7961ee3cebdb154299e78b58', EXTRA_DIMENSIONS = 'q025-candidate-question:190bdf4415c78268d594ff95';
const OPTIONS = {lens: 'physical_question', intent: 'recent', workRelation: 'on'};
const ORIGIN = 'http://127.0.0.1:4271';
const address = (destination, {lens, intent, workRelation} = OPTIONS) => `${ORIGIN}/#${new URLSearchParams({atlas: atlasId, version: atlasVersion, destination, lens, intent, relation: workRelation})}`;
const fragment = url => new URLSearchParams(new URL(url).hash.slice(1));
const sha256 = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

let released;
async function release() {
  if (released) return released;
  const atlasDir = path.join(PROJECT_ROOT, 'dist/data/atlas', atlasId, atlasVersion), corpusDir = path.join(PROJECT_ROOT, 'dist/data');
  const readers = {readText: filename => readFile(filename, 'utf8'), readBinary: filename => readFile(filename)};
  const atlas = await loadAtlas(atlasDir, readers);
  const navigator = createAtlasNavigator(atlas, {readSources: createAtlasSourceReader(atlas, {base: corpusDir, ...readers})});
  return released = {navigator, corpusId: atlas.manifest.corpusId};
}
// The path a reader builds by opening the collection with the options and clicking two choices; one session per step, as each
// click pushes a history entry holding the session so far.
async function clickedPath(navigator) {
  let session = navigator.createSession({...OPTIONS}); await navigator.prepareState(currentState(session));
  const steps = [session];
  for (const destinationId of [DARK_SECTORS, EXTRA_DIMENSIONS]) {
    const direction = navigator.computeView(currentState(session)).directions.find(choice => choice.selector?.destinationId === destinationId);
    assert.ok(direction, `choice to ${destinationId}`);
    const action = {type: 'select', directionId: direction.id};
    await navigator.prepareAction(session, action); session = applyAction(session, action, navigator).session; steps.push(session);
  }
  return steps;
}
const recordedUnder = (session, computationId) => exportSession({schemaVersion: session.schemaVersion, corpusId: session.corpusId, computationId, cursor: session.cursor,
  states: session.states.map(({id, ...state}) => normalizeState({...state, computationId}))});
const olderComputation = computationId => { const parts = computationId.split(':'); parts[2] = OLDER_ENGINE_SHA256; return parts.join(':'); };
async function fixture() {
  const {navigator} = await release(), derived = recordedUnder((await clickedPath(navigator)).at(-1), olderComputation(navigator.computationId));
  return {derived, stored: JSON.parse(await readFile(FIXTURE, 'utf8'))};
}
const current = session => (({selector, lens, intent, workRelation}) => ({destinationId: selector.destinationId, lens, intent, workRelation}))(currentState(session));

test('the stale-history fixture is the clicked path recorded under an earlier engine build, and only its computation is stale', async () => {
  const {navigator, corpusId} = await release(), {derived, stored} = await fixture();
  assert.deepEqual(stored, derived, 'fixture re-derives from the frozen release');
  assert.equal(sha256(stored), FIXTURE_SHA256, 'the browser receipts inject this exact entry');
  assert.notEqual(stored.computationId, navigator.computationId);
  assert.deepEqual(stored.computationId.split(':').filter((part, index) => part !== navigator.computationId.split(':')[index]), [OLDER_ENGINE_SHA256], 'only the engine-source hash differs');
  const readable = importSession(stored, {corpusId});
  assert.deepEqual(readable.states.map(state => state.selector.destinationId), [HOME, DARK_SECTORS, EXTRA_DIMENSIONS]);
  assert.deepEqual(current(readable), {destinationId: EXTRA_DIMENSIONS, ...OPTIONS});
  // Explicit imports keep the existing check: the same entry offered as a file or saved session is refused.
  assert.throws(() => importSession(stored, {corpusId, computationId: navigator.computationId}), /Computation mismatch/);
});

test('a valid address with stale history opens from the address with its original lens, intent and relation', async () => {
  const {navigator, corpusId} = await release(), {stored} = await fixture(), url = address(EXTRA_DIMENSIONS), route = routeTarget(fragment(url));
  assert.deepEqual(route, {selector: {kind: 'atlas-destination', atlasId, atlasVersion, destinationId: EXTRA_DIMENSIONS}, ...OPTIONS});
  const next = routeSession(stored, route, navigator, corpusId);
  assert.equal(next.computationId, navigator.computationId, 'installed computation, not the remembered one');
  assert.equal(next.states.length, 1, 'the address opens by itself; the older path is not replayed');
  assert.deepEqual(current(next), {destinationId: EXTRA_DIMENSIONS, ...OPTIONS});
  assert.deepEqual(next, navigator.createSession({selector: route.selector, ...OPTIONS}));
  await navigator.prepareState(currentState(next));
  const view = navigator.computeView(currentState(next));
  assert.equal(view.atlas.selector.destinationId, EXTRA_DIMENSIONS);
  assert.ok(view.directions.length > 0);
  // The entry written back keeps the same address and now matches, so a second reload reuses it.
  assert.equal(atlasAddress(currentState(next), ORIGIN), url, 'stable link');
  assert.deepEqual(routeSession(exportSession(next), route, navigator, corpusId), next);
});

test('matching history keeps the remembered path, including after Back', async () => {
  const {navigator, corpusId} = await release(), steps = await clickedPath(navigator);
  for (const [index, destinationId] of [[1, DARK_SECTORS], [2, EXTRA_DIMENSIONS]]) {
    const remembered = exportSession(steps[index]), restored = routeSession(remembered, routeTarget(fragment(address(destinationId))), navigator, corpusId);
    assert.deepEqual(restored, importSession(remembered), `entry ${index} is reused as recorded`);
    assert.equal(restored.states.length, index + 1);
    assert.equal(restored.cursor, index);
  }
});

test('history that does not belong to the address yields to the address; an invalid address still fails', async () => {
  const {navigator, corpusId} = await release(), steps = await clickedPath(navigator), {stored} = await fixture(), matching = exportSession(steps[2]);
  const fresh = (destinationId, options = OPTIONS) => navigator.createSession({selector: {kind: 'atlas-destination', atlasId, atlasVersion, destinationId}, ...options});
  const defaults = {lens: 'combined', intent: 'explore', workRelation: 'either'};
  const bareAddress = `${ORIGIN}/#${new URLSearchParams({atlas: atlasId, version: atlasVersion, destination: EXTRA_DIMENSIONS})}`;
  assert.deepEqual(routeSession(matching, routeTarget(fragment(bareAddress)), navigator, corpusId), fresh(EXTRA_DIMENSIONS, defaults), 'missing options default as before');
  assert.deepEqual(routeSession(matching, routeTarget(fragment(address(DARK_SECTORS))), navigator, corpusId), fresh(DARK_SECTORS), 'another destination');
  assert.deepEqual(routeSession(stored, routeTarget(fragment(address(DARK_SECTORS))), navigator, corpusId), fresh(DARK_SECTORS), 'stale and another destination');
  for (const remembered of [undefined, null, {kind: 'not-a-session'}, {...matching, corpusId: 'another-corpus'}])
    assert.deepEqual(routeSession(remembered, routeTarget(fragment(address(EXTRA_DIMENSIONS))), navigator, corpusId), fresh(EXTRA_DIMENSIONS));
  assert.throws(() => routeSession(stored, routeTarget(fragment(address('q025-candidate-question:000000000000000000000000'))), navigator, corpusId), /unknown destination/);
  assert.throws(() => routeSession(stored, routeTarget(fragment(address(EXTRA_DIMENSIONS, {...OPTIONS, lens: 'not-a-lens'}))), navigator, corpusId), /Unsupported lens/);
});
