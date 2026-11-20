import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {PROJECT_ROOT, createRuntime} from '../../lib/protocol/runtime.mjs';
import {loadAtlas, createAtlasNavigator, createAtlasSourceReader} from '../../lib/geometry/prepared-atlas.mjs';
import {atlasId, atlasVersion} from '../../lib/swampwiki.mjs';
import {sourceContributions} from '../../web/atlas-panel.mjs';

// SW-006: "Open paper question" links in Source contributions are resolved only when their paper group opens. The real panel
// code runs on the frozen release through the shared navigator; a minimal element stand-in replaces the browser DOM, and every
// file the navigator reads is counted.
const LABORATORY = 'q025-candidate-question:64d5f9b67d11b1a4f7f8c113';
const LZ_UNIT = 'unit:04f12a626ec0a647658f6542fc7595e63d90376073441102f08ebefb6114ddc5';
const LZ_DESTINATION = `source-question:${LZ_UNIT.slice(5)}`;
// Read back from the release: fine-lookup-04.json indexes the LZ destination in detail shard destination-details-fine-0102.
const LZ_FILES = ['fine-lookup-04.json', 'destination-details-fine-0102.json'];
const LZ_QUALIFICATION = /the reported LZ event remains motivation without established dark-matter attribution/;
const lookupFile = name => /^(fine-lookup-[0-9a-f]{2}|destination-details-fine-\d{4})\.json$/.test(name);

class Node {
  constructor(tag) { Object.assign(this, {tagName: tag.toUpperCase(), children: [], parent: null, attributes: new Map(), listeners: new Map(), textContent: '', isConnected: true, state: false}); }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  after(...nodes) { const siblings = this.parent.children; for (const node of nodes) node.parent = this.parent; siblings.splice(siblings.indexOf(this) + 1, 0, ...nodes); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.has(key) ? this.attributes.get(key) : null; }
  removeAttribute(key) { this.attributes.delete(key); }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
  // Like <details>: changing open queues one non-bubbling toggle event on this element only.
  get open() { return this.state; }
  set open(value) { if (Boolean(value) === this.state) return; this.state = Boolean(value); setTimeout(() => { for (const listener of this.listeners.get('toggle') || []) listener({type: 'toggle', target: this}); }); }
  *descendants() { for (const child of this.children) { yield child; yield* child.descendants(); } }
  all(test) { return [...this.descendants()].filter(test); }
}
globalThis.document = {createElement: tag => new Node(tag)};
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
async function until(test, label) { for (let i = 0; i < 2000; i++) { const value = test(); if (value) return value; await tick(); } throw new Error(`timed out: ${label}`); }

// A fresh navigator per test, so the shard cache starts cold. `fail` refuses matching files like an unavailable shard.
async function open({fail} = {}) {
  const atlasDir = path.join(PROJECT_ROOT, 'dist/data/atlas', atlasId, atlasVersion), corpusDir = path.join(PROJECT_ROOT, 'dist/data'), reads = [];
  const readText = async filename => { const name = path.basename(filename); reads.push(name); if (fail?.test(name)) throw new Error(`refused ${name}`); return readFile(filename, 'utf8'); };
  const readers = {readText, readBinary: filename => readFile(filename)};
  const atlas = await loadAtlas(atlasDir, {readText});
  const navigator = createAtlasNavigator(atlas, {readSources: createAtlasSourceReader(atlas, {base: corpusDir, ...readers})});
  await navigator.prepareState?.(navigator.initialState);
  const runtime = createRuntime(navigator, atlas.manifest.corpusId);
  const {view} = await runtime.action({type: 'navigate', selector: {...runtime.snapshot().view.atlas.selector, destinationId: LABORATORY}});
  assert.equal(view.atlas.selector.destinationId, LABORATORY);
  return {navigator, view, reads, readSources: createAtlasSourceReader(atlas, {base: corpusDir, ...readers})};
}
// One rendering of the Source contributions panel, opened as a reader would open it.
async function panel({navigator, view, readSources}, navigations = []) {
  const errors = [], host = sourceContributions(view.atlas.destination, navigator, readSources, message => errors.push(message), undefined, {selector: view.atlas.selector, onNavigate: payload => navigations.push(payload)});
  host.open = true;
  await until(() => /19 of 19 review observations loaded/.test(host.children.find(node => node.tagName === 'P' && /review observations loaded/.test(node.textContent))?.textContent || ''), 'contributions page');
  const groups = host.children.find(node => node.tagName === 'DIV').children;
  const rows = () => host.all(node => node.tagName === 'ARTICLE');
  const links = () => host.all(node => node.tagName === 'A' && node.className === 'contribution-question');
  const lzGroup = groups.find(group => group.all(node => node.tagName === 'SMALL' && node.textContent.endsWith(LZ_UNIT)).length);
  const settled = () => !rows().some(row => row.getAttribute('data-paper-question') === 'resolving');
  return {host, groups, rows, links, lzGroup, settled, errors};
}
const status = rows => rows.map(row => row.getAttribute('data-paper-question'));

test('opening Source contributions requests no paper-question lookups; opening the LZ group requests only its own', async () => {
  const context = await open(), navigations = [], before = context.reads.length;
  const view = await panel(context, navigations);
  assert.equal(view.groups.length, 19, 'nineteen paper groups');
  assert.ok(view.groups.every(group => !group.open), 'every group starts closed');
  assert.deepEqual(context.reads.slice(before).filter(lookupFile), [], 'no lookup or detail shard is read for closed groups');
  assert.deepEqual([...new Set(status(view.rows()))], ['pending']);
  assert.equal(view.links().length, 0);

  const mark = context.reads.length;
  view.lzGroup.open = true;
  await until(() => view.lzGroup.getAttribute('aria-busy') === 'true', 'busy while resolving');
  await until(view.settled, 'LZ lookup');
  assert.deepEqual(context.reads.slice(mark), LZ_FILES, 'only the LZ lookup bucket and its detail shard');
  assert.equal(view.lzGroup.getAttribute('aria-busy'), null);
  const lzRow = view.lzGroup.all(node => node.tagName === 'ARTICLE')[0], [link] = view.links();
  assert.equal(lzRow.getAttribute('data-paper-question'), 'resolved');
  assert.equal(view.links().length, 1, 'one link, in the opened group');
  assert.equal(link.href, `/#atlas=${atlasId}&version=${atlasVersion}&destination=${encodeURIComponent(LZ_DESTINATION)}`);
  assert.match(link.getAttribute('aria-label'), /^Open paper question: Can distant-brane symmetry breaking/);
  assert.equal(context.navigator.destination(LZ_DESTINATION).representativeUnitId, LZ_UNIT);
  // The role, basis and qualification stay beside the link.
  assert.equal(lzRow.children[0].textContent, 'Specializes this scope');
  assert.ok(lzRow.all(node => node.tagName === 'P').some(node => LZ_QUALIFICATION.test(node.textContent)));
  assert.ok(lzRow.all(node => node.tagName === 'P').some(node => /Extracted description checked/.test(node.textContent)));
  assert.equal(status(view.rows()).filter(value => value === 'pending').length, 18, 'the other 18 groups stay unrequested');
  // A plain click navigates in place to the exact destination.
  for (const listener of link.listeners.get('click')) listener({button: 0, preventDefault() {}});
  assert.deepEqual(navigations.map(payload => payload.selector.destinationId), [LZ_DESTINATION]);

  // Closing and reopening the group draws no second link and reads nothing.
  const again = context.reads.length;
  view.lzGroup.open = false; await tick(); view.lzGroup.open = true; await tick(); await until(view.settled, 'reopen');
  assert.equal(context.reads.length, again);
  assert.equal(view.links().length, 1);

  // Back re-renders the panel; the navigator keeps the checked record, so reopening the LZ group reads nothing.
  const back = context.reads.length, rerendered = await panel(context);
  rerendered.lzGroup.open = true; await until(() => rerendered.links().length === 1, 'link after re-render');
  assert.deepEqual(context.reads.slice(back).filter(lookupFile), []);
  assert.equal(rerendered.links()[0].href, link.href);
  assert.deepEqual(view.errors, []);
});

test('each opened group resolves its own rows to the destination recorded for its exact unit', async () => {
  const context = await open(), view = await panel(context);
  for (const group of view.groups) group.open = true;
  await until(() => view.rows().every(row => row.getAttribute('data-paper-question') === 'resolved'), 'all groups');
  assert.equal(view.links().length, 19);
  for (const row of view.rows()) {
    const unitId = row.children.find(node => node.tagName === 'SMALL').textContent.split(' · ').pop(), link = row.all(node => node.className === 'contribution-question')[0];
    const destinationId = new URLSearchParams(link.href.slice(2)).get('destination');
    assert.equal(context.navigator.destination(destinationId).representativeUnitId, unitId);
    assert.notEqual(destinationId, LABORATORY);
  }
  assert.ok(view.groups.every(group => group.getAttribute('aria-busy') === null));
});

test('a failed lookup leaves the LZ paper, its role and qualification reachable, draws no link and affects no other group', async () => {
  const context = await open({fail: /^destination-details-fine-0102\.json$/}), view = await panel(context);
  const lzRow = view.lzGroup.all(node => node.tagName === 'ARTICLE')[0];
  view.lzGroup.open = true;
  await until(() => !['pending', 'resolving'].includes(lzRow.getAttribute('data-paper-question')), 'failed lookup');
  assert.equal(lzRow.getAttribute('data-paper-question'), 'unresolved');
  assert.equal(view.links().length, 0, 'no link is drawn for a failed lookup');
  assert.ok(context.reads.includes('destination-details-fine-0102.json'), 'the refused shard was requested');
  assert.equal(view.lzGroup.getAttribute('aria-busy'), null);
  const paper = view.lzGroup.children.find(node => node.tagName === 'A');
  assert.equal(paper.textContent, 'Read paper');
  assert.equal(paper.href, 'https://arxiv.org/abs/2609.07138');
  assert.ok(lzRow.all(node => node.tagName === 'P').some(node => LZ_QUALIFICATION.test(node.textContent)));
  assert.deepEqual(view.errors, [], 'a failed lookup is not reported as a panel error');
  // Another group still resolves.
  const other = view.groups.find(group => group !== view.lzGroup);
  other.open = true; await until(() => other.all(node => node.className === 'contribution-question').length === 1, 'other group');
});
