#!/usr/bin/env node
/** Bounded post-deployment verification. No credentials or publication tools. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {atlasId, atlasVersion, entryDestinationId, siteOrigin} from '../../lib/swampwiki.mjs';
import {PREPARED_SOURCE_SHA256} from '../../lib/geometry/prepared-identity.mjs';

const atlasDirectory = `data/atlas/${atlasId}/${atlasVersion}`;
const entryPage = `atlas/${atlasId}/${atlasVersion}/${entryDestinationId}.html`;
const assetsToVerify = [
  'index.html', 'app.js', 'styles.css', 'atlas-panel.mjs', 'build-info.json',
  'lib/swampwiki.mjs', 'lib/geometry/prepared-atlas.mjs', 'lib/geometry/prepared-identity.mjs',
  'lib/protocol/session.mjs', 'lib/protocol/capsule.mjs', 'lib/protocol/presentation.mjs',
  'data/manifest.json', 'data/atlas/index.json', `${atlasDirectory}/manifest.json`,
  `${atlasDirectory}/catalog.json`, 'atlas/index.html', entryPage,
  'llms.txt', 'robots.txt', 'sitemap.xml', 'docs/site.md', 'docs/agent-interface.md',
  'skills/physics-navigator/SKILL.md',
];
const RETIRED=[
  '/overview.html','/overview.js','/overview.css','/compute-worker.js','/data/overview/manifest.json',
  '/quiz/','/taste/','/explore/','/explore/tree/','/review/','/submit/','/leaderboard/',
  '/api/pair','/api/stats','/api/vote','/api/health','/api/submit','/api/leaderboard',
  '/api/review/submissions','/api/review/approve','/api/review/reject',
];
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
async function boundedResponse(response,maxBytes=2*1024*1024){
  const reader=response.body?.getReader();if(!reader)return Buffer.alloc(0);
  const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('RESPONSE_TOO_LARGE');}chunks.push(value);}}
  finally{reader.releaseLock();}
  return Buffer.concat(chunks);
}
async function pooled(tasks,limit=4){
  const result=new Array(tasks.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(limit,tasks.length)},async()=>{while(cursor<tasks.length){const index=cursor++;result[index]=await tasks[index]();}}));
  return result;
}
export async function checkPublication({origin=siteOrigin,dist,timeoutMs=12000}){
  const base=new URL(origin);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw new Error('Origin must be a plain HTTP(S) origin without credentials, query or path');
  if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)throw new Error('Timeout must be between 100 and 30000 ms');
  const expected = await Promise.all(assetsToVerify.map(async file => {
    const bytes = await readFile(path.join(dist, file));
    const route = file === 'index.html' ? '/' : '/' + file;
    return {route, file, bytes: bytes.length, sha256: sha(bytes)};
  }));
  const byFile = new Map(expected.map(item => [item.file, item]));
  const readJson = async file => JSON.parse(await readFile(path.join(dist, file), 'utf8'));
  const [build, corpus, index, atlas] = await Promise.all([
    'build-info.json', 'data/manifest.json', 'data/atlas/index.json', `${atlasDirectory}/manifest.json`,
  ].map(readJson));
  const manifestSha256 = byFile.get(`${atlasDirectory}/manifest.json`).sha256;
  const catalogSha256 = byFile.get(`${atlasDirectory}/catalog.json`).sha256;
  assert.equal(build.format, 'swampwiki-static-build-v1', 'Local release must be a SwampWiki build');
  assert.equal(index.atlases.length, 1, 'Local release must list the single SwampWiki atlas');
  assert.deepEqual(index.home, {atlasId, atlasVersion, destinationId: entryDestinationId});
  for (const descriptor of [index.atlases[0], atlas]) {
    assert.equal(descriptor.atlasId, atlasId);
    assert.equal(descriptor.atlasVersion, atlasVersion);
    assert.equal(descriptor.entryDestinationId, entryDestinationId);
  }
  assert.equal(atlas.corpusId, corpus.corpusId);
  assert.equal(atlas.corpusContentHash, corpus.contentHash);
  assert.equal(index.atlases[0].manifestSha256, manifestSha256, 'Local atlas manifest differs from the index pin');
  assert.equal(atlas.files.catalog.sha256, catalogSha256, 'Local catalog differs from its manifest pin');
  assert.equal(byFile.get('lib/geometry/prepared-atlas.mjs').sha256, PREPARED_SOURCE_SHA256, 'Local prepared adapter differs from its pin');
  const releaseFingerprint=sha(Buffer.from(JSON.stringify(expected.map(({route,sha256})=>({route,sha256})))));
  const tasks=expected.map(item=>async()=>{
    try{
      const url=new URL(item.route,base);url.searchParams.set('__swampwiki_verify',releaseFingerprint.slice(0,16));
      const response=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(timeoutMs),redirect:'follow'});
      const data=await boundedResponse(response,Math.max(item.bytes,2*1024*1024)),observedSha256=sha(data);
      return {path:item.route,status:response.status,bytes:data.length,expectedSha256:item.sha256,observedSha256,passed:new URL(response.url).origin===base.origin&&response.status===200&&observedSha256===item.sha256};
    }catch(error){return {path:item.route,passed:false,error:error.name==='TimeoutError'?'TIMEOUT':error.message==='RESPONSE_TOO_LARGE'?'RESPONSE_TOO_LARGE':'FETCH_FAILED'};}
  });
  const assets=await pooled(tasks);
  const retired=await pooled(RETIRED.flatMap(route=>['GET','POST'].map(method=>async()=>{
    try{
      const url=new URL(route,base);url.searchParams.set('__swampwiki_verify',releaseFingerprint.slice(0,16));
      const response=await fetch(url,{method,headers:{'Cache-Control':'no-cache',...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(timeoutMs),redirect:'follow'});
      await boundedResponse(response,256*1024);
      return {path:route,method,status:response.status,redirected:response.redirected,passed:new URL(response.url).origin===base.origin&&(method==='GET'?response.status===404:[404,405].includes(response.status))};
    }catch(error){return {path:route,method,passed:false,error:error.name==='TimeoutError'?'TIMEOUT':error.message==='RESPONSE_TOO_LARGE'?'RESPONSE_TOO_LARGE':'FETCH_FAILED'};}
  })));
  return {
    schemaVersion:'1.0.0',kind:'swampwiki-publication-check',checkedAt:new Date().toISOString(),origin:base.origin,
    expected:{releaseFingerprint,corpusId:corpus.corpusId,atlasId,atlasVersion,entryDestinationId,manifestSha256,catalogSha256},
    assets,retiredRoutes:retired,
    summary:{assetChecks:assets.length,matchedAssets:assets.filter(x=>x.passed).length,retiredRouteChecks:retired.length,retiredRoutePasses:retired.filter(x=>x.passed).length},
    passed:assets.every(x=>x.passed)&&retired.every(x=>x.passed),
    scope:'Checks exact deployed text navigator, prepared catalog, collection landing page, manifests, agent guidance and retired route status. Shard integrity and browser behavior are verified separately.',
  };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),options={dist:path.resolve(fileURLToPath(new URL('../../dist/',import.meta.url)))};let out;
  try{
    for(let i=0;i<args.length;i+=2){const name=args[i],value=args[i+1];if(value===undefined)throw new Error(`Missing value for ${name}`);if(name==='--origin')options.origin=value;else if(name==='--dist')options.dist=path.resolve(value);else if(name==='--out')out=value;else if(name==='--timeout-ms')options.timeoutMs=Number(value);else throw new Error(`Unknown option ${name}`);}
    const report=await checkPublication(options);const output=JSON.stringify(report,null,2)+'\n';if(out)await writeFile(out,output);process.stdout.write(output);if(!report.passed)process.exitCode=1;
  }catch(error){const report={schemaVersion:'1.0.0',kind:'swampwiki-publication-check',passed:false,error:error.code==='ENOENT'?'LOCAL_RELEASE_ASSET_MISSING':error.message};const output=JSON.stringify(report,null,2)+'\n';if(out)await writeFile(out,output);process.stdout.write(output);process.exitCode=1;}
}
