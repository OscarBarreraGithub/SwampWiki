import {compareSourceRelations} from '/lib/protocol/context-page.mjs';
const el=(tag,value)=>{const node=document.createElement(tag);if(value!==undefined)node.textContent=value;return node;};
const scopes={direct_record_relation:'Exact source anchors and incident relations',shared_extraction_window_context:'Shared extraction window — applicability is not established',same_paper_context:'Same-paper context — applicability is not established'};

/* Source clarifications (SW-006). A clarification is a short reader's note bound to one exact extracted source record: its
 * source-object ID and kind, its paper, its extraction record ID and SHA-256, and the record text it was written against. It
 * is shown at the top of every source-context panel that contains that exact record, links to the primary-source passage it
 * relies on, and is linked both ways with the record's row once that row is shown. It never edits the record, its relations
 * or the question's scope. A malformed note, or one whose record differs in any bound field (for example after
 * re-extraction), is not shown, and the panel renders exactly as it does without notes.
 * Notes reach the browser only per atlas: an atlas manifest may declare files.readingClarifications, which
 * readingClarificationReader reads through that atlas's checksummed reader, and each source-context panel shows only the
 * verified notes its own atlas supplies. There is no page-level note store: without a descriptor, or when the declared file
 * fails its checksum or verification, the panel shows no note. Tests supply fixtures as an atlas would, in their own harness.
 * Builder integration is pending: the served release declares no such file, so no notes are shown and nothing is requested. */
const CLARIFICATIONS='swampwiki-source-clarifications',LINK_HOSTS=new Set(['arxiv.org','ar5iv.labs.arxiv.org','ar5iv.org','doi.org']);
let panelCount=0;
const filled=(value,max)=>typeof value==='string'&&value.trim()!==''&&value.length<=max;
const safeLink=link=>{if(!filled(link?.label,200)||typeof link.url!=='string')return false;try{const url=new URL(link.url);return url.protocol==='https:'&&LINK_HOSTS.has(url.hostname)&&!url.username&&!url.password;}catch{return false;}};
/** Why a clarification cannot be shown (a short reason), or null when it is well formed. */
export function clarificationProblem(note){
  const bound=note?.boundObject,kinds=new Set();
  if(!filled(note?.id,200)||!filled(note.paperId,100))return 'identity';
  if(!filled(bound?.id,300)||!filled(bound.kind,60)||!filled(bound.recordId,200)||!/^[a-f0-9]{64}$/.test(bound.recordSha256||'')||!filled(bound.text,4000))return 'bound record';
  if(!filled(note.summary,600)||!filled(note.reading,800)||!filled(note.review,400))return 'note text';
  if(!Array.isArray(note.quantities)||!note.quantities.length||note.quantities.length>6||!note.quantities.every(item=>filled(item?.kind,60)&&!kinds.has(item.kind)&&kinds.add(item.kind)&&filled(item.label,80)&&filled(item.value,80)&&filled(item.statement,400)))return 'quantities';
  if(!safeLink(note.primarySource))return 'primary-source link';
  if(note.alsoSee!==undefined&&(!Array.isArray(note.alsoSee)||note.alsoSee.length>3||!note.alsoSee.every(safeLink)))return 'additional links';
  return null;
}
/** Checks a clarification document without installing it. Malformed or duplicate notes are left out with a reason. Returns
 * {notes, accepted, rejected[, error]} (notes are copies; accepted lists their IDs) and never throws. */
export function verifySourceClarifications(value){
  if(value==null)return {notes:[],accepted:[],rejected:[]};
  if(value.kind!==CLARIFICATIONS||value.schemaVersion!=='1.0.0'||!Array.isArray(value.notes)||value.notes.length>500)return {notes:[],accepted:[],rejected:[],error:'unsupported source clarification document'};
  const notes=[],rejected=[];
  for(const note of value.notes){const problem=clarificationProblem(note)||(notes.some(item=>item.id===note.id)?'duplicate ID':null);if(problem)rejected.push({id:typeof note?.id==='string'?note.id:null,reason:problem});else notes.push(structuredClone(note));}
  return {notes,accepted:notes.map(note=>note.id),rejected};
}
/** The reading clarifications of one loaded atlas, for its source-context panels. When the atlas manifest declares
 * files.readingClarifications, the first call reads that file once through the atlas's own checksummed reader (atlas.readShard:
 * the path, byte count and SHA-256 must match the manifest) and verifies it as above; refused notes are left out. Without a
 * descriptor it resolves to [] and makes no request. A failed read or unsupported document rejects, and a later call tries
 * again. The notes stay with this reader, so another atlas's panels never receive them. */
export function readingClarificationReader(atlas){
  const descriptor=atlas?.manifest?.files?.readingClarifications;
  if(descriptor==null)return async()=>[];
  let pending=null;
  return ()=>pending??=(async()=>{
    if(typeof atlas.readShard!=='function')throw new Error('reading clarifications require the checksummed atlas reader');
    const {notes,error}=verifySourceClarifications(await atlas.readShard(descriptor));if(error)throw new Error(error);return notes;
  })().catch(error=>{pending=null;throw error;});
}
/** The given verified notes whose exact bound record is in this context: same object, kind, paper, text, record ID and hash.
 * Without notes there is nothing to match. */
export function clarificationsFor(context,notes=[]){
  const objects=new Map((Array.isArray(context?.sourceObjects)?context.sourceObjects:[]).map(object=>[object?.id,object]));
  return notes.filter(note=>{const object=objects.get(note.boundObject.id),record=object?.provenance?.record;
    return Boolean(object&&object.paperId===note.paperId&&object.kind===note.boundObject.kind&&object.text===note.boundObject.text&&record?.record_id===note.boundObject.recordId&&record?.record_sha256===note.boundObject.recordSha256);});
}
// One note: its quantities stay separate terms, in recorded order. The bound line is completed once the panel's groups exist.
function clarificationSection(note,key){
  const section=el('section'),heading=el('h4',`Clarification · ${note.boundObject.kind} · ${note.paperId}`),summary=el('p',note.summary),quantities=el('dl'),links=el('ul'),bound=el('p'),review=el('p',note.review);
  section.className='source-clarification';section.dataset.clarificationId=note.id;section.dataset.boundObjectId=note.boundObject.id;
  heading.id=`${key}-heading`;heading.tabIndex=-1;section.setAttribute('aria-labelledby',heading.id);summary.id=`${key}-summary`;quantities.className='clarification-quantities';
  for(const quantity of note.quantities){const row=el('div'),value=el('dd');row.dataset.quantityKind=quantity.kind;value.append(el('strong',quantity.value),` — ${quantity.statement}`);row.append(el('dt',quantity.label),value);quantities.append(row);}
  links.className='clarification-links';
  for(const [link,primary]of[[note.primarySource,true],...(note.alsoSee||[]).map(link=>[link,false])]){const item=el('li'),anchor=el('a',`${link.label} ↗`);anchor.href=link.url;anchor.target='_blank';anchor.rel='noopener noreferrer';if(primary)anchor.dataset.primarySource='';item.append(anchor);links.append(item);}
  bound.className='clarification-bound';review.className='clarification-review';
  section.append(heading,summary,quantities,el('p',note.reading),links,bound,review);
  return {note,section,heading,summary,bound,row:null,rowSummary:null};
}
// The bound record's row, when shown: marked, described by the note, and able to return to it. Its text is unchanged.
function markBoundRecord(record,summary,entries){
  record.className='clarified-record';record.dataset.clarifiedBy=entries.map(entry=>entry.note.id).join(' ');
  const tag=el('span',' · clarified above');tag.className='clarification-tag';summary.append(tag);summary.setAttribute('aria-describedby',entries.map(entry=>entry.summary.id).join(' '));
  const back=el('button','Read the clarification above');back.type='button';back.className='clarification-return';
  back.addEventListener('click',()=>{const heading=entries[0].heading;heading.scrollIntoView({block:'start'});heading.focus({preventScroll:true});});
  record.append(back);for(const entry of entries){entry.row=record;entry.rowSummary=summary;}
}
function linkClarification(entry,location){
  const {note,bound}=entry;
  if(!location){bound.textContent=`Bound to the ${note.boundObject.kind} record of ${note.paperId}; this panel shows it only within its recorded relations.`;return;}
  bound.textContent=`Bound to the ${note.boundObject.kind} record listed below in “${location.heading}” (${location.position} of ${location.count}).`;
  const show=el('button','Show the bound record');show.type='button';show.className='clarification-show';
  show.addEventListener('click',()=>{location.controller.reveal(location.object);if(!entry.row)return;entry.row.open=true;entry.rowSummary.scrollIntoView({block:'center'});entry.rowSummary.focus({preventScroll:true});});
  bound.append(show);
}

// Detail records are built progressively, including their provenance. A large
// paper shard may be complete without putting every object into the DOM at once.
// reveal(item) shows further batches, as "Show more" would, until that item is rendered.
function progressive(host,items,render,label,batch=20){
  let offset=0;const more=el('button');more.type='button';
  function append(){more.remove();for(const item of items.slice(offset,offset+batch))host.append(render(item));offset+=batch;if(offset<items.length){more.textContent=`Show ${Math.min(batch,items.length-offset)} more ${label} (${items.length-offset} remaining)`;host.append(more);}}
  more.addEventListener('click',append);append();
  return {reveal(item){const index=items.indexOf(item);while(index>=offset&&offset<items.length)append();return index>=0;}};
}
function provenance(record,value){let populated=false;record.addEventListener('toggle',()=>{if(record.open&&!populated){populated=true;record.append(el('pre',JSON.stringify(value,null,2)));}});}

/** clarifications: optional; returns (or resolves to) the verified notes of the atlas this panel's context comes from, as
 * readingClarificationReader does. They are read alongside the context on first opening and are the panel's only notes. If
 * they cannot be read or verified, the panel renders without any note and is marked data-clarifications="unavailable". */
export function sourceContextDisclosure(load,{onInspect,clarifications:readNotes}={}) {
  const details=el('details');details.className='source-scientific-context';details.append(el('summary','Methods, assumptions and scientific source connections'));
  let requested=false;
  details.addEventListener('toggle',async()=>{
    if(!details.open||requested)return;requested=true;
    const body=el('div');body.append(el('p','Loading pinned source context…'));details.append(body);
    try{
      const [context,atlasNotes]=await Promise.all([load(),readNotes?Promise.resolve().then(readNotes).then(notes=>Array.isArray(notes)?notes:null,()=>null):[]]);
      if(!details.isConnected)return;body.replaceChildren();
      if(atlasNotes)delete details.dataset.clarifications;else details.dataset.clarifications='unavailable';
      // Clarifications come first, and only from this panel's own atlas. Any failure here leaves them out, and the rest of the
      // panel renders as before.
      let notes=[];try{if(context.availability==='available'){const key=`source-clarification-${++panelCount}`;notes=clarificationsFor(context,atlasNotes||[]).map((note,index)=>clarificationSection(note,`${key}-${index}`));}}catch{notes=[];}
      const boundNotes=new Map(),locations=new Map();for(const entry of notes){const id=entry.note.boundObject.id;if(!boundNotes.has(id))boundNotes.set(id,[]);boundNotes.get(id).push(entry);}
      body.append(...notes.map(entry=>entry.section));
      body.append(el('p',context.notice),el('p','An exact attachment identifies a source object or incident edge; it does not make every attached record a premise or result of this question.'));
      if(context.coverage)body.append(el('p',typeof context.coverage.description==='string'?context.coverage.description:JSON.stringify(context.coverage)));
      if(context.sourceRoutes?.status!=='available'&&context.sourceRoutes?.notice)body.append(el('p',context.sourceRoutes.notice));
      if(context.availability!=='available'){body.append(el('p','No context was exported for this source in this atlas version. Read the paper for its assumptions and methods.'));return;}
      const objects=new Map(context.sourceObjects.map(item=>[item.id,item])),relations=new Map(context.sourceRelations.map(item=>[item.id,item]));
      for(const attachment of context.sourceAttachments){
        const group=el('section');group.append(el('h4',scopes[attachment.scope]||attachment.scope));
        if(attachment.warning)group.append(el('p',attachment.warning));
        const anchors=new Set(attachment.anchorObjectIds||[]),objectRows=(attachment.objectIds||[]).map(id=>objects.get(id)).filter(Boolean).sort((a,b)=>Number(!anchors.has(a.id))-Number(!anchors.has(b.id))||Number(a.kind==='paper')-Number(b.kind==='paper')||a.id.localeCompare(b.id));
        group.append(el('p',`${objectRows.length} source objects · ${(attachment.relationIds||[]).length} recorded relations`));
        const objectList=el('div'),objectController=progressive(objectList,objectRows,object=>{const record=el('details'),summary=el('summary'),label=el('span',`${object.kind} · `),paperId=el('span',object.paperId);paperId.className='source-id';label.append(paperId);summary.append(label);record.append(summary,el('p',object.text));const entries=boundNotes.get(object.id);if(entries)try{markBoundRecord(record,summary,entries);}catch{/* The row stays as recorded. */}provenance(record,{id:object.id,evidenceScope:object.evidenceScope,evidenceRefs:object.evidenceRefs,provenance:object.provenance});return record;},'source objects');group.append(objectList);
        objectRows.forEach((object,index)=>{if(boundNotes.has(object.id)&&!locations.has(object.id))locations.set(object.id,{controller:objectController,object,heading:scopes[attachment.scope]||attachment.scope,position:index+1,count:objectRows.length});});
        const relationList=el('div');progressive(relationList,(attachment.relationIds||[]).map(id=>relations.get(id)).filter(Boolean).sort(compareSourceRelations),relation=>{
          const record=el('details'),source=objects.get(relation.source),target=objects.get(relation.target);record.append(el('summary',`${relation.type.replaceAll('_',' ')} · ${relation.semanticStatus.replaceAll('_',' ')}`),el('p',`${source?.kind||'Object'} ${source?.paperId||relation.source} → ${target?.kind||'object'} ${target?.paperId||relation.target}`));
          const statement=relation.statement||relation.provenance?.attributes?.scope;if(statement)record.append(el('p',typeof statement==='string'?statement:JSON.stringify(statement)));if(relation.readerNote)record.append(el('p',relation.readerNote));
          if(relation.premises&&Object.keys(relation.premises).length){const conditions=el('details');conditions.append(el('summary','Conditions and qualifications'));for(const [kind,values]of Array.isArray(relation.premises)?[['Premises',relation.premises]]:Object.entries(relation.premises)){if(!values?.length)continue;conditions.append(el('h4',kind.replaceAll('_',' ')));const list=el('ul');for(const premise of values)list.append(el('li',typeof premise==='string'?premise:premise.statement||JSON.stringify(premise)));conditions.append(list);}record.append(conditions);}
          const route=context.sourceRoutes?.items.find(item=>item.relationId===relation.id);
          if(route)for(const endpoint of route.endpoints){if(!endpoint.choices.length){record.append(el('p',`${endpoint.side==='source'?'Source':'Target'} endpoint has no exact frozen method mapping; its statement remains readable.`));continue;}for(const choice of endpoint.choices){const button=el('button',`Inspect ${endpoint.side} method · ${choice.paperId}`);button.type='button';button.disabled=!onInspect;button.addEventListener('click',()=>onInspect(choice.action));record.append(button);}}
          record.append(el('p','This relation concerns these source objects under their recorded scope. It is not an implication between their entire topics.'));provenance(record,relation);return record;
        },'source relations');group.append(relationList);body.append(group);
      }
      for(const entry of notes)try{linkClarification(entry,locations.get(entry.note.boundObject.id));}catch{/* The note stays readable without its record link. */}
      if(context.sourceAssessments?.length){const assessment=el('details');assessment.append(el('summary',`${context.sourceAssessments.length} withheld or nonpositive assessments`));progressive(assessment,context.sourceAssessments,item=>{const record=el('details');record.append(el('summary',item.status||'Recorded assessment'),el('p',item.readerNote||item.statement||'Recorded assessment'));provenance(record,item);return record;},'assessments');body.append(assessment);}
      if(context.sourceEvidence?.length){const locators=el('details');locators.append(el('summary',`${context.sourceEvidence.length} original evidence locators`));let populated=false;locators.addEventListener('toggle',()=>{if(locators.open&&!populated){populated=true;progressive(locators,context.sourceEvidence,item=>{const record=el('details');record.append(el('summary',`${item.id}${item.page!==undefined?` · page ${item.page}`:''}`));provenance(record,item);return record;},'locators');}});body.append(locators);}
      if(context.missingEvidenceIds?.length)body.append(el('p',`${context.missingEvidenceIds.length} referenced evidence locators are not included in this export. The exact IDs remain in the source records.`));
    }catch(error){requested=false;body.replaceChildren(el('p',`Source context unavailable: ${error.message}. The displayed source is unchanged.`));}
  });
  return details;
}
