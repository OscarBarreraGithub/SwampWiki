import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {PROJECT_ROOT, createRuntime, loadLocalAtlas} from '../../lib/protocol/runtime.mjs';
import {atlasId, atlasVersion} from '../../lib/swampwiki.mjs';
import {resolvePaperAttribution, nextPaperAttributionBatch, paperGroupTitle, paperGroupProgress, PAPER_ATTRIBUTION_LIMIT} from '../../web/atlas-panel.mjs';

const TOPIC = 'q025-candidate-question:b6a72d6d11c8f9c783284067';
const sourceQuestionLinks = view => {
  const first = new Map(); for (const relation of view.atlas.connections) if (!first.has(relation.destinationId)) first.set(relation.destinationId, relation);
  return [...first.values()].filter(relation => relation.navigationKind === 'source_question' && relation.traversal === 'outgoing');
};
let shared;
async function openDestination(destinationId) {
  if (!shared) {
    const data = path.join(PROJECT_ROOT, 'dist/data');
    const {atlas, navigator} = await loadLocalAtlas(path.join(data, 'atlas', atlasId, atlasVersion), data);
    shared = {navigator, runtime: createRuntime(navigator, atlas.manifest.corpusId)};
  }
  const {view} = await shared.runtime.action({type: 'navigate', selector: {...shared.runtime.snapshot().view.atlas.selector, destinationId}});
  assert.equal(view.atlas.selector.destinationId, destinationId);
  // The same rows the browser lists (paperAccessRows in web/app.js).
  const rows = sourceQuestionLinks(view).map(link => ({id: `connection:${link.id}`, destinationId: link.destinationId, label: link.choiceTitle || link.title}));
  return {view, rows, navigator: shared.navigator, shownIds: new Set(view.directions.map(direction => direction.id))};
}
const attributed = (rows, resolved) => rows.map(row => resolved.has(row.destinationId) ? {...row, ...resolved.get(row.destinationId)} : row);
function countingNavigator(navigator) {
  const seen = {inFlight: 0, peak: 0, calls: 0};
  return {seen, navigator: {...navigator, prepareDestination: async id => { seen.inFlight++; seen.calls++; seen.peak = Math.max(seen.peak, seen.inFlight); try { return await navigator.prepareDestination(id); } finally { seen.inFlight--; } }}};
}

// The frozen release has three groups beyond one batch. Each count below is read from the frozen records via the shared navigator.
// shown: rows among the 15 default choices (the folded group lists only these); shownPapers: their distinct papers.
const LARGE_GROUPS = [
  {id: 'q025-candidate-region:839da90831bec9d6ef0a811b', links: 67, shown: 7, shownPapers: 7, papers: 60},
  {id: 'q025-candidate-region:cea1d45ac3ad0a880f6e9112', links: 53, shown: 6, shownPapers: 6, papers: 43},
  {id: 'q025-candidate-region:efd12be51c621b776d6028c4', links: 50, shown: 7, shownPapers: 7, papers: 49},
];
// Every batch the expanded group would request, in order, attributing each as it goes.
async function expandAll(navigator, parentId, rows, shownIds, attempted, resolved) {
  const sizes = [];
  for (let batch = nextPaperAttributionBatch(rows, {shownIds, attempted, expanded: true}); batch.length; batch = nextPaperAttributionBatch(rows, {shownIds, attempted, expanded: true})) {
    assert.equal(batch.filter(id => attempted.has(id)).length, 0, 'a link already tried is never requested again');
    sizes.push(batch.length); for (const [id, row] of await resolvePaperAttribution(navigator, parentId, batch)) resolved.set(id, row); for (const id of batch) attempted.add(id);
  }
  return sizes;
}

test('the folded 67-question group identifies only its shown rows; Show more makes the 67/60 heading exact', async () => {
  const [group] = LARGE_GROUPS, {rows, navigator, shownIds} = await openDestination(group.id);
  assert.equal(PAPER_ATTRIBUTION_LIMIT, 48);
  assert.equal(rows.length, 67, 'Compactification geometry, gauge sectors and consistency lists 67 paper questions');
  const shown = rows.filter(row => shownIds.has(row.id)), hidden = rows.filter(row => !shownIds.has(row.id));
  assert.equal(shown.length, 7, 'seven of them are among the 15 default choices');

  // Folded view: exactly the seven shown rows; the 60 behind "Show more" make no request.
  const first = nextPaperAttributionBatch(rows, {shownIds});
  assert.deepEqual(first, shown.map(row => row.destinationId));
  for (const row of hidden) assert.ok(!first.includes(row.destinationId), 'a hidden row is not attributed before Show more');
  const counted = countingNavigator(navigator);
  const firstResolved = await resolvePaperAttribution(counted.navigator, group.id, first);
  assert.ok(counted.seen.peak <= 4, `at most 4 destinations load at once (saw ${counted.seen.peak})`);
  assert.equal(counted.seen.calls, 7, 'the folded view loads only the seven shown destinations');
  assert.equal(firstResolved.size, 7);
  const attempted = new Set(first), partial = attributed(rows, firstResolved);

  // The question count stays exact; the paper count of the shown rows is a lower bound and says so.
  assert.equal(paperGroupTitle(partial), 'Paper questions · 67 from at least 7 papers');
  assert.equal(paperGroupProgress(partial, {attempted}), 'Papers identified for 7 of 67 questions so far; the paper count is partial. Showing all paper questions identifies the other 60.');
  assert.equal(paperGroupProgress(partial, {attempted, loading: true}), 'Identifying papers… 7 of 67 questions so far; the paper count is partial.');
  assert.deepEqual(nextPaperAttributionBatch(rows, {shownIds, attempted}), [], 'nothing further loads until the reader asks for every paper question');

  // "Show more": the remaining 60 in bounded batches (48 + 12), never repeating a link already tried.
  const all = new Map(firstResolved);
  assert.deepEqual(await expandAll(counted.navigator, group.id, rows, shownIds, attempted, all), [48, 12]);
  assert.ok(counted.seen.peak <= 4);
  const complete = attributed(rows, all);
  assert.equal(all.size, 67, 'every one of the 67 questions resolves to its recorded unit');
  assert.equal(paperGroupTitle(complete), 'Paper questions · 67 from 60 papers');
  assert.equal(paperGroupProgress(complete, {attempted, expanded: true}), '');
  for (const row of complete) {
    // Source records stay reachable: each row keeps its question link and gains its paper's frozen record.
    assert.ok(row.id.startsWith('connection:') && row.destinationId.startsWith('source-question:'));
    const record = navigator.destination(row.destinationId), [source] = navigator.getEvidence([record.representativeUnitId]);
    assert.equal(row.unitId, record.representativeUnitId); assert.equal(row.paperId, source.paperId);
    assert.match(row.url, /^https:\/\//, `${row.paperId} keeps its primary-source link`);
  }
});

test('after Show more on the 67-question group, the first revealed paper is reported after at most four loads, before its batch of 48 ends', async () => {
  const [group] = LARGE_GROUPS, {rows, navigator, shownIds} = await openDestination(group.id);
  const batch = nextPaperAttributionBatch(rows, {shownIds, attempted: new Set(nextPaperAttributionBatch(rows, {shownIds})), expanded: true});
  assert.equal(batch.length, 48, 'the first batch after Show more holds 48 of the 60 revealed rows');
  const counted = countingNavigator(navigator), reports = [];
  const resolved = await resolvePaperAttribution(counted.navigator, group.id, batch, {onResolved: (id, row) => reports.push({id, row, loadsStarted: counted.seen.calls})});
  assert.ok(reports[0].loadsStarted <= 4, `the first revealed paper is reported after at most 4 destination loads started (saw ${reports[0].loadsStarted}), not after all 48`);
  assert.ok(batch.slice(0, 4).includes(reports[0].id), 'it is one of the first revealed rows in display order');
  assert.equal(reports.length, 48, 'every link in the batch is reported once');
  assert.equal(new Set(reports.map(report => report.id)).size, 48);
  for (const {id, row} of reports) assert.deepEqual(row, resolved.get(id), 'each early report equals the batch result');
});

test('the 53- and 50-question groups also state a lower bound until every question is identified', async () => {
  for (const group of LARGE_GROUPS.slice(1)) {
    const {rows, navigator, shownIds} = await openDestination(group.id);
    assert.equal(rows.length, group.links);
    const first = nextPaperAttributionBatch(rows, {shownIds}), firstResolved = await resolvePaperAttribution(navigator, group.id, first);
    assert.equal(first.length, group.shown); assert.equal(firstResolved.size, group.shown);
    assert.deepEqual(first, rows.filter(row => shownIds.has(row.id)).map(row => row.destinationId), 'only the shown rows');
    assert.equal(paperGroupTitle(attributed(rows, firstResolved)), `Paper questions · ${group.links} from at least ${group.shownPapers} papers`);
    const attempted = new Set(first), all = new Map(firstResolved);
    assert.deepEqual(await expandAll(navigator, group.id, rows, shownIds, attempted, all), [group.links - group.shown]);
    assert.equal(all.size, group.links);
    assert.equal(paperGroupTitle(attributed(rows, all)), `Paper questions · ${group.links} from ${group.papers} papers`);
  }
});

test('a group with every paper question folded makes no request until Show more, then reads 14 from 12 papers', async () => {
  const {rows, navigator, shownIds} = await openDestination(TOPIC);
  assert.equal(rows.length, 14);
  assert.equal(rows.filter(row => shownIds.has(row.id)).length, 0, 'none of the 14 is among the default choices');
  assert.deepEqual(nextPaperAttributionBatch(rows, {shownIds}), [], 'folded: no attribution request at all');
  // Nothing identified or tried: the heading carries no paper count and no progress claim is made.
  assert.equal(paperGroupTitle(rows), 'Paper questions · 14', 'before identification the heading carries no paper count');
  assert.equal(paperGroupProgress(rows, {}), '');
  assert.equal(paperGroupProgress(rows, {loading: true}), '', 'nothing identified yet: no progress claim');
  const batch = nextPaperAttributionBatch(rows, {shownIds, expanded: true});
  assert.equal(batch.length, 14, 'Show more asks for all 14 in one batch');
  const resolved = await resolvePaperAttribution(navigator, TOPIC, batch), complete = attributed(rows, resolved);
  assert.equal(paperGroupTitle(complete), 'Paper questions · 14 from 12 papers');
  assert.equal(paperGroupProgress(complete, {attempted: new Set(batch), expanded: true}), '');
  assert.deepEqual(nextPaperAttributionBatch(rows, {shownIds, attempted: new Set(batch), expanded: true}), []);
});

test('Laboratory identifies its six shown paper questions at once and defers the three hidden ones', async () => {
  const LAB = 'q025-candidate-question:64d5f9b67d11b1a4f7f8c113', {view, rows, navigator, shownIds} = await openDestination(LAB);
  assert.equal(view.atlas.destination.title, 'Laboratory and propagation tests');
  assert.equal(rows.length, 9);
  const shown = rows.filter(row => shownIds.has(row.id));
  assert.equal(shown.length, 6);
  const first = nextPaperAttributionBatch(rows, {shownIds});
  assert.deepEqual(first, shown.map(row => row.destinationId), 'visible rows keep immediate attribution');
  const counted = countingNavigator(navigator), firstResolved = await resolvePaperAttribution(counted.navigator, LAB, first);
  assert.equal(counted.seen.calls, 6, 'three fewer destination loads than the nine paper questions');
  const attempted = new Set(first), partial = attributed(rows, firstResolved);
  assert.equal(paperGroupTitle(partial), 'Paper questions · 9 from at least 6 papers');
  assert.equal(paperGroupProgress(partial, {attempted}), 'Papers identified for 6 of 9 questions so far; the paper count is partial. Showing all paper questions identifies the other 3.');
  const all = new Map(firstResolved);
  assert.deepEqual(await expandAll(navigator, LAB, rows, shownIds, attempted, all), [3]);
  // Nine questions from nine papers: the exact heading names no separate paper count (paperGroupTitle).
  assert.equal(paperGroupTitle(attributed(rows, all)), 'Paper questions · 9');
});

test('nextPaperAttributionBatch: folded asks only for shown rows (bounded); expanded adds the rest after them', () => {
  const rows = Array.from({length: 60}, (_, index) => ({id: `connection:${index}`, destinationId: `source-question:${index}`}));
  const shownIds = new Set(rows.slice(50).map(row => row.id));
  assert.deepEqual(nextPaperAttributionBatch(rows, {shownIds}), rows.slice(50).map(row => row.destinationId));
  assert.deepEqual(nextPaperAttributionBatch(rows, {shownIds: new Set()}), []);
  const expanded = nextPaperAttributionBatch(rows, {shownIds, expanded: true});
  assert.equal(expanded.length, PAPER_ATTRIBUTION_LIMIT);
  assert.deepEqual(expanded.slice(0, 10), rows.slice(50).map(row => row.destinationId), 'shown rows first');
  assert.deepEqual(nextPaperAttributionBatch(rows, {shownIds, expanded: true, limit: 4, attempted: new Set(rows.slice(50).map(row => row.destinationId))}), rows.slice(0, 4).map(row => row.destinationId));
});

test('source-question rows on the EFT completion topic resolve to 12 papers through the shared navigator', async () => {
  const data = path.join(PROJECT_ROOT, 'dist/data');
  const {atlas, navigator} = await loadLocalAtlas(path.join(data, 'atlas', atlasId, atlasVersion), data);
  const runtime = createRuntime(navigator, atlas.manifest.corpusId);
  const {view} = await runtime.action({type: 'navigate', selector: {...runtime.snapshot().view.atlas.selector, destinationId: TOPIC}});
  assert.equal(view.atlas.selector.destinationId, TOPIC);
  const links = sourceQuestionLinks(view);
  assert.equal(links.length, 14);

  // The defect being repaired: an exact-text join against the bounded sample of source descriptions finds only 9 papers.
  const byText = links.map(link => view.nodes.filter(node => (node.evidence?.text ?? node.label) === (link.choiceTitle || link.title))).filter(matches => matches.length === 1);
  assert.equal(new Set(byText.map(([node]) => node.paperId)).size, 9);

  let inFlight = 0, peak = 0;
  const counted = {...navigator, prepareDestination: async id => { inFlight++; peak = Math.max(peak, inFlight); try { return await navigator.prepareDestination(id); } finally { inFlight--; } }};
  const resolved = await resolvePaperAttribution(counted, TOPIC, links.map(link => link.destinationId), {concurrency: 4});
  assert.ok(peak <= 4, `at most 4 destinations load at once (saw ${peak})`);
  assert.equal(resolved.size, 14, 'every source-question row is attributed');
  const papers = new Set([...resolved.values()].map(row => row.paperId));
  assert.equal(papers.size, 12);
  for (const paperId of ['2011.00051', '2011.06610', '2007.13757']) assert.ok(papers.has(paperId), `restores ${paperId}`);

  const all = collection => { const rows = []; for (let offset = 0; ; ) { const page = navigator.sources(TOPIC, {collection, offset, limit: 100}); rows.push(...page.items); offset += page.items.length; if (!page.items.length || offset >= page.total) return rows; } };
  const members = new Set(all('membership').filter(row => !row.associationScope).map(row => row.unitId)), contributions = {items: all('contributions')};
  for (const [destinationId, row] of resolved) {
    // Identity comes from the recorded representative unit and its frozen source record, nothing else.
    const record = navigator.destination(destinationId), [source] = navigator.getEvidence([record.representativeUnitId]);
    assert.equal(row.unitId, record.representativeUnitId);
    assert.equal(row.paperId, source.paperId);
    assert.equal(row.listed, members.has(row.unitId), 'membership is read from the parent topic’s complete primary membership');
    assert.equal(new Set(row.roles.map(role => role.role)).size, row.roles.length, 'each reviewed role is listed once');
    const recorded = contributions.items.filter(item => item.unitId === row.unitId);
    assert.deepEqual(new Set(row.roles.map(role => role.role)), new Set(recorded.map(item => item.role)));
  }
  const rowsFor = paperId => [...resolved.values()].filter(row => row.paperId === paperId);
  for (const paperId of ['2011.00051', '2011.06610']) for (const row of rowsFor(paperId)) assert.deepEqual(row.roles, [], `${paperId} has no recorded role`);
  const specialized = rowsFor('2007.13757');
  assert.ok(specialized.length >= 1);
  for (const row of specialized) {
    assert.deepEqual(row.roles.map(role => role.role), ['specializes']);
    const [role] = row.roles;
    assert.ok(role.bases.includes('description_checked'));
    assert.equal(role.qualifications.length, 1, 'repeated observations with the same qualification collapse to one');
    assert.match(role.qualifications[0], /Neither the charged sources nor the compactification obstruction is specified well enough for a fine identity/, `the recorded underspecification stays attached to the role (${row.unitId})`);
  }
});

// A synthetic navigator: two source questions with the same text, ID suffixes that name other units, and repeated reviews.
function fixtureNavigator({onPrepare = () => {}} = {}) {
  const unitA = `unit:${'a'.repeat(64)}`, unitB = `unit:${'b'.repeat(64)}`, unitC = `unit:${'c'.repeat(64)}`;
  const destinations = {
    [`source-question:${'b'.repeat(64)}`]: {representativeUnitId: unitA}, // suffix names unit B; the record names A
    [`source-question:${'a'.repeat(64)}`]: {representativeUnitId: unitB},
    [`source-question:${'d'.repeat(64)}`]: {representativeUnitId: unitC},
    'source-question:unreadable': {representativeUnitId: unitA},
  };
  const sources = {[unitA]: {id: unitA, paperId: '2101.00001', title: 'Paper A', sourceUrl: 'https://arxiv.org/abs/2101.00001'}, [unitB]: {id: unitB, paperId: '2101.00002', title: 'Paper B', sourceUrl: 'https://arxiv.org/abs/2101.00002'}, [unitC]: {id: unitC, paperId: '2101.00003', title: 'Paper C'}};
  const qualification = 'Premises remain unspecified for this target.';
  const membership = [{unitId: unitA, weight: 1}, {unitId: unitC, weight: .5, associationScope: 'same_paper_context'}];
  const contributions = [
    {unitId: unitB, role: 'specializes', basis: 'description_checked', qualification},
    {unitId: unitB, role: 'specializes', basis: 'description_checked', qualification},
    {unitId: unitB, role: 'specializes', basis: 'source_excerpt_checked'},
    {unitId: unitB, role: 'boundary', basis: 'description_checked'},
  ];
  const page = (rows, offset, limit) => ({total: rows.length, items: rows.slice(offset, offset + limit)});
  return {unitA, unitB, unitC, qualification, navigator: {
    prepareSources: async () => {},
    prepareDestination: async id => { await onPrepare(id); if (id === 'source-question:unreadable') throw new Error('checksum mismatch'); },
    destination: id => structuredClone(destinations[id]),
    getEvidence: ids => ids.map(id => sources[id] ? structuredClone(sources[id]) : {id, error: 'not bundled'}),
    sources: (id, {collection = 'membership', offset = 0, limit = 30}) => collection === 'contributions' ? page(contributions, offset, limit) : page(membership, offset, limit),
  }};
}

test('duplicate question text, misleading ID suffixes and repeated reviews do not change paper attribution', async () => {
  const {navigator, unitA, unitB, unitC, qualification} = fixtureNavigator();
  const ids = [`source-question:${'b'.repeat(64)}`, `source-question:${'a'.repeat(64)}`, `source-question:${'d'.repeat(64)}`, 'source-question:unreadable'];
  const resolved = await resolvePaperAttribution(navigator, 'topic', ids);
  // Both questions could carry the same text; each still resolves to its own recorded unit and paper.
  assert.equal(resolved.get(ids[0]).unitId, unitA); assert.equal(resolved.get(ids[0]).paperId, '2101.00001');
  assert.equal(resolved.get(ids[1]).unitId, unitB); assert.equal(resolved.get(ids[1]).paperId, '2101.00002');
  assert.equal(resolved.get(ids[2]).unitId, unitC);
  assert.equal(resolved.has(ids[3]), false, 'one unreadable link stays unattributed without failing the others');
  // Membership: a primary row counts; a same-paper context row does not.
  assert.equal(resolved.get(ids[0]).listed, true); assert.equal(resolved.get(ids[2]).listed, false); assert.equal(resolved.get(ids[1]).listed, false);
  // Repeated observations collapse to one role, keeping each distinct basis and the identical qualification text once.
  assert.deepEqual(resolved.get(ids[1]).roles, [
    {role: 'specializes', bases: ['description_checked', 'source_excerpt_checked'], qualifications: [qualification]},
    {role: 'boundary', bases: ['description_checked'], qualifications: []},
  ]);
  assert.deepEqual(resolved.get(ids[0]).roles, []);
  // A link that cannot be identified keeps the count a lower bound and says so; the question itself stays listed.
  const rows = ids.map((destinationId, index) => ({id: `connection:${index}`, destinationId})), partial = rows.map(row => resolved.has(row.destinationId) ? {...row, ...resolved.get(row.destinationId)} : row);
  assert.equal(paperGroupTitle(partial), 'Paper questions · 4 from at least 3 papers');
  assert.equal(paperGroupProgress(partial, {attempted: new Set(ids), expanded: true}), 'Papers identified for 3 of 4 questions; 1 could not be identified here, so the paper count is a lower bound. Each question still opens its own source record.');
});

test('each link is reported as soon as it is identified, before the rest of its batch; a changed path stops the reports', async () => {
  const gates = new Map(), tick = () => new Promise(resolve => setImmediate(resolve));
  const {navigator} = fixtureNavigator({onPrepare: id => new Promise(resolve => gates.set(id, resolve))});
  const ids = [`source-question:${'b'.repeat(64)}`, `source-question:${'a'.repeat(64)}`, `source-question:${'d'.repeat(64)}`, 'source-question:unreadable'];
  const reports = [], report = (id, row) => reports.push([id, row ? row.paperId : null]);
  let settled = false;
  const batch = resolvePaperAttribution(navigator, 'topic', ids, {concurrency: 2, onResolved: report}).then(value => { settled = true; return value; });
  await tick();
  assert.deepEqual([...gates.keys()], ids.slice(0, 2), 'two links load at once, in display order');
  gates.get(ids[1])(); await tick();
  assert.deepEqual(reports, [[ids[1], '2101.00002']], 'the second link shows its paper while the first is still loading');
  assert.equal(settled, false, 'its batch has not finished');
  gates.get(ids[0])(); await tick();
  assert.deepEqual(reports.map(([id]) => id), [ids[1], ids[0]], 'reports follow identification, not batch completion'); assert.equal(settled, false);
  gates.get(ids[2])(); gates.get(ids[3])();
  const resolved = await batch;
  assert.deepEqual(reports, [[ids[1], '2101.00002'], [ids[0], '2101.00001'], [ids[2], '2101.00003'], [ids[3], null]], 'an unreadable link is reported as not identified');
  assert.equal(resolved.size, 3);

  // The path changes after one report: nothing more is reported or loaded, and the batch is discarded.
  gates.clear(); reports.length = 0; let current = true;
  const stale = resolvePaperAttribution(navigator, 'topic', ids, {concurrency: 1, isCurrent: () => current, onResolved: report});
  await tick(); gates.get(ids[0])(); await tick();
  assert.deepEqual(reports, [[ids[0], '2101.00001']]);
  current = false; gates.get(ids[1])();
  assert.equal(await stale, null);
  assert.equal(reports.length, 1, 'no report after the path changed');
  assert.equal(gates.size, 2, 'no further link starts loading');
});

test('attribution loading is bounded and discarded when the path changes', async () => {
  let prepared = 0, current = true;
  const {navigator} = fixtureNavigator({onPrepare: () => { prepared++; current = false; }});
  const ids = [`source-question:${'b'.repeat(64)}`, `source-question:${'a'.repeat(64)}`, `source-question:${'d'.repeat(64)}`];
  assert.equal(await resolvePaperAttribution(navigator, 'topic', ids, {concurrency: 1, isCurrent: () => current}), null);
  assert.equal(prepared, 1, 'no further destination loads after the path changed');
  prepared = 0; current = true;
  const bounded = await resolvePaperAttribution(fixtureNavigator({onPrepare: () => { prepared++; }}).navigator, 'topic', ids, {limit: 2});
  assert.equal(prepared, 2); assert.equal(bounded.size, 2);
});

test('the browser resolves paper questions through the shared navigator, not by matching question text', async () => {
  const app = await readFile(new URL('../../web/app.js', import.meta.url), 'utf8');
  assert.match(app, /resolvePaperAttribution\(loaded\.navigator/);
  assert.doesNotMatch(app, /evidence\?\.text \?\? node\.label\) === label/);
  // Headings come from paperGroupTitle only, and a step change drops identification still running for the previous step.
  assert.doesNotMatch(app, /from \$\{paperCount\} papers/);
  assert.match(app, /if \(!sameStep\) \{ expandedPaperStep = null; paperAttributionTask = null; \}/);
  // Each identified row applies at once, only while its step is current; the live progress line is busy while a batch runs.
  assert.match(app, /resolvePaperAttribution\(loaded\.navigator, parentId, batch, \{isCurrent, onResolved\}\)/);
  assert.match(app, /const onResolved = \(id, row\) => \{ if \(!isCurrent\(\)\) return;/);
  assert.match(app, /if \(value\?\.loading\) progressLine\.setAttribute\('aria-busy', 'true'\); else progressLine\.removeAttribute\('aria-busy'\);/);
});
