/** Text-first prepared destination details and local research notes. */
import {destinationPresentation} from '../lib/protocol/display-editorial.mjs';
import {paperTitle} from './paper-title.mjs';
import {appendSourceCoverage} from './source-coverage.mjs';
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const noteKey=selector=>`eigenquestions:work-note:v1:${selector.atlasId}:${selector.atlasVersion}:${selector.destinationId}`;
const noteBuffers=new Map();
const readNote=selector=>{if(noteBuffers.has(noteKey(selector)))return noteBuffers.get(noteKey(selector));try{return JSON.parse(localStorage.getItem(noteKey(selector))||'null');}catch{return null;}};
const download=(name,value)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=element('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

export const contributionLabels={addresses:'Addresses this scope',instantiates:'Example within this scope',specializes:'Specializes this scope',method:'Method contribution',boundary:'Boundary or limitation',comparison:'Comparison context'};
export const contributionBasisLabels={description_checked:'extracted description checked',source_excerpt_checked:'source excerpt checked'};
export const PAPER_ATTRIBUTION_LIMIT=48;
/**
 * Paper attribution for source-question links, read only through the shared prepared navigator. Each linked destination is
 * resolved to its recorded representativeUnitId and that unit's frozen source record (paper), never by label text or by an
 * ID suffix. Membership and reviewed roles are then read for that exact unit inside the parent destination: complete
 * primary membership (same-paper context rows excluded) and the parent's typed contribution rows. Repeated review
 * observations collapse to one role, keeping each distinct basis and qualification. Source access, membership and reviewed
 * roles remain separate fields; a source-question link never implies containment or question equivalence.
 * Loading is lazy and bounded (at most `limit` links, `concurrency` at a time); `isCurrent` is checked after every await so a
 * changed path discards the work. Returns null when discarded, else a Map from linked destination ID to its attribution.
 * `onResolved(id, attribution|null)` reports each link as soon as it has been tried (null: not identified), only while the work
 * is current, so a caller can show each paper without waiting for the rest of the batch.
 */
export async function resolvePaperAttribution(navigator,parentId,destinationIds,{limit=PAPER_ATTRIBUTION_LIMIT,concurrency=4,isCurrent=()=>true,onResolved}={}){
  if(!navigator?.destination||!navigator.sources||!navigator.getEvidence)throw new Error('Paper attribution needs the shared prepared navigator.');
  const ids=[...new Set(destinationIds)].slice(0,limit),pages=async collection=>{const rows=[];for(let offset=0;;){const page=navigator.sources(parentId,{collection,offset,limit:100});rows.push(...page.items);offset+=page.items.length;if(!page.items.length||offset>=page.total)return rows;}};
  await navigator.prepareSources?.(parentId);if(!isCurrent())return null;
  const members=new Set((await pages('membership')).filter(row=>!row.associationScope).map(row=>row.unitId)),reviewed=new Map();
  for(const row of await pages('contributions')){
    if(!reviewed.has(row.unitId))reviewed.set(row.unitId,new Map());const roles=reviewed.get(row.unitId);
    if(!roles.has(row.role))roles.set(row.role,{role:row.role,bases:new Set(),qualifications:new Set()});const entry=roles.get(row.role);
    if(row.basis)entry.bases.add(row.basis);if(row.qualification)entry.qualifications.add(row.qualification);
  }
  const resolved=new Map(),queue=[...ids];
  // One unreadable link leaves only that row unattributed.
  const identify=async id=>{
    try{await navigator.prepareDestination?.(id);}catch{return null;}if(!isCurrent())return null;
    const unitId=navigator.destination(id).representativeUnitId;if(typeof unitId!=='string'||!unitId)return null;
    const [source]=navigator.getEvidence([unitId]);if(!source||source.error||source.id!==unitId||!source.paperId)return null;
    return {unitId,paperId:source.paperId,paperTitle:source.title||'',url:source.sourceUrl||source.evidence?.url||'',listed:members.has(unitId),
      roles:[...(reviewed.get(unitId)?.values()||[])].map(entry=>({role:entry.role,bases:[...entry.bases],qualifications:[...entry.qualifications]}))};
  };
  const resolve=async id=>{const row=await identify(id);if(!isCurrent())return;if(row)resolved.set(id,row);onResolved?.(id,row);};
  await Promise.all(Array.from({length:Math.max(1,Math.min(concurrency,queue.length))},async()=>{while(queue.length&&isCurrent())await resolve(queue.shift());}));
  return isCurrent()?resolved:null;
}
/**
 * The next bounded batch of links to attribute in one paper-question group (rows carry `id` and `destinationId`). Until the
 * reader asks to see every paper question (`expanded`), only the rows on screen are requested: the links among the default
 * choices (`shownIds`), which the folded group lists. Rows behind "Show more" make no request until then; after it, the
 * remaining links follow in further batches of at most `limit`, after the shown ones. A link already tried for this computation
 * and parent (`attempted`, identified or not) is not requested again.
 */
export function nextPaperAttributionBatch(rows,{attempted=new Set(),shownIds=new Set(),expanded=false,limit=PAPER_ATTRIBUTION_LIMIT}={}){
  const shown=rows.filter(row=>shownIds.has(row.id)),ordered=[...new Set([...shown,...(expanded?rows.filter(row=>!shownIds.has(row.id)):[])].map(row=>row.destinationId).filter(Boolean))];
  return ordered.filter(id=>!attempted.has(id)).slice(0,limit);
}
/**
 * Heading for a paper-question group. The question count is exact. The distinct-paper count is a total only once every row has
 * been identified; before that it counts only the identified rows, so it is stated as a lower bound ("at least").
 */
export function paperGroupTitle(rows){
  const identified=rows.filter(row=>row.paperId).length,papers=new Set(rows.map(row=>row.paperId).filter(Boolean)).size;
  if(identified===rows.length)return `Paper questions · ${rows.length}${papers&&papers<rows.length?` from ${papers} papers`:''}`;
  return `Paper questions · ${rows.length}${papers?` from at least ${papers} paper${papers===1?'':'s'}`:''}`;
}
/**
 * Exact identification progress shown beside a partial count; empty once every row is identified, and while nothing has been
 * identified or tried yet (the heading then carries no paper count). `attempted` holds linked destination IDs already tried.
 */
export function paperGroupProgress(rows,{attempted=new Set(),loading=false,expanded=false}={}){
  const total=rows.length,identified=rows.filter(row=>row.paperId).length;if(identified===total)return '';
  const failed=rows.filter(row=>!row.paperId&&attempted.has(row.destinationId)).length,waiting=total-identified-failed;
  if(!identified&&!failed)return '';
  if(loading)return `Identifying papers… ${identified} of ${total} questions so far; the paper count is partial.`;
  if(waiting)return `Papers identified for ${identified} of ${total} questions so far; the paper count is partial.${expanded?'':` Showing all paper questions identifies the other ${waiting}.`}`;
  return `Papers identified for ${identified} of ${total} questions; ${failed} could not be identified here, so the paper count is a lower bound. Each question still opens its own source record.`;
}
/**
 * Next-choice families (SW-006 local experiment). The prepared selector already lists a step's choices in recorded-relation
 * order: narrower, typed relations, broader, organizational access, source questions (connectionPriority in
 * lib/geometry/prepared-atlas.mjs). A family names one of those runs, so narrower topics, sideways routes and paper questions
 * read differently. Presentation only: order, numbering, IDs, actions, links and recorded reasons are unchanged. Outgoing source
 * questions never reach these families; they are listed in the paper-question group.
 */
export function choiceFamily(direction){
  const kind=direction?.navigationKind;
  return kind==='narrower'?'narrower':kind==='broader'?'broader':kind==='shared_source_access'||kind==='collection_access'?'organizational':kind==='source_question'?'listing':'typed';
}
const kindText=kind=>String(kind||'connection').replaceAll('_',' ');
/**
 * A compact, cacheable summary of a choice's recorded routes, read from the relations the selector attached to it: the first
 * route's recorded direction, its scope-wide shared-source witness count (organizational access only) and the other relation
 * kinds recorded to the same destination. Saved choices keep this summary (`route`) because they no longer carry relations.
 */
export function choiceRoute(direction){
  if(direction?.route)return direction.route;
  const relation=direction?.relation;if(!relation)return null;
  const witnesses=relation.organizationalAccess?.uniqueWitnessCount,others=[...new Set((direction.relations||[]).map(route=>route.navigationKind).filter(kind=>kind&&kind!==direction.navigationKind))].map(kindText);
  return {traversal:relation.traversal,...(Number.isSafeInteger(witnesses)?{witnesses}:{}),...(others.length?{others}:{})};
}
/** A row's relation label. A typed sideways relation also states the question it was recorded from; browsing never reverses it. */
export function choiceKindLabel(direction){
  const kind=kindText(direction?.navigationKind),traversal=choiceRoute(direction)?.traversal;
  return choiceFamily(direction)==='typed'&&traversal?`${kind} · recorded ${traversal==='incoming'?'toward':'from'} this question`:kind;
}
/**
 * The count a row states after its relation label: ` · N listed descriptions` for a selector choice, ` · N sources` otherwise, with
 * the same count the row has always shown. A typed related-question choice whose count is zero states no count (''): its relation
 * type, recorded direction and any Return to step hint stay, and the destination states its own membership and reviewed source
 * roles once opened. Positive counts, and zero on every other kind of choice, are unchanged. Presentation only.
 */
export function choiceCountText(direction){
  const count=direction.sourceCount||direction.memberIds?.length||direction.evidenceIds.length;
  if(count===0&&direction.selector&&direction.navigationKind==='related_question')return '';
  return ` · ${count} ${direction.selector?'listed descriptions':'sources'}`;
}
const organizationalName=directions=>{const kinds=new Set(directions.map(direction=>direction.navigationKind));return kinds.size>1?'organizational access':kinds.has('collection_access')?'collection access':'shared sources';};
/** Heading for one run of choices in a family, with its exact count. */
export function choiceGroupHeading(family,directions){
  const count=directions.length,name={narrower:'Narrower topics',typed:'Sideways · typed relations',broader:'Broader topics',organizational:`Sideways · ${organizationalName(directions)}`,listing:count===1?'Topic listing this paper question':'Topics listing this paper question'}[family]||'Other connections';
  return `${name} · ${count}`;
}
/** One-line reading note for the current step's run, restating the recorded qualification of that kind of route ('' for none). */
export function choiceGroupNote(family,directions){
  if(family==='typed')return 'Each row names its recorded relation and the question it was recorded from. Browsing against that direction does not reverse the relation.';
  if(family==='listing')return 'Source access: the topic lists this paper’s own question. This does not make the two questions equivalent.';
  if(family!=='organizational')return '';
  const name=organizationalName(directions);
  if(name==='shared sources')return 'Linked because reviewed source questions are shared across both scopes, counted scope-wide. This is not containment, equivalence, physical implication or method applicability.';
  if(name==='collection access')return 'Curated collection access organizes browsing. It does not assert containment, scientific implication, source membership or method applicability.';
  return 'Organizational links (shared reviewed sources or curated collection access), not scientific relations. They do not assert containment, equivalence, implication or method applicability.';
}
/**
 * The recorded scope of a premise-check choice (SW-006): the distinct qualifications of its premise_check routes, verbatim and
 * in route order, read from the relations the selector attached to the choice. These are the same strings All connections
 * prints for those relations. Every other kind of choice, a premise check recorded without a qualification, and a saved choice
 * (which keeps no relations) give []. Presentation only: no order, action, relation or text changes.
 */
export function choiceScope(direction){
  if(direction?.navigationKind!=='premise_check')return [];
  const routes=[direction.relation,...(direction.relations||[])].filter(route=>route?.navigationKind==='premise_check');
  return [...new Set(routes.map(route=>route.qualification).filter(text=>typeof text==='string'&&text.trim()))];
}
/**
 * The atlas destination of a reviewed contribution's own source question, read only through the shared prepared navigator.
 * The frozen release keys a source question's destination by its exact unit hash (`source-question:<64 hex>`; the navigator's
 * fineLookup partitions exactly these IDs for direct links). That ID is only a lookup key: the result is a destination only
 * when the navigator loads it and its own record names this exact unit as its representativeUnitId, and it is not the
 * destination being read (`currentId`). Anything else — an unknown ID, an unreadable shard, a different representative —
 * returns null, so no link is drawn. Opening the destination is navigation to the paper's own question: it does not place that
 * question within the contributing scope or make the two questions equivalent, and it changes no relation, choice or membership.
 */
export async function contributionQuestionDestination(navigator,unitId,{currentId}={}){
  const hash=/^unit:([a-f0-9]{64})$/.exec(typeof unitId==='string'?unitId:'')?.[1];if(!hash||typeof navigator?.destination!=='function')return null;
  try{
    const key=`source-question:${hash}`;await navigator.prepareDestination?.(key);const record=navigator.destination(key);
    if(!record||record.representativeUnitId!==unitId||typeof record.id!=='string'||record.id===currentId)return null;
    return {destinationId:record.id,title:String(record.title||record.question||'')};
  }catch{return null;}
}
/** Stable link (atlas, version, destination) to a contribution's own question; a plain click navigates in place, keeping the path. */
function contributionQuestionLink(target,selector,onNavigate){
  const line=element('p',undefined,'contribution-question-line'),link=element('a','Open paper question','contribution-question'),destination={...selector,destinationId:target.destinationId};
  link.href='/#'+new URLSearchParams({atlas:selector.atlasId,version:selector.atlasVersion,destination:target.destinationId});
  link.setAttribute('aria-label',`Open paper question: ${target.title}`);
  link.addEventListener('click',event=>{if(!onNavigate||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onNavigate({type:'navigate',selector:destination});});
  line.append(link,element('span',' · its own atlas destination; this role does not place it under this scope','contribution-question-note'));return line;
}
export function sourceContributions(record,navigator,readSources,onError,contextForSource,{selector,onNavigate}={}){
  const rows=record.sourceContributions||[];if(!rows.length)return null;const relationshipCount=new Set(rows.map(row=>`${row.unitId}\n${row.role}`)).size;
  const disclosure=element('details'),body=element('div'),more=element('button','Read source contributions'),progress=element('p'),groups=new Map(),targets=new Map(),queue=[];let offset=0,started=false,workers=0;
  // A row's own question is looked up only while its paper group is open: opening the group, or loading more rows into an open
  // group, queues that group's pending rows, and the panel runs at most four lookups at a time. A closed group requests nothing.
  // Each unit is looked up once per panel, and the navigator keeps the checked record, so reopening a group (here or after Back)
  // makes no new request. A row gets its link only once the lookup succeeds (data-paper-question: pending → resolving → resolved
  // | unresolved), so a failed or absent lookup draws nothing and the group's paper link, role and qualification stay as they are.
  // The open group is aria-busy while its rows are being looked up.
  const work=async()=>{workers++;try{while(queue.length&&disclosure.isConnected){
    const {group,item,question,unitId}=queue.shift();if(!targets.has(unitId))targets.set(unitId,contributionQuestionDestination(navigator,unitId,{currentId:record.id}));const target=await targets.get(unitId);
    if(!disclosure.isConnected)return;item.setAttribute('data-paper-question',target?'resolved':'unresolved');if(target)question.after(contributionQuestionLink(target,selector,onNavigate));if(!--group.waiting)group.paper.removeAttribute('aria-busy');
  }}finally{workers--;}};
  const linkQuestions=group=>{if(!group.paper.open||!group.pending.length)return;
    for(const lookup of group.pending.splice(0)){lookup.item.setAttribute('data-paper-question','resolving');group.waiting++;queue.push({group,...lookup});}
    group.paper.setAttribute('aria-busy','true');while(workers<4&&queue.length)work();};
  disclosure.className='source-contributions';disclosure.append(element('summary',`Source contributions (${relationshipCount}${rows.length!==relationshipCount?`; ${rows.length} review observations`:''})`),element('p','These roles describe how each source contributes to this scope. A shared source does not make questions equivalent, and a method contribution does not establish applicability to every case.'),body,progress,more);more.type='button';
  const load=async()=>{more.disabled=true;started=true;try{
    if(!readSources)throw new Error('Source reading is still loading. Try again after the atlas opens.');
    const selected=rows.slice(offset,offset+20).map(row=>{const source=navigator?.getEvidence?.([row.unitId])?.[0];return source&&!source.error?{...row,source}:row;});
    const page=await readSources(selected);if(!disclosure.isConnected)return;
    for(const row of page){const source=row.source;let group=groups.get(source.paperId);
      if(!group){const paper=element('details'),summary=element('summary');paper.append(summary);if(/^https?:\/\//.test(source.sourceUrl||'')){const link=element('a','Read paper');link.href=source.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';paper.append(link);}group={paper,summary,title:paperTitle(source.title),count:0,relationships:new Map(),pending:[],waiting:0};const opened=group;paper.addEventListener('toggle',()=>linkQuestions(opened));groups.set(source.paperId,group);body.append(paper);}
      group.count++;const relationshipKey=`${row.unitId}\n${row.role}`;let item=group.relationships.get(relationshipKey);
      if(!item){item=element('article');const question=element('p',source.evidence.text);item.append(element('h3',contributionLabels[row.role]||row.role),question,element('small',`${row.lens} · ${row.unitId}`));if(contextForSource)item.append(contextForSource(row.unitId));group.relationships.set(relationshipKey,item);group.paper.append(item);if(selector&&typeof navigator?.destination==='function'){item.setAttribute('data-paper-question','pending');group.pending.push({item,question,unitId:row.unitId});}}
      const count=group.relationships.size;group.summary.textContent=`${group.title} (${count} contribution${count===1?'':'s'}${group.count!==count?`; ${group.count} review observations`:''})`;
      const observation=element('section');observation.className='contribution-observation';observation.append(element('p',row.basis==='source_excerpt_checked'?'Source excerpt checked; see this destination’s reading limits.':'Extracted description checked; this does not claim a full-paper reading.'));
      if(row.qualification)observation.append(element('p',row.qualification));
      const provenance=element('details');provenance.append(element('summary','Review observation and evidence references'),element('pre',JSON.stringify({role:row.role,basis:row.basis,decisionId:row.decisionId,scopeContentSha256:row.scopeContentSha256,evidenceRefs:row.evidenceRefs,provenance:row.provenance},null,2)));observation.append(provenance);item.append(observation);
    }
    for(const group of groups.values())linkQuestions(group);offset+=page.length;progress.textContent=`${offset} of ${rows.length} review observations loaded for ${relationshipCount} source-and-role relationships; separate from membership.`;more.hidden=offset>=rows.length;more.textContent='Read next contributions';more.disabled=false;
  }catch(error){started=false;more.disabled=false;onError(error.message);}};
  more.addEventListener('click',load);disclosure.addEventListener('toggle',()=>{if(disclosure.open&&!started)return load();});return disclosure;
}

/* Supplemental relation reviews (SW-006). A supplemental review is a later reviewer's reading of one route's source, kept beside the
 * route's frozen record and shown inline in that route's "Sources and review record" disclosure, after the record's own lines. It uses
 * the D4 review-record format: an external_citation (a versioned arXiv link, its reading level and PDF hash binding) and a
 * review_derivation (attribution, source binding, the review's own findings and status), plus `display`, which names the review
 * fields shown and their labels. It is bound to one relation ID and the exact SHA-256 of that relation's record (which the navigator
 * checks on reading it), so a different or re-issued record shows no review. It never edits the record, the route, its
 * qualification, or either endpoint's scope or reading limits.
 * Reviews reach the browser only per atlas: a manifest may declare files.relationReviews, which relationReviewReader reads once through
 * that atlas's checksummed reader. Without a descriptor nothing is requested and the disclosure renders exactly as before; a file that
 * fails its checksum or verification shows no review and marks the disclosure data-relation-reviews="unavailable". Tests supply
 * fixtures as an atlas would. Builder integration is pending: the served release declares no such file. */
const RELATION_REVIEWS='swampwiki-relation-reviews';
const filledText=(value,max)=>typeof value==='string'&&value.trim()!==''&&value.length<=max;
const versionedArxiv=(url,kind,paperId,version)=>{try{const parsed=new URL(url);return parsed.protocol==='https:'&&parsed.hostname==='arxiv.org'&&!parsed.port&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash&&parsed.pathname===`/${kind}/${paperId}${version}`;}catch{return false;}};
/** Why a supplemental review cannot be shown (a short reason), or null when it is well formed. */
export function relationReviewProblem(review){
  if(!filledText(review?.id,300)||!filledText(review.relationId,300))return 'identity';
  if(!/^[a-f0-9]{64}$/.test(review.recordSha256||''))return 'record binding';
  if(!filledText(review.heading,200)||!filledText(review.summary,800))return 'heading or summary';
  const refs=Array.isArray(review.evidenceRefs)&&review.evidenceRefs.length<=20?review.evidenceRefs:null;if(!refs)return 'evidence references';
  const citation=refs.find(ref=>ref?.localRef===review.citation),derivation=refs.find(ref=>ref?.localRef===review.review);
  if(citation?.kind!=='external_citation'||!filledText(citation.paperId,100)||!/^v\d+$/.test(citation.version||'')||!filledText(citation.title,300)||!filledText(citation.authors,300)||!/^\d{4}-\d{2}-\d{2}$/.test(citation.versionDate||'')||!filledText(citation.binding,1200))return 'citation';
  if(!versionedArxiv(citation.absUrl,'abs',citation.paperId,citation.version)||!versionedArxiv(citation.pdfUrl,'pdf',citation.paperId,citation.version))return 'versioned paper link';
  if(citation.pdfSha256!==undefined&&!/^[a-f0-9]{64}$/.test(citation.pdfSha256))return 'citation';
  if(derivation?.kind!=='review_derivation'||derivation.reviews!==citation.localRef||derivation.paperId!==citation.paperId||derivation.version!==citation.version||!filledText(derivation.review,200)||!filledText(derivation.attribution,800)||!filledText(derivation.status,400))return 'review';
  if(derivation.source?.pdfSha256!==undefined&&derivation.source.pdfSha256!==citation.pdfSha256)return 'source binding';
  const fields=new Set();
  if(!Array.isArray(review.display)||!review.display.length||review.display.length>10||!review.display.every(item=>filledText(item?.label,100)&&typeof item.field==='string'&&!fields.has(item.field)&&fields.add(item.field)&&filledText(derivation[item.field],1600)))return 'display';
  return null;
}
/** Checks a supplemental review document without installing it. Malformed or duplicate reviews are left out with a reason. Returns
 * {reviews, accepted, rejected[, error]} (reviews are copies; accepted lists their IDs) and never throws. */
export function verifyRelationReviews(value){
  if(value==null)return {reviews:[],accepted:[],rejected:[]};
  if(value.kind!==RELATION_REVIEWS||value.schemaVersion!=='1.0.0'||!Array.isArray(value.reviews)||value.reviews.length>500)return {reviews:[],accepted:[],rejected:[],error:'unsupported relation review document'};
  const reviews=[],rejected=[];
  for(const review of value.reviews){const problem=relationReviewProblem(review)||(reviews.some(item=>item.id===review.id)?'duplicate ID':null);if(problem)rejected.push({id:typeof review?.id==='string'?review.id:null,reason:problem});else reviews.push(structuredClone(review));}
  return {reviews,accepted:reviews.map(review=>review.id),rejected};
}
/** The supplemental reviews of one loaded atlas. When its manifest declares files.relationReviews, the first call reads that file once
 * through the atlas's own checksummed reader (atlas.readShard: path, byte count and SHA-256 must match the manifest) and verifies it as
 * above; refused reviews are left out. Without a descriptor it resolves to [] and makes no request. A failed read or unsupported
 * document rejects, and a later call tries again. The reviews stay with this reader, so another atlas's disclosures never get them. */
export function relationReviewReader(atlas){
  const descriptor=atlas?.manifest?.files?.relationReviews;
  if(descriptor==null)return async()=>[];
  let pending=null;
  return ()=>pending??=(async()=>{
    if(typeof atlas.readShard!=='function')throw new Error('relation reviews require the checksummed atlas reader');
    const {reviews,error}=verifyRelationReviews(await atlas.readShard(descriptor));if(error)throw new Error(error);return reviews;
  })().catch(error=>{pending=null;throw error;});
}
/** The verified reviews bound to this relation's exact record: same relation ID and the record SHA-256 the atlas indexes for it. */
export function relationReviewsFor(relation,record,reviews=[]){
  const recordSha256=relation?.detail?.recordSha256;if(!recordSha256||record?.id!==relation.id)return [];
  return reviews.filter(review=>review.relationId===relation.id&&review.recordSha256===recordSha256);
}
let relationReviewCount=0;
/** One supplemental review, inline: heading, summary, the versioned paper link and its hash binding, the displayed findings, the
 * review's attribution and status, and the structured entry itself. */
function relationReviewSection(review){
  const refs=new Map(review.evidenceRefs.map(ref=>[ref.localRef,ref])),citation=refs.get(review.citation),derivation=refs.get(review.review),key=`relation-review-${++relationReviewCount}`;
  const section=element('section',undefined,'relation-review'),heading=element('h4',review.heading);heading.id=key;
  section.setAttribute('aria-labelledby',key);section.setAttribute('data-review-id',review.id);section.setAttribute('data-review-relation-id',review.relationId);
  const paper=element('p',undefined,'relation-review-paper'),link=element('a',`arXiv:${citation.paperId}${citation.version}`);link.href=citation.absUrl;link.target='_blank';link.rel='noopener noreferrer';
  paper.append(link,element('span',` · ${citation.authors}, “${citation.title}” (${citation.version}, ${citation.versionDate})`));
  const findings=element('dl',undefined,'relation-review-findings');for(const item of review.display){const row=element('div');row.append(element('dt',item.label),element('dd',derivation[item.field]));findings.append(row);}
  const raw=element('details');raw.append(element('summary','Structured review entry'),element('pre',JSON.stringify({id:review.id,relationId:review.relationId,recordSha256:review.recordSha256,evidenceRefs:review.evidenceRefs},null,2)));
  section.append(heading,element('p',review.summary),paper,element('p',citation.binding,'relation-review-binding'),findings,element('p',derivation.attribution,'relation-review-attribution'),element('small',derivation.status),raw);
  return section;
}

function relationProofDisclosure(relation,navigator,selector,readReviews){
  const box=element('details'),body=element('div');box.append(element('summary','Sources and review record'),body);let started=false;
  box.addEventListener('toggle',async()=>{if(!box.open||started)return;started=true;body.textContent='Loading the checked source record…';
    // Supplemental reviews are read beside the record; a failed read never holds back the record and shows no review.
    const reviews=readReviews?Promise.resolve().then(readReviews).catch(()=>null):Promise.resolve([]);
    try{const record=await navigator.readRelation(relation.id),supplemental=await reviews;if(!box.isConnected)return;body.replaceChildren(element('p',`${record.evidenceIds.length} recorded source references. ${record.status}.`));
      const descriptor=navigator.relationFile(relation.id),link=element('a','Complete evidence, qualifications and review history');link.href=`/data/atlas/${encodeURIComponent(selector.atlasId)}/${encodeURIComponent(selector.atlasVersion)}/${descriptor.path}`;link.target='_blank';link.rel='noopener noreferrer';body.append(link,element('small',`Record ${record.id}. SHA-256 ${relation.detail.recordSha256}.`));
      if(supplemental===null)box.setAttribute('data-relation-reviews','unavailable');
      else{const shown=relationReviewsFor(relation,record,supplemental);if(shown.length){box.setAttribute('data-relation-reviews',String(shown.length));for(const review of shown)body.append(relationReviewSection(review));}}
    }catch(error){if(box.isConnected){body.textContent=`Source record unavailable: ${error.message}`;started=false;}}
  });return box;
}

export function renderAtlasPanel({capsule,navigator,manifest,readSources,readRelationReviews,sourceHistory=[],contextForSource,onNavigate,onError}) {
  let host=document.getElementById('atlas-panel');
  if(!host){host=element('section',undefined,'atlas-panel');host.id='atlas-panel';document.querySelector('.explorer').after(host);}
  host.replaceChildren();host.hidden=!capsule.snapshot.view.atlas;const previousSummary=document.getElementById('atlas-current-summary');if(previousSummary)previousSummary.hidden=host.hidden;if(host.hidden)return;
  const {atlas}=capsule.snapshot.view,record=atlas.destination,selector=atlas.selector;
  const presentation=destinationPresentation(record);
  let currentSummary=document.getElementById('atlas-current-summary');if(!currentSummary){currentSummary=element('p',undefined,'atlas-summary');currentSummary.id='atlas-current-summary';document.getElementById('full-question-details').insertBefore(currentSummary,document.getElementById('full-question-text'));}currentSummary.textContent=presentation.summary;currentSummary.hidden=false;
  if(atlas.sourceInspection){
    const inspected=atlas.sourceInspection,panel=element('section',undefined,'source-inspection');panel.id='source-inspection-panel';panel.setAttribute('data-object-id',inspected.object.id);
    panel.append(element('h2',`Source method · ${inspected.source.paperId}`),element('p',`Current map location: ${record.title}`),element('p',inspected.notice),element('p',inspected.object.text));
    if(/^https?:\/\//.test(inspected.source.sourceUrl||'')){const link=element('a',paperTitle(inspected.source.title));link.title=inspected.source.title;link.href=inspected.source.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';panel.append(link);}
    const relation=element('details');relation.append(element('summary',`${inspected.relation.type.replaceAll('_',' ')} · ${inspected.relation.semanticStatus.replaceAll('_',' ')}`),element('p',`${inspected.relation.source} → ${inspected.relation.target}`));
    if(inspected.relation.statement)relation.append(element('p',inspected.relation.statement));if(inspected.relation.readerNote)relation.append(element('p',inspected.relation.readerNote));
    relation.append(element('p',`Inspecting the ${inspected.endpointSide} endpoint does not reverse this recorded direction.`));
    if(inspected.relation.premises)relation.append(element('h3','Conditions and qualifications'),element('pre',JSON.stringify(inspected.relation.premises,null,2)));
    const origin=element('details');origin.append(element('summary','Exact source identity and provenance'),element('pre',JSON.stringify({target:inspected.target,mapping:inspected.mapping,object:inspected.object,relation:inspected.relation},null,2)));relation.append(origin);panel.append(relation);
    if(contextForSource)panel.append(contextForSource(inspected.target.unitId));const close=element('button','Return to this physics question');close.type='button';close.addEventListener('click',()=>onNavigate({type:'close-source'}));panel.append(close);host.append(panel);
  }
  if(sourceHistory.length){const history=element('details');history.className='source-inspection-history';history.append(element('summary',`Source inspection history (${sourceHistory.length})`));const list=element('ol');for(const row of sourceHistory){const item=element('li'),button=element('button',row.label);button.type='button';button.title=`${row.target.relationId} · ${row.target.objectId}`;button.setAttribute('data-history-index',String(row.index));if(row.active)button.setAttribute('aria-current','step');button.addEventListener('click',()=>onNavigate({type:'replay',index:row.index}));item.append(button);list.append(item);}history.append(list);host.append(history);}
  const scope=element('details'),summary=element('summary',record.metadataOnly?'Collection scope and coverage':'Scope, assumptions and sources');scope.append(summary);
  if(record.whyItMatters)scope.append(element('p',record.whyItMatters));
  for(const [key,label]of[['systems','Systems'],['targets','Targets'],['includes','Includes'],['excludes','Distinctions and exclusions'],['assumptions','Assumptions'],['regimes','Regimes'],['conventions','Conventions']]){
    if(!presentation.scope[key]?.length)continue;scope.append(element('h3',label));const list=element('ul');for(const value of presentation.scope[key])list.append(element('li',value));scope.append(list);
  }
  if(record.methods?.length){scope.append(element('h3','Methods'));const list=element('ul');for(const method of record.methods)list.append(element('li',typeof method==='string'?method:method.label||method.description||JSON.stringify(method)));scope.append(list);}
  for(const reading of presentation.reading)scope.append(element('p',reading));
  if(presentation.readingRecord){const raw=element('details');raw.append(element('summary','Full reading coverage record'),element('pre',JSON.stringify(presentation.readingRecord,null,2)));scope.append(raw);}
  scope.append(element('p',`Scientific status: ${record.scientificStatus}. Placement: ${record.placementStatus}.`,'atlas-provenance'));
  if(record.sourceHomeStatus==='unresolved'){scope.append(element('p',presentation.sourceHomeNotice));const reason=element('details');reason.append(element('summary','Placement context'),element('p',record.sourceHomeReason||'This source remains available without an assigned scientific home.'));scope.append(reason);}
  if(!record.metadataOnly)scope.append(element('p',atlas.membershipNotice));
  if(record.metadataOnly)for(const source of navigator?.getEvidence?.(record.evidenceIds||[])||[]){if(!/^https?:\/\//.test(source.sourceUrl||''))continue;const link=element('a',source.title);link.href=source.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';scope.append(link);}
  const coverage=element('div');
  for(const [key,label]of[['sourceContextSummary','Frozen source inventory and context coverage'],['unrepresentedPapers','Bibliographic records without source text']]){const file=manifest?.files?.[key];if(!file||!(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*\.json$/.test(file.path))||file.path.split('/').includes('..'))continue;const line=element('p'),link=element('a',label);link.href=`/data/atlas/${encodeURIComponent(selector.atlasId)}/${encodeURIComponent(selector.atlasVersion)}/${file.path}`;line.append(link);coverage.append(line);}
  if(coverage.children.length){scope.append(element('h3','Coverage of the frozen source collection'),coverage);}
  const browse=element('button',`Browse all ${atlas.membershipCount.toLocaleString()} sources`);browse.type='button';const sourceList=element('div',undefined,'atlas-member-list');let offset=0;
  browse.hidden=atlas.membershipCount===0;
  browse.addEventListener('click',async()=>{browse.disabled=true;try{await navigator.prepareSources?.(selector.destinationId);const page=navigator.sources(selector.destinationId,{offset,limit:20});const rows=await readSources(page.items);if(!host.isConnected||capsule.snapshot.view.atlas.selector.destinationId!==selector.destinationId)return;for(const row of rows){const source=row.source,line=element('article');const title=element('a',source.title);let url;try{url=new URL(source.sourceUrl);}catch{}if(url&&['http:','https:'].includes(url.protocol)){title.href=url.href;title.target='_blank';title.rel='noopener noreferrer';}line.append(title,element('p',source.evidence.text),element('small',`${source.evidence.lens||'Source'} · ${source.evidence.date||'date unavailable'} · ${source.id}`));appendSourceCoverage(line,row,{navigator,selector,onNavigate});sourceList.append(line);}offset+=rows.length;browse.textContent=offset<page.total?`Show next sources (${offset} of ${page.total})`:`All ${page.total} sources shown`;browse.disabled=offset>=page.total;}catch(error){browse.disabled=false;onError(error.message);}});
  scope.append(browse,sourceList);
  if(atlas.contextMembershipCount){
    const methods=element('button',`Browse recorded methods (${atlas.contextMembershipCount} contextual associations)`),methodList=element('div',undefined,'atlas-member-list');methods.type='button';let methodOffset=0;
    methods.addEventListener('click',async()=>{methods.disabled=true;try{await navigator.prepareSources?.(selector.destinationId);const page=navigator.sources(selector.destinationId,{offset:methodOffset,limit:20,lens:'method',includeContext:true}),rows=await readSources(page.items);if(!methodList.isConnected)return;for(const row of rows){const source=row.source,line=element('article'),link=element('a',source.title);if(/^https?:\/\//.test(source.sourceUrl||'')){link.href=source.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';}line.append(link,element('p',source.evidence.text),element('small',`${row.associationScope?'Same-paper context; applicability is not established':'Primary recorded source'} · ${source.id}`));appendSourceCoverage(line,row,{navigator,selector,onNavigate});methodList.append(line);}methodOffset+=rows.length;methods.textContent=methodOffset<page.total?`Show next methods (${methodOffset} of ${page.total})`:`All ${page.total} method descriptions shown`;methods.disabled=methodOffset>=page.total;}catch(error){methods.disabled=false;onError(error.message);}});
    scope.append(element('p','Contextual methods share a paper with primary sources. This association does not establish that the method applies to every question here.'),methods,methodList);
  }
  host.append(scope);
  if(presentation.notes.length){
    const history=element('details');history.append(element('summary','Reading and record history'),element('p','Original review notes are retained here. Workflow notes describe how the record was made; they are not physical premises or a statement of its current review status.'));
    for(const note of presentation.notes){const item=element('article');item.append(element('h3',note.path==='/summary'?'Original summary':note.category==='reading'?'Reading limit':'Workflow note'),element('p',note.originalText));const origin=element('details');origin.append(element('summary','Exact origin and display decision'),element('p',note.reason),element('pre',JSON.stringify({origin:note.origin,path:note.path,scopeContentSha256:presentation.scopeContentSha256},null,2)));item.append(origin);history.append(item);}host.append(history);
  }
  if(record.scopedIdentity){const history=element('details');history.append(element('summary','Earlier reviewed definitions and reading limits'),element('p','These formulations share the accepted scoped-question destination. Their original definitions and reading limits remain available; this does not equate the underlying source statements.'));for(const original of record.scopedIdentity.originalDefinitions){const detail=element('details');detail.append(element('summary',original.title),element('p',original.question),element('p',original.summary));for(const [key,values]of Object.entries(original.scope||{})){if(!Array.isArray(values)||!values.length)continue;detail.append(element('h3',key.replaceAll('_',' ')));const list=element('ul');for(const value of values)list.append(element('li',typeof value==='string'?value:JSON.stringify(value)));detail.append(list);}const reading=element('details');reading.append(element('summary','Original reading coverage and identity'),element('pre',JSON.stringify({id:original.id,scientificStatus:original.scientificStatus,readingCoverage:original.readingCoverage,scopeContentSha256:original.scopeContentSha256,decisionId:record.scopedIdentity.decisionId,identityInventorySha256:record.scopedIdentity.identityInventorySha256},null,2)));detail.append(reading);history.append(detail);}host.append(history);}
  const contributions=sourceContributions(record,navigator,readSources,onError,contextForSource,{selector,onNavigate});if(contributions)host.append(contributions);
  const connections=element('details'),connectionList=element('div',undefined,'atlas-connection-list');connections.append(element('summary',`All connections (${atlas.connectionCount})`));
  for(const relation of atlas.connections){const row=element('div'),button=element('button',relation.choiceTitle||relation.title);row.setAttribute('data-relation-id',relation.id);button.type='button';button.addEventListener('click',()=>onNavigate({type:'navigate',selector:relation.selector}));row.append(button,element('span',` ${relation.navigationKind.replaceAll('_',' ')} · ${relation.traversal} recorded relation`),element('p',relation.rationale));if(relation.qualification)row.append(element('p',relation.qualification));if(relation.navigationKind==='collection_access')row.append(element('small',relation.accessNotice));if(relation.detail&&navigator)row.append(relationProofDisclosure(relation,navigator,selector,readRelationReviews));if(relation.organizationalAccess){const access=relation.organizationalAccess;row.append(element('small',`${access.uniqueWitnessCount} shared source question${access.uniqueWitnessCount===1?'':'s'} across the whole scope; independent of source filters.`));const proof=element('details');proof.append(element('summary','Why this question is linked'),element('p',relation.accessNotice));const link=element('a','Witnesses, qualifications and review decisions');link.href=`/data/atlas/${encodeURIComponent(selector.atlasId)}/${encodeURIComponent(selector.atlasVersion)}/${access.supportCertificate.path}`;link.target='_blank';link.rel='noopener noreferrer';proof.append(link);row.append(proof);}connectionList.append(row);}connections.append(connectionList);host.append(connections);
  const note=element('details'),textarea=element('textarea');note.append(element('summary','Your work on this question'));
  textarea.rows=4;textarea.maxLength=12000;textarea.placeholder='A private local work note, attached to this destination.';textarea.setAttribute('aria-label','Local research work note');textarea.value=readNote(selector)?.text||'';
  const notice=element('p','Saved on this browser only. Share destination links separately; your note is not included in them.'),actions=element('div',undefined,'tool-buttons'),feedback=element('p');
  const capture=()=>{const previous=readNote(selector),value={schemaVersion:'1.0.0',kind:'eigenquestions-work-note',id:previous?.id||crypto.randomUUID(),target:structuredClone(selector),text:textarea.value,createdAt:previous?.createdAt||new Date().toISOString(),modifiedAt:new Date().toISOString()};noteBuffers.set(noteKey(selector),value);return value;};
  const save=()=>{const value=capture();localStorage.setItem(noteKey(selector),JSON.stringify(value));return value;};
  textarea.addEventListener('input',()=>{try{save();feedback.textContent='Saved locally.';}catch{feedback.textContent='Local storage is unavailable. This edit is retained in this tab; export it before closing the tab.';}});
  for(const [label,handler]of[['Save note locally',()=>{save();feedback.textContent='Saved locally for this destination.';}],['Export note',()=>{download('swampwiki-work-note.json',capture());feedback.textContent='Exported note. The file contains your note text.';}]]){const button=element('button',label);button.type='button';button.addEventListener('click',()=>{try{handler();}catch(error){onError(error.message);}});actions.append(button);}
  const input=element('input');input.type='file';input.accept='.json,application/json';input.hidden=true;const open=element('button','Import note');open.type='button';open.addEventListener('click',()=>input.click());input.addEventListener('change',async()=>{try{const file=input.files[0];if(!file||file.size>64000)throw new Error('Note file is absent or exceeds 64 KB.');const value=JSON.parse(await file.text());if(value.kind!=='eigenquestions-work-note'||value.schemaVersion!=='1.0.0'||typeof value.text!=='string'||value.text.length>12000||!['kind','atlasId','atlasVersion','destinationId'].every(key=>value.target?.[key]===selector[key]))throw new Error('This note belongs to a different destination or version. Open that destination before importing.');textarea.value=value.text;save();feedback.textContent='Imported and saved locally.';}catch(error){onError(error.message);}finally{input.value='';}});actions.append(open,input);note.append(notice,textarea,actions,feedback);host.append(note);
}
