import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {atlasId,atlasVersion,entryDestinationId} from '../lib/swampwiki.mjs';
import {loadAtlas,createAtlasNavigator} from '../lib/geometry/prepared-atlas.mjs';
const root = fileURLToPath(new URL('..',import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function checkSite(directory=path.join(root,'dist')) {
  const entries = new Set();
  for (const name of await readdir(directory,{recursive:true})) {
    const info = await stat(path.join(directory,name));
    if (info.isDirectory()) continue;
    assert.ok(info.size<=25*1024*1024,`Asset exceeds 25 MiB: ${name}`);
    entries.add(name);
  }
  assert.ok(entries.size<=20000,'Too many static assets');
  const json = async name => JSON.parse(await readFile(path.join(directory,name),'utf8'));
  const text = name => readFile(path.join(directory,name),'utf8');
  const required = ['index.html','404.html','app.js','styles.css','lib/protocol/session.mjs','lib/protocol/capsule.mjs','lib/protocol/presentation.mjs','lib/geometry/prepared-atlas.mjs','docs/site.md','docs/agent-interface.md','skills/physics-navigator/SKILL.md','llms.txt','atlas/index.html'];
  for (const name of required) assert.ok(entries.has(name),`Missing ${name}`);
  const list = [...entries];
  for (const name of list) {
    assert.doesNotMatch(name,/^(api\/|research\/|overview[./]|atlas-overview[.]|compute-worker[.]|construction[.]|data\/(overview\/|vectors-|graph[.])|lib\/geometry\/index[.])/);
    assert.doesNotMatch(name,/Lab Notebook|\.env$|classification(?:%3a|:)/i);
  }
  function checkLink(href,file) {
    if (/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(href)) return;
    const pathname = decodeURIComponent(new URL(href,`https://static.invalid/${file}`).pathname).slice(1);
    assert.ok(entries.has(pathname)||entries.has(pathname+'index.html'),`Broken link in ${file}: ${href}`);
  }
  for (const file of list) {
    if (/\.html$/.test(file)) {
      for (const match of (await text(file)).matchAll(/(?:href|src)="([^"]+)"/g)) checkLink(match[1],file);
    } else if (/\.(mjs|js)$/.test(file)) {
      for (const match of (await text(file)).matchAll(/(?:from\s*|import\s*)['"]([./][^'"]+)['"]/g)) checkLink(match[1],file);
    } else if (file.endsWith('.md')) {
      for (const match of (await text(file)).matchAll(/\[[^\]]+\]\(([^\s)]+)\)/g)) checkLink(match[1],file);
    }
  }
  const index = await json('data/atlas/index.json');
  assert.deepEqual(index.home,{atlasId,atlasVersion,destinationId:entryDestinationId});
  assert.equal(index.atlases.length,1);
  const prefix = `data/atlas/${atlasId}/${atlasVersion}/`;
  assert.ok(list.filter(name=>name.startsWith('data/atlas/')).every(name=>name==='data/atlas/index.json'||name.startsWith(prefix)),'Foreign atlas in public assets');
  const manifest = await json(prefix+'manifest.json');
  assert.equal(sha(await text(prefix+'manifest.json')),index.atlases[0].manifestSha256);
  assert.equal(manifest.entryDestinationId,entryDestinationId);
  const identity = await text('lib/geometry/prepared-identity.mjs');
  assert.ok(identity.includes(sha(await text('lib/geometry/prepared-atlas.mjs'))),'Prepared engine identity is stale');
  const loaded = await loadAtlas(path.join(directory,prefix),{readText:file=>readFile(file,'utf8')});
  const navigator = createAtlasNavigator(loaded);
  await navigator.prepareDestination(entryDestinationId);
  const home = navigator.computeView(navigator.createSession().states[0]);
  assert.equal(home.directions.length,15);
  assert.ok(home.directions.every(direction=>direction.navigationKind==='collection_access'));
  await navigator.prepareSearch();
  assert.equal(loaded.catalog.overview,undefined);
  assert.equal(loaded.catalog.orientation,undefined);
  for (const row of [...loaded.catalog.destinations,...Object.keys(loaded.catalog.destinationAliases).map(id=>({id}))]) {
    assert.ok(entries.has(`atlas/${atlasId}/${atlasVersion}/${row.id}.html`),`Missing static record: ${row.id}`);
  }
  async function verify(file,base) {
    const bytes = await readFile(path.join(directory,base,file.path));
    if(file.bytes!==undefined) assert.equal(bytes.length,file.bytes,file.path);
    assert.equal(sha(bytes),file.sha256,file.path);
  }
  await verify(manifest.files.deliveryAssets,prefix);
  const inventory = await json(prefix+manifest.files.deliveryAssets.path);
  for (const file of inventory.files) await verify(file,prefix);
  const corpus = await json('data/manifest.json');
  assert.deepEqual(Object.keys(corpus.files).sort(),['papers','units']);
  const sourceFiles = [corpus.files.papers,...corpus.files.units];
  for (const file of sourceFiles) await verify(file,'data');
  assert.equal(corpus.contentHash,manifest.corpusContentHash);
  const report=await json(prefix+manifest.files.logicalValidation.path);
  assert.equal(report.destinations,loaded.catalog.destinations.length);
  assert.equal(report.relations,loaded.catalog.relations.length);
  assert.equal(loaded.catalog.destinations.filter(row=>row.sourceQuestionAccess).length,8473);
  assert.equal(report.scientificAccounting.methodUnits,17937);
  return {assets:entries.size,staticAssets:true,corpusId:corpus.corpusId,verifiedShards:sourceFiles.length,verifiedAtlasFiles:inventory.files.length,destinations:report.destinations,relations:report.relations,entryChoices:home.directions.length};
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(await checkSite(),null,2));
