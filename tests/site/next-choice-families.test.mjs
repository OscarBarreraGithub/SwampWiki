import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {PROJECT_ROOT, createRuntime, loadLocalAtlas} from '../../lib/protocol/runtime.mjs';
import {atlasId, atlasVersion} from '../../lib/swampwiki.mjs';
import {choiceFamily, choiceRoute, choiceKindLabel, choiceGroupHeading, choiceGroupNote, resolvePaperAttribution} from '../../web/atlas-panel.mjs';

// SW-006 next-choice experiment: the same choices, grouped by recorded relation family. Every count below is read from the
// frozen release through the shared runtime and navigator; nothing here changes which choices are offered.
const ID = {
  collection: 'collection:q025-quantum-gravity',
  darkSectors: 'q025-candidate-region:7961ee3cebdb154299e78b58',
  extraDims: 'q025-candidate-question:190bdf4415c78268d594ff95',
  lab: 'q025-candidate-question:64d5f9b67d11b1a4f7f8c113',
  lz: 'source-question:04f12a626ec0a647658f6542fc7595e63d90376073441102f08ebefb6114ddc5',
  lzUnit: 'unit:04f12a626ec0a647658f6542fc7595e63d90376073441102f08ebefb6114ddc5',
  leaf: 'q025-candidate-question:1f9b1d5cdab35624dd6346e3',
};
let shared;
async function open(destinationId) {
  if (!shared) {
    const data = path.join(PROJECT_ROOT, 'dist/data');
    const {atlas, navigator} = await loadLocalAtlas(path.join(data, 'atlas', atlasId, atlasVersion), data);
    shared = {navigator, runtime: createRuntime(navigator, atlas.manifest.corpusId)};
  }
  const {view} = await shared.runtime.action({type: 'navigate', selector: {...shared.runtime.snapshot().view.atlas.selector, destinationId}});
  assert.equal(view.atlas.selector.destinationId, destinationId);
  // Split as the browser does (paperAccessRows in web/app.js): outgoing source questions form the paper group.
  const first = new Map(); for (const relation of view.atlas.connections) if (!first.has(relation.destinationId)) first.set(relation.destinationId, relation);
  const paperIds = new Set([...first.values()].filter(relation => relation.navigationKind === 'source_question' && relation.traversal === 'outgoing').map(relation => `connection:${relation.id}`));
  const topics = view.directions.filter(direction => !paperIds.has(direction.id));
  // Runs exactly as renderColumns forms its groups.
  const runs = []; for (const direction of topics) { const family = choiceFamily(direction); if (runs.at(-1)?.family === family) runs.at(-1).members.push(direction); else runs.push({family, members: [direction]}); }
  return {view, topics, runs, paperIds, distinctTargets: first.size, navigator: shared.navigator};
}
const headings = runs => runs.map(run => choiceGroupHeading(run.family, run.members));

test('each family is one contiguous run, so grouping keeps the selector’s order, numbering and IDs', async () => {
  for (const id of [ID.darkSectors, ID.extraDims, ID.lab, ID.leaf, ID.lz]) {
    const {topics, runs} = await open(id);
    assert.equal(new Set(runs.map(run => run.family)).size, runs.length, `${id}: no family is split into two groups`);
    assert.deepEqual(runs.flatMap(run => run.members.map(direction => direction.id)), topics.map(direction => direction.id), `${id}: same IDs in the same order`);
    for (const direction of topics) assert.match(direction.id, /^connection:/);
  }
});

test('the ordinary control, the convergent pair and the deeply sourced leaf get exact family headings and hidden counts', async () => {
  const control = await open(ID.darkSectors);
  assert.deepEqual(headings(control.runs), ['Narrower topics · 9', 'Sideways · typed relations · 1', 'Sideways · shared sources · 5']);
  assert.equal(control.paperIds.size, 3, 'three paper questions, none among the 15 default choices');
  assert.equal(control.distinctTargets - control.view.directions.length - control.paperIds.size, 1, 'one topic is reachable only through All connections');

  const extra = await open(ID.extraDims);
  assert.deepEqual(headings(extra.runs), ['Narrower topics · 1', 'Sideways · typed relations · 5', 'Broader topics · 1', 'Sideways · shared sources · 4']);
  assert.equal(extra.paperIds.size, 7); assert.equal(extra.view.directions.filter(direction => extra.paperIds.has(direction.id)).length, 4, 'four paper questions shown by default, three behind Show more');

  const lab = await open(ID.lab);
  assert.deepEqual(headings(lab.runs), ['Sideways · typed relations · 3', 'Broader topics · 2', 'Sideways · shared sources · 4']);
  assert.equal(lab.paperIds.size, 9);

  const leaf = await open(ID.leaf);
  assert.deepEqual(headings(leaf.runs), ['Sideways · typed relations · 11', 'Broader topics · 3', 'Sideways · shared sources · 1']);
  assert.equal(leaf.view.atlas.membershipCount, 15); assert.equal(leaf.paperIds.size, 15);
  assert.equal(leaf.distinctTargets - leaf.view.directions.length - leaf.paperIds.size, 1);

  const lz = await open(ID.lz);
  assert.deepEqual(headings(lz.runs), ['Topic listing this paper question · 1']);
  assert.equal(lz.topics[0].selector.destinationId, ID.extraDims);
});

test('typed rows state the recorded direction; organizational rows keep their scope-wide witness count and qualification', async () => {
  const {topics} = await open(ID.extraDims), byId = new Map(topics.map(direction => [direction.id, direction]));
  const premiseIn = byId.get('connection:navigation:kk:pn5'), premiseOut = byId.get('connection:navigation:kk:pn12');
  assert.equal(premiseIn.relation.traversal, 'incoming'); assert.equal(choiceKindLabel(premiseIn), 'premise check · recorded toward this question');
  assert.equal(premiseOut.relation.traversal, 'outgoing'); assert.equal(choiceKindLabel(premiseOut), 'premise check · recorded from this question');
  assert.deepEqual(choiceRoute(premiseIn), {traversal: 'incoming', others: ['shared source access']}, 'other relation kinds to the same destination are named');
  assert.equal(choiceKindLabel(byId.get('connection:navigation:kk:pn7')), 'narrower');
  assert.equal(choiceKindLabel(byId.get('connection:navigation:kk:pn1')), 'broader');
  const lab = byId.get('connection:organizational-access:d84e84a4101f2e6a786347e6');
  assert.equal(choiceKindLabel(lab), 'shared source access');
  assert.deepEqual(choiceRoute(lab), {traversal: 'outgoing', witnesses: 1});
  assert.match(lab.relation.accessNotice, /not containment, equivalence, physical implication or established method applicability/);
  assert.match(choiceGroupNote('organizational', [lab]), /not containment, equivalence, physical implication or method applicability/);
  // A saved choice carries no relations; its cached summary gives the same label.
  const saved = {navigationKind: premiseIn.navigationKind, route: choiceRoute(premiseIn)};
  assert.equal(choiceKindLabel(JSON.parse(JSON.stringify(saved))), choiceKindLabel(premiseIn));
});

test('Extra dimensions and the Laboratory contribution converge on the same LZ source question with its qualification intact', async () => {
  const extra = await open(ID.extraDims);
  const lzLink = extra.view.atlas.connections.find(relation => relation.destinationId === ID.lz);
  assert.equal(lzLink.navigationKind, 'source_question'); assert.equal(lzLink.traversal, 'outgoing');
  assert.ok(extra.paperIds.has(`connection:${lzLink.id}`), 'route A: the LZ question is in the paper group, not among the topics');

  const lab = await open(ID.lab), navigator = lab.navigator;
  const sideways = lab.topics.find(direction => direction.selector.destinationId === ID.extraDims);
  assert.equal(choiceFamily(sideways), 'organizational'); assert.equal(sideways.relation.traversal, 'incoming');
  // Route B: the shared-source route's single scope-wide witness is the LZ paper's own question.
  const proof = await navigator.readRelation(sideways.relation.id);
  assert.equal(proof.organizationalAccess.uniqueWitnessCount, 1); assert.deepEqual(proof.evidenceIds, [ID.lzUnit]);
  assert.equal(navigator.destination(ID.lz).representativeUnitId, ID.lzUnit);
  assert.equal(lab.paperIds.size, 9); assert.ok(!lab.view.atlas.connections.some(relation => relation.destinationId === ID.lz), 'the Laboratory page has no direct link to the LZ question');

  // The laboratory role and its two-review qualification are recorded on the Laboratory scope and remain separate from links.
  const contributions = navigator.sources(ID.lab, {collection: 'contributions', offset: 0, limit: 100}).items.filter(row => row.unitId === ID.lzUnit);
  assert.equal(contributions.length, 1);
  assert.equal(contributions[0].role, 'specializes'); assert.equal(contributions[0].basis, 'description_checked'); assert.equal(contributions[0].paperId, '2609.07138');
  assert.match(contributions[0].qualification, /the reported LZ event remains motivation without established dark-matter attribution/);
  // The paper row on Extra dimensions carries the same role and qualification, read through the shared navigator.
  const [attribution] = (await resolvePaperAttribution(navigator, ID.extraDims, [ID.lz])).values();
  assert.equal(attribution.paperId, '2609.07138');
  assert.deepEqual(attribution.roles.map(role => role.role), ['specializes']);
  assert.deepEqual(attribution.roles[0].qualifications, [contributions[0].qualification]);
});

// Splits a stylesheet into its rules outside any @media block and the rules inside blocks whose query matches `query`.
function mediaSplit(css, query) {
  let base = '', inside = '';
  for (let at = 0; at < css.length;) {
    const start = css.indexOf('@media', at);
    if (start < 0) { base += css.slice(at); break; }
    base += css.slice(at, start);
    const open = css.indexOf('{', start); let depth = 1, end = open + 1;
    while (depth) { if (css[end] === '{') depth++; else if (css[end] === '}') depth--; end++; }
    if (query.test(css.slice(start, open))) inside += css.slice(open + 1, end - 1);
    at = end;
  }
  return {base, inside};
}

test('narrow screens fold each group’s reading note behind its own toggle without rewording it; wider screens keep it shown', async () => {
  // The qualifications are pinned verbatim, so a density change cannot reword or drop them.
  assert.equal(choiceGroupNote('typed', []), 'Each row names its recorded relation and the question it was recorded from. Browsing against that direction does not reverse the relation.');
  assert.equal(choiceGroupNote('listing', []), 'Source access: the topic lists this paper’s own question. This does not make the two questions equivalent.');
  assert.equal(choiceGroupNote('organizational', [{navigationKind: 'shared_source_access'}]), 'Linked because reviewed source questions are shared across both scopes, counted scope-wide. This is not containment, equivalence, physical implication or method applicability.');
  assert.equal(choiceGroupNote('organizational', [{navigationKind: 'collection_access'}]), 'Curated collection access organizes browsing. It does not assert containment, scientific implication, source membership or method applicability.');
  assert.equal(choiceGroupNote('organizational', [{navigationKind: 'shared_source_access'}, {navigationKind: 'collection_access'}]), 'Organizational links (shared reviewed sources or curated collection access), not scientific relations. They do not assert containment, equivalence, implication or method applicability.');
  for (const family of ['narrower', 'broader']) assert.equal(choiceGroupNote(family, []), '', `${family} groups carry no note or toggle`);

  const app = await readFile(new URL('../../web/app.js', import.meta.url), 'utf8');
  // The full note stays in the page as its own element; the toggle names what it controls and its group's heading.
  assert.match(app, /text = el\('p', 'choice-group-note', note\)/);
  assert.match(app, /text\.id = `\$\{groupHeading\.id\}-note`/);
  for (const attribute of [/'aria-controls', text\.id/, /'aria-describedby', groupHeading\.id/, /'aria-expanded', String\(open\)/]) assert.match(app, attribute);
  assert.match(app, /group\.setAttribute\('aria-labelledby', groupHeading\.id\)/, 'the group is still named by its label and count');
  // Regression: `group` is reassigned for each later run, so a toggle must act on its own group, not the last one rendered.
  const handler = app.match(/toggle\.addEventListener\('click', \(\) => \{.*?\}\);/)?.[0];
  assert.ok(handler, 'toggle click handler found');
  assert.match(handler, /noteGroup\.classList/); assert.doesNotMatch(handler, /(^|[^A-Za-z])group\.classList/);

  const {base, inside} = mediaSplit(await readFile(new URL('../../web/styles.css', import.meta.url), 'utf8'), /max-width:\s*760px/);
  // Wider screens: the toggle never shows and nothing hides the note.
  assert.match(base, /\.choice-group-note-toggle \{ display: none; \}/);
  assert.doesNotMatch(base, /\.choice-group-note \{[^}]*display: none/); assert.doesNotMatch(base, /note-open/);
  // Narrow screens: the toggle shows as a 44 px target with an inset focus outline, and only a closed group hides its note.
  assert.match(inside, /\.choice-group-note-toggle \{ display: inline-flex;[^}]*min-height: 44px;/);
  assert.match(inside, /\.choice-group-note-toggle:focus-visible \{ outline-offset: -3px; \}/);
  assert.match(inside, /\.choice-group:not\(\.note-open\) > \.choice-group-note \{ display: none; \}/);
  assert.doesNotMatch(inside, /\.choice-group-heading[^{]*\{[^}]*display: none/, 'group labels and counts are never hidden');
});

test('the collection entrance stays one ungrouped list and the browser groups only prepared choices', async () => {
  const {view} = await open(ID.collection);
  assert.equal(view.directions.length, 15); assert.ok(view.directions.every(direction => direction.navigationKind === 'collection_access'));
  const app = await readFile(new URL('../../web/app.js', import.meta.url), 'utf8');
  assert.match(app, /!topics\.every\(direction => direction\.navigationKind === 'collection_access'\)/);
  assert.match(app, /group\.setAttribute\('role', 'group'\)/);
  assert.match(app, /button\.dataset\.directionId = direction\.id/, 'choice IDs are still the selector’s connection IDs');
});
