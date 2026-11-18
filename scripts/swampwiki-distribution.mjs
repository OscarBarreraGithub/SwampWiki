import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {atlasId,atlasVersion,entryDestinationId} from '../lib/swampwiki.mjs';
const upstream = {
  commit: '387e95edb11aca883cbf1d05ceba9513bfd1e364',
  atlasId: 'q025-approved-organization-candidate',
  atlasVersion: '2026-11-17-post-test-accounted-v1',
  manifestSha256: '15b2dc99f216462e7d0deaec9f16b4de416cf0a291c76bcda6b973cd3b4ff3cb'
};
const sha = data => createHash('sha256').update(data).digest('hex');
const json = value => Buffer.from(JSON.stringify(value) + '\n');
const descriptor = (name, bytes) => ({path:name, bytes:bytes.length, sha256:sha(bytes)});
const vocabulary = id => id.startsWith('classification:') || id === 'landmark:arxiv-hep-th';

async function checked(directory, file) {
  assert.match(file.path, /^[a-z0-9][a-z0-9._-]*$/i);
  const bytes = await readFile(path.join(directory, file.path));
  assert.equal(sha(bytes), file.sha256, file.path);
  if (file.bytes !== undefined) assert.equal(bytes.length, file.bytes, file.path);
  return bytes;
}

// Derive from the immutable navigation package, never from title/keyword selection.
// Shared scientific shards retain their original bytes and checksum.
export async function buildDistribution(root, out) {
  const source = path.join(root, 'data/atlas', upstream.atlasId, upstream.atlasVersion);
  const data = path.join(out, 'data');
  const directory = path.join(data, 'atlas', atlasId, atlasVersion);
  await mkdir(directory, {recursive:true});
  const manifest = JSON.parse(await checked(source, {path:'manifest.json', sha256:upstream.manifestSha256}));
  const catalog = JSON.parse(await checked(source, manifest.files.catalog));
  const inventory = JSON.parse(await checked(source, manifest.files.deliveryAssets));
  const retained = catalog.destinations.filter(record => !vocabulary(record.id));
  const discardedEdges = catalog.relations.filter(row => vocabulary(row.source) || vocabulary(row.target));
  const discardedIds = new Set(discardedEdges.map(row => row.id));
  const retainedById = new Map(retained.map(row => [row.id,row]));
  for (const relation of discardedEdges) {
    for (const id of [relation.source, relation.target]) {
      if (retainedById.has(id)) retainedById.get(id).connectionCount--;
    }
  }

  // Classification and collection metadata share detail/proof buckets. Trim
  // records within mixed buckets and drop empty ones, updating their hashes.
  const changes = new Map();
  async function trimBuckets(descriptors, keys, field, discard) {
    for (const key of keys) {
      const file = descriptors[key];
      const shard = JSON.parse(await checked(source, file));
      for (const id of Object.keys(shard[field])) if (discard(id)) delete shard[field][id];
      if (Object.keys(shard[field]).length) {
        const bytes = json(shard);
        descriptors[key] = descriptor(file.path, bytes);
        changes.set(file.path, bytes);
      } else {
        delete descriptors[key];
        changes.set(file.path, null);
      }
    }
  }
  const removed = catalog.destinations.filter(row => vocabulary(row.id));
  await trimBuckets(catalog.detailShards, new Set(removed.map(row => row.detail.shardId)), 'destinations', vocabulary);
  await trimBuckets(catalog.relationDetailShards, new Set(discardedEdges.map(row => row.detail.shardId)), 'relations', id => discardedIds.has(id));
  catalog.destinations = retained;
  catalog.relations = catalog.relations.filter(row => !discardedIds.has(row.id));
  catalog.sourceInventory.vocabularyCount = 0;
  delete catalog.orientation;
  delete catalog.overview;
  const catalogBytes = json(catalog);
  changes.set('catalog.json', catalogBytes);

  const validation = JSON.parse(await checked(source, manifest.files.logicalValidation));
  const {publicEntryReachability, ...scientificAccounting} = validation.fullLogicalValidation;
  const scientificRows = rows => Object.fromEntries(Object.entries(rows).filter(([id])=>!vocabulary(id)));
  const report = {
    schemaVersion:'swampwiki-text-distribution/1', upstream,
    sourceValidationSha256:manifest.files.logicalValidation.sha256,
    omittedVocabularyDestinations:removed.length, omittedVocabularyRelations:discardedEdges.length,
    entryDestinationId, entryConnections:retainedById.get(entryDestinationId).connectionCount,
    destinations:retained.length + validation.fineDestinationCount,
    relations:validation.navigationRelationCount - discardedEdges.length,
    scientificAccounting,
    destinationCounts:scientificRows(validation.destinationCounts),
    membershipIdentityHashes:scientificRows(validation.membershipIdentityHashes),
    limitations:validation.limitations,
    upstreamPartitionValidation:`https://github.com/OscarBarreraGithub/Eigenquestions/blob/${upstream.commit}/data/atlas/${upstream.atlasId}/${upstream.atlasVersion}/${manifest.files.logicalValidation.path}`
  };
  changes.set(manifest.files.logicalValidation.path, json(report));
  const files = [];
  for (const file of inventory.files) {
    const bytes = changes.has(file.path) ? changes.get(file.path) : await checked(source, file);
    if (!bytes) continue;
    await writeFile(path.join(directory,file.path), bytes);
    files.push(changes.has(file.path) ? descriptor(file.path, bytes) : file);
  }
  const delivery = json({schemaVersion:'swampwiki-text-assets/1', files});
  await writeFile(path.join(directory,'delivery-assets.json'), delivery);
  manifest.files.deliveryAssets = descriptor('delivery-assets.json', delivery);
  manifest.files.logicalValidation = descriptor(manifest.files.logicalValidation.path, json(report));
  manifest.files.catalog = descriptor('catalog.json',catalogBytes);
  Object.assign(manifest, {atlasId, atlasVersion, entryDestinationId, upstream:{...upstream, catalogSha256:inventory.files.find(file=>file.path==='catalog.json').sha256}});
  const manifestBytes = json(manifest);
  await writeFile(path.join(directory,'manifest.json'), manifestBytes);
  const entry = {atlasId,atlasVersion,entryDestinationId,title:'Swampland collection',scope:manifest.scope.description,manifestSha256:sha(manifestBytes)};
  await writeFile(path.join(data,'atlas/index.json'), json({schemaVersion:'1.0.0', atlases:[entry], home:{atlasId,atlasVersion,destinationId:entryDestinationId}}));

  const sourceDirectory = path.join(root,'data/navigation');
  const corpusBytes = await readFile(path.join(sourceDirectory,'manifest.json'));
  const corpus = JSON.parse(corpusBytes);
  assert.equal(corpus.contentHash, manifest.corpusContentHash);
  // The source reader needs the bibliographies and frozen question/method text.
  // Preserve the original corpus ID/hash as the source-row identity.
  const sourceFiles = {papers:corpus.files.papers, units:corpus.files.units};
  for (const file of [sourceFiles.papers,...sourceFiles.units]) {
    await writeFile(path.join(data,file.path), await checked(sourceDirectory,file));
  }
  await writeFile(path.join(data,'manifest.json'), json({
    schemaVersion:corpus.schemaVersion, corpusId:corpus.corpusId, contentHash:corpus.contentHash,
    title:corpus.title,snapshotDate:corpus.snapshotDate,scope:corpus.scope,layers:corpus.layers,
    distribution:'SwampWiki source text',sourceManifestSha256:sha(corpusBytes),files:sourceFiles
  }));
  return report;
}
