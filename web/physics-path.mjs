import {normalizeState,importSession,currentState} from '../lib/protocol/session.mjs';
/** The session to open for a prepared-atlas address. The browser keeps each address's path in its history entry, but the address
 * is authoritative. A remembered path is reused (keeping Back and the path display) only when it belongs to the installed computation
 * and still ends on the address's destination, lens, intent and relation. An entry recorded under another computation (an earlier
 * release still open in this tab) or one that no longer reads is set aside, and the address opens by itself with its own options.
 * Explicit imports (files, saved sessions) do not come through here and still stop on a computation mismatch. */
export function routeTarget(fragment){
  return {selector:{kind:'atlas-destination',atlasId:fragment.get('atlas'),atlasVersion:fragment.get('version'),destinationId:fragment.get('destination')},
    lens:fragment.get('lens')||'combined',intent:fragment.get('intent')||'explore',workRelation:fragment.get('relation')||'either'};
}
export function routeSession(remembered,{selector,lens,intent,workRelation},navigator,corpusId){
  if(remembered){
    let saved=null;
    try{saved=importSession(remembered,{corpusId,computationId:navigator.computationId});}catch{/* Stale or unreadable history; the address decides. */}
    const state=saved&&currentState(saved);
    if(state&&state.selector?.destinationId===selector.destinationId&&state.lens===lens&&state.intent===intent&&state.workRelation===workRelation)return saved;
  }
  return navigator.createSession({selector,lens,intent,workRelation});
}
/** The installed atlas index (/data/atlas/index.json) decides which atlas versions this site opens. Each entry pins one version's
 * manifest by SHA-256, so a link, saved view or agent call that names an atlas and version resolves to exactly the distribution
 * listed there. Several versions may be listed side by side: an older link keeps opening the release it was recorded in. A link
 * naming another atlas ID, or a version that is not listed, is refused before any of its files are requested, and a served manifest
 * whose bytes differ from the pin is refused before it opens. Explicit imports keep their own computation check (routeSession). */
const ATLAS_IDENTIFIER=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/,SHA256=/^[a-f0-9]{64}$/;
export function installedAtlasIndex(index){
  const invalid=()=>new Error('Unsupported installed atlas catalog.'),seen=new Set();
  if(index?.schemaVersion!=='1.0.0'||!Array.isArray(index.atlases)||!index.atlases.length)throw invalid();
  for(const entry of index.atlases){
    if(![entry?.atlasId,entry?.atlasVersion,entry?.entryDestinationId].every(value=>typeof value==='string'&&ATLAS_IDENTIFIER.test(value))||!SHA256.test(entry.manifestSha256||''))throw invalid();
    const key=`${entry.atlasId}/${entry.atlasVersion}`;if(seen.has(key))throw invalid();seen.add(key);
  }
  return index;
}
/** The index entry a selector names, for this site's own atlas ID only. Throws a reader-facing reason otherwise. */
export function installedAtlasEntry(index,selector,siteAtlasId){
  if(selector?.kind!=='atlas-destination'||![selector.atlasId,selector.atlasVersion,selector.destinationId].every(value=>typeof value==='string'&&ATLAS_IDENTIFIER.test(value)))throw new Error('Invalid prepared atlas selector.');
  if(selector.atlasId!==siteAtlasId)throw new Error(`SwampWiki does not serve the atlas “${selector.atlasId}”.`);
  const entry=index.atlases.find(item=>item.atlasId===selector.atlasId&&item.atlasVersion===selector.atlasVersion);
  if(!entry)throw new Error(`SwampWiki version “${selector.atlasVersion}” is not installed here (installed: ${index.atlases.filter(item=>item.atlasId===siteAtlasId).map(item=>item.atlasVersion).join(', ')}).`);
  return entry;
}
/** The loaded atlas must be the exact distribution its index entry pins: same atlas ID and version, same manifest bytes. */
export function checkInstalledManifest(entry,atlas){
  if(atlas?.manifest?.atlasId!==entry.atlasId||atlas.manifest.atlasVersion!==entry.atlasVersion)throw new Error(`The manifest served for SwampWiki version “${entry.atlasVersion}” names a different atlas version.`);
  if(atlas.manifestSha256!==entry.manifestSha256)throw new Error(`The manifest served for SwampWiki version “${entry.atlasVersion}” does not match the installed atlas index.`);
  return atlas;
}
/** The detail shards behind one paper-question group can outnumber the atlas reader's own memo of 16 shards, first in first out:
 * the 67 questions of Compactification geometry read 40 shards. A shard dropped early was downloaded again whenever a later row
 * needed it. This keeps the most recently used verified shards, up to SHARD_CACHE_BYTES of their declared size (which the reader
 * checks), in front of the atlas's own checksummed reader. Every miss goes through that reader, so the byte count and SHA-256
 * are checked before parsing; a hit returns what an earlier read of the identical descriptor (path, SHA-256 and byte count)
 * resolved to. A failed read is not kept, so the next request reads again. A descriptor without a declared size, or larger than
 * the whole budget, passes straight through. Nothing is requested ahead of need: rows behind "Show more" still read nothing. */
export const SHARD_CACHE_BYTES=10*1024*1024;
export function retainVerifiedShards(atlas,{maxBytes=SHARD_CACHE_BYTES}={}){
  const read=atlas?.readShard;if(typeof read!=='function')return atlas;
  const entries=new Map();let held=0;
  const drop=key=>{const entry=entries.get(key);if(entry){entries.delete(key);held-=entry.bytes;}};
  const readShard=descriptor=>{
    const bytes=descriptor?.bytes;
    if(!Number.isSafeInteger(bytes)||bytes<1||bytes>maxBytes||typeof descriptor.path!=='string'||typeof descriptor.sha256!=='string')return read(descriptor);
    const key=`${descriptor.sha256}\n${bytes}\n${descriptor.path}`,hit=entries.get(key);
    if(hit){entries.delete(key);entries.set(key,hit);return hit.value;}
    const entry={bytes,value:Promise.resolve(read(descriptor))};entries.set(key,entry);held+=bytes;
    entry.value.catch(()=>{if(entries.get(key)===entry)drop(key);});
    while(held>maxBytes){const oldest=entries.keys().next().value;if(oldest===key)break;drop(oldest);}
    return entry.value;
  };
  return {...atlas,readShard,shardCache:{maxBytes,get heldBytes(){return held;},get size(){return entries.size;}}};
}
/** A display projection only. The complete session and its replay indices stay intact. */
export function physicsPath(session,{activeOnly=false}={}){
  const groups=[];
  for(const [index,state] of session.states.entries()){
    if(activeOnly&&index>session.cursor)break;
    const key=state.selector?normalizeState({...state,sourceInspection:undefined}).id:null;
    let group=groups.at(-1);
    if(!key||group?.key!==key){group={key,startIndex:index,endIndex:index,index,state,indices:[],current:false};groups.push(group);}
    group.indices.push(index);group.endIndex=index;
    if(!group.current){group.index=index;group.state=state;}
    if(index===session.cursor){group.current=true;group.index=index;group.state=state;}
  }
  return groups;
}

export function sourceInspectionHistory(session,describe=()=>null){
  return session.states.flatMap((state,index)=>{
    if(!state.sourceInspection)return [];
    const source=describe(state),label=source?.paperId?`${source.paperId} · ${source.endpointSide||'recorded'} method`:`Source inspection ${index+1}`;
    return [{index,label,active:index===session.cursor,target:state.sourceInspection}];
  });
}
