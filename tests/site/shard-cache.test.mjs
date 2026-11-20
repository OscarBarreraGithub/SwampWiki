import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {PROJECT_ROOT} from '../../lib/protocol/runtime.mjs';
import {loadAtlas, createAtlasNavigator} from '../../lib/geometry/prepared-atlas.mjs';
import {currentState} from '../../lib/protocol/session.mjs';
import {atlasId, atlasVersion} from '../../lib/swampwiki.mjs';
import {retainVerifiedShards, SHARD_CACHE_BYTES} from '../../web/physics-path.mjs';
import {resolvePaperAttribution, nextPaperAttributionBatch} from '../../web/atlas-panel.mjs';

// SW-006: the browser keeps recently used verified shards (up to SHARD_CACHE_BYTES of declared, checked size) in front of the
// atlas's own checksummed reader, whose 16-shard first-in-first-out memo dropped shards that a later paper-question row needed.

const descriptor = (name, bytes = 100, sha = name) => ({path: `${name}.json`, sha256: sha.padEnd(64, '0'), bytes});
function fakeReader() {
  const calls = [], pending = new Map();
  // Each read stays open until the test settles it, so ordering and failures are explicit.
  const readShard = d => { calls.push(d.path); return new Promise((resolve, reject) => { const list = pending.get(d.path) || []; list.push({resolve, reject}); pending.set(d.path, list); }); };
  const settle = (name, error) => { const next = pending.get(`${name}.json`)?.shift(); assert.ok(next, `no open read for ${name}`); if (error) next.reject(error); else next.resolve({name}); };
  return {calls, settle, atlas: {manifest: {atlasId: 'fake'}, readShard}};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('a repeated descriptor is read once and every caller gets the same verified result', async () => {
  const {calls, settle, atlas} = fakeReader(), cached = retainVerifiedShards(atlas, {maxBytes: 1000}), a = descriptor('a');
  const first = cached.readShard(a), concurrent = cached.readShard(a);
  assert.equal(first, concurrent, 'concurrent requests share one read');
  settle('a');
  const [x, y] = await Promise.all([first, concurrent]), later = await cached.readShard({...a});
  assert.equal(x, y); assert.equal(later, x, 'a later identical descriptor reuses the read');
  assert.deepEqual(calls, ['a.json']);
  assert.equal(cached.shardCache.heldBytes, 100); assert.equal(cached.shardCache.size, 1);
  assert.equal(cached.manifest, atlas.manifest, 'the rest of the atlas is unchanged');
});

test('least recently used shards leave first and the held bytes never exceed the bound', async () => {
  const {calls, settle, atlas} = fakeReader(), cached = retainVerifiedShards(atlas, {maxBytes: 300});
  const read = async name => { const before = calls.length, p = cached.readShard(descriptor(name)); if (calls.length > before) settle(name); const value = await p; assert.ok(cached.shardCache.heldBytes <= 300); return value; };
  for (const name of ['a', 'b', 'c']) await read(name);
  await read('a');                          // a becomes most recent: b is now the oldest
  await read('d');                          // over budget: b leaves
  assert.deepEqual(calls, ['a.json', 'b.json', 'c.json', 'd.json']);
  await read('a');                          // still held
  assert.equal(calls.length, 4);
  await read('b');                          // evicted earlier, so read again; c (oldest) leaves
  assert.deepEqual(calls.slice(4), ['b.json']);
  await read('c');
  assert.deepEqual(calls.slice(5), ['c.json'], 'c was evicted by b');
  assert.equal(cached.shardCache.size, 3); assert.equal(cached.shardCache.heldBytes, 300);
});

test('a failed read is not kept, so the next request reads again', async () => {
  const {calls, settle, atlas} = fakeReader(), cached = retainVerifiedShards(atlas, {maxBytes: 1000}), a = descriptor('a');
  const failed = cached.readShard(a); settle('a', new Error('offline'));
  await assert.rejects(failed, /offline/);
  await tick();
  assert.equal(cached.shardCache.size, 0); assert.equal(cached.shardCache.heldBytes, 0);
  const retry = cached.readShard(a); settle('a');
  assert.deepEqual(await retry, {name: 'a'});
  assert.deepEqual(calls, ['a.json', 'a.json']);
});

test('a late failure of an evicted read does not remove the newer read of the same shard', async () => {
  const {calls, settle, atlas} = fakeReader(), cached = retainVerifiedShards(atlas, {maxBytes: 100});
  const stale = cached.readShard(descriptor('a'));
  const b = cached.readShard(descriptor('b')); settle('b'); await b;       // evicts the open read of a
  const fresh = cached.readShard(descriptor('a'));                         // evicts b, reads a again
  settle('a', new Error('offline')); await assert.rejects(stale, /offline/); await tick();
  settle('a'); assert.deepEqual(await fresh, {name: 'a'});
  assert.equal(await cached.readShard(descriptor('a')), await fresh, 'the newer read stays cached');
  assert.deepEqual(calls, ['a.json', 'b.json', 'a.json']);
});

test('descriptors without a declared size, or larger than the budget, pass straight through', async () => {
  const {calls, settle, atlas} = fakeReader(), cached = retainVerifiedShards(atlas, {maxBytes: 100});
  const unsized = {path: 'routes.json', sha256: 'f'.repeat(64)}, large = descriptor('large', 101);
  for (let i = 0; i < 2; i++) { const p = cached.readShard(unsized); settle('routes'); await p; const q = cached.readShard(large); settle('large'); await q; }
  assert.deepEqual(calls, ['routes.json', 'large.json', 'routes.json', 'large.json']);
  assert.equal(cached.shardCache.size, 0);
});

test('a hit needs the identical path, SHA-256 and byte count', async () => {
  const {calls, settle, atlas} = fakeReader(), cached = retainVerifiedShards(atlas, {maxBytes: 1000});
  for (const d of [descriptor('a', 100, 'x'), descriptor('b', 100, 'x'), descriptor('a', 101, 'x')]) { const p = cached.readShard(d); settle(d.path.slice(0, -5)); await p; }
  assert.deepEqual(calls, ['a.json', 'b.json', 'a.json']);
});

// The real distribution and the unmodified lib checksum reader.
const ATLAS_DIR = path.join(PROJECT_ROOT, 'dist/data/atlas', atlasId, atlasVersion);
async function openAtlas({failOnce = new Set()} = {}) {
  const reads = new Map();
  const readText = async file => { const name = path.basename(file); reads.set(name, (reads.get(name) || 0) + 1); if (failOnce.delete(name)) throw new Error(`cannot read ${name} (503)`); return readFile(file, 'utf8'); };
  return {reads, atlas: await loadAtlas(ATLAS_DIR, {readText})};
}
const fineDetails = atlas => Object.values(atlas.catalog.detailShards).filter(d => /^destination-details-fine-\d{4}\.json$/.test(d.path)).sort((a, b) => a.path.localeCompare(b.path));

test('every miss still runs the byte-count and SHA-256 checks, and a mismatch is never kept', async () => {
  const {reads, atlas} = await openAtlas(), cached = retainVerifiedShards(atlas), [good] = fineDetails(atlas);
  const wrongHash = {...good, sha256: '0'.repeat(64)}, wrongSize = {...good, bytes: good.bytes + 1};
  for (let i = 0; i < 2; i++) {
    await assert.rejects(cached.readShard(wrongHash), /lazy shard checksum mismatch/);
    await assert.rejects(cached.readShard(wrongSize), /lazy shard byte count mismatch/);
  }
  await tick();
  assert.equal(reads.get(good.path), 4, 'each mismatching request was read and checked again');
  assert.equal(cached.shardCache.size, 0);
  const data = await cached.readShard(good);
  assert.equal(data.kind, 'eigenquestions-destination-details');
  await cached.readShard({...good});
  assert.equal(reads.get(good.path), 5, 'the verified shard is reused');
});

test('a failed download is retried through the checksummed reader', async () => {
  const failOnce = new Set(), {reads, atlas} = await openAtlas({failOnce}), [, shard] = fineDetails(atlas), cached = retainVerifiedShards(atlas);
  failOnce.add(shard.path);
  await assert.rejects(cached.readShard(shard), /503/);
  await tick();
  assert.equal((await cached.readShard(shard)).kind, 'eigenquestions-destination-details');
  assert.equal(reads.get(shard.path), 2);
});

test('a shard read before 16 others is reused instead of downloaded again', async () => {
  const shards = d => fineDetails(d).slice(0, 18);
  for (const [label, wrap, expected] of [['atlas reader alone', a => a, 2], ['with retained verified shards', retainVerifiedShards, 1]]) {
    const {reads, atlas} = await openAtlas(), reader = wrap(atlas), list = shards(atlas);
    for (const d of list) await reader.readShard(d);
    await reader.readShard(list[0]);
    assert.equal(reads.get(list[0].path), expected, label);
  }
});

// Show more on Compactification geometry, gauge sectors and consistency (67 paper questions, 7 among the default choices),
// driven through the same batching and attribution the browser uses. The unwrapped reader is the control.
const PARENT = 'q025-candidate-region:839da90831bec9d6ef0a811b';
async function showMoreFlow(wrap) {
  const {reads, atlas} = await openAtlas(), reader = wrap(atlas), navigator = createAtlasNavigator(reader);
  await navigator.prepareDestination(PARENT);
  const view = navigator.computeView(currentState(navigator.createSession({selector: {...navigator.initialState.selector, destinationId: PARENT}})));
  const first = new Map(); for (const r of view.atlas.connections) if (!first.has(r.destinationId)) first.set(r.destinationId, r);
  const rows = [...first.values()].filter(r => r.navigationKind === 'source_question' && r.traversal === 'outgoing').map(r => ({id: `connection:${r.id}`, destinationId: r.destinationId}));
  const shownIds = new Set(view.directions.map(d => d.id)), attempted = new Set();
  const run = async expanded => { for (let batch = nextPaperAttributionBatch(rows, {attempted, shownIds, expanded}); batch.length; batch = nextPaperAttributionBatch(rows, {attempted, shownIds, expanded})) { await resolvePaperAttribution(navigator, PARENT, batch, {concurrency: 4}); batch.forEach(id => attempted.add(id)); } };
  const shardOf = id => atlas.catalog.detailShards[atlas.catalog.destinations.find(d => d.id === id).detail.shardId].path;
  const details = () => new Map([...reads].filter(([name]) => /^destination-details-fine-/.test(name)));
  await run(false); const folded = details();
  await run(true); const expanded = details();
  return {rows, attempted, folded, expanded, reader,
    shownShards: new Set(rows.filter(r => shownIds.has(r.id)).map(r => shardOf(r.destinationId))), allShards: new Set(rows.map(r => shardOf(r.destinationId)))};
}

test('Show more on the 67-question group reads each detail shard once, and nothing for hidden rows before it', async () => {
  const control = await showMoreFlow(a => a), cached = await showMoreFlow(retainVerifiedShards);
  for (const flow of [control, cached]) {
    assert.equal(flow.rows.length, 67); assert.equal(flow.attempted.size, 67);
    assert.deepEqual(new Set(flow.folded.keys()), flow.shownShards, 'folded: only the shown rows’ shards are read');
    assert.deepEqual(new Set(flow.expanded.keys()), flow.allShards);
  }
  const repeats = reads => [...reads.values()].reduce((n, count) => n + count - 1, 0);
  assert.ok(repeats(control.expanded) > 0, 'control: the 16-shard memo alone downloads some shards again');
  assert.equal(repeats(cached.expanded), 0, 'each detail shard is read once');
  assert.deepEqual(cached.folded, control.folded, 'the folded group reads exactly what it read before');
  assert.ok(cached.reader.shardCache.heldBytes <= SHARD_CACHE_BYTES);
  assert.equal(SHARD_CACHE_BYTES, 10 * 1024 * 1024);
});
