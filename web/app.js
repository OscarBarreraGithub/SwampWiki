import { currentState, exportSession, importSession, validateSession, selectionTarget, applyAction } from '/lib/protocol/session.mjs';
import {CAPSULE_KIND, ATLAS_BUILDER, MAX_JSON_BYTES, createCapsule, validateCapsule, capsuleCapabilities, decodeCapsuleBytes} from '/lib/protocol/capsule.mjs';
import {displayExcerpt,representativeInfo,previousVisitIndex} from '/lib/protocol/presentation.mjs';
import {atlasId as siteAtlasId} from '/lib/swampwiki.mjs';
import {loadAtlas,createAtlasNavigator,createAtlasSourceReader,atlasAddress} from '/lib/geometry/prepared-atlas.mjs';
import {renderAtlasPanel,contributionLabels,contributionBasisLabels,resolvePaperAttribution,nextPaperAttributionBatch,paperGroupTitle,paperGroupProgress,choiceFamily,choiceRoute,choiceKindLabel,choiceCountText,choiceGroupHeading,choiceGroupNote,choiceScope,relationReviewReader} from '/atlas-panel.mjs';
import {sourceContextDisclosure,readingClarificationReader} from '/source-context.mjs';
import {pageSourceContext} from '/lib/protocol/context-page.mjs';
import {physicsPath,sourceInspectionHistory,routeTarget,routeSession,installedAtlasIndex,installedAtlasEntry,checkInstalledManifest,retainVerifiedShards} from '/physics-path.mjs';
import {paperTitle} from '/paper-title.mjs';
import {appendSourceCoverage} from '/source-coverage.mjs';

const $ = id => document.getElementById(id);
let lastRenderedInspection = null, lastRenderedStep = null, sharedStateId = null;
const labels = { explore: 'Explore connections', derive: 'How is it derived?', phenomenology: 'Physical implications', recent: 'Recent within this corpus', using: 'Work using this idea', combined: 'Question + method', physical_question: 'Physical question', method: 'Methods', on: 'work on this idea', either: 'work on or using this idea' };
let session, view, selectedId, selectedDirectionId, bridge, events, revision = -1, busy = false, allEvidence = false;
let sourceEpoch = 0, userIntent = 0, draftVersion = 0, draftDirty = false;
let actionQueue = Promise.resolve(), loadingTask = Promise.resolve(), queuedBridgeSnapshot = null, bridgeNeedsRebase = false;
let bridgeRebaseRevision = null;
let activeCapsule, uiRevision = 0, routeGeneration = 0, routeAbort;
let acceptedCount = 0, renderedRevision = -1, resumeCandidate, resumeCompanion;
let columnAlignment = Promise.resolve(), columnAlignmentTicket = 0, visibleHistoryIndex = null, lastColumnWidth = 0, userColumnScroll = false;
const observers = new Set(), readyWaiters = [];
const atlasLoads = new Map(), installedAtlases = new Map();
// Paper attribution per computation and parent destination (see resolvePaperAttribution): identified rows and the links
// already tried. Bounded to 24 parents. expandedPaperStep is the step whose paper questions the reader chose to show in full.
const paperAttributions = new Map(); let paperAttributionTask = null, currentPaperGroup = null, expandedPaperStep = null;
// Choice-group reading notes a reader opened on a narrow screen, by note text, so they stay open on later steps and re-renders.
const openGroupNotes = new Set();
// Premise-check scopes a reader opened, by step and choice, so a re-render of that step or Back to it keeps them open.
const openChoiceScopes = new Set();
// The installed atlas index decides which atlas versions open (see installedAtlasIndex). installedIndex is its validated copy for
// synchronous checks once read; a failed read is retried on the next use rather than kept.
let preparedIndexPromise, installedIndex = null;
async function preparedIndex(){if(!preparedIndexPromise)preparedIndexPromise=fetch('/data/atlas/index.json').then(async response=>{if(!response.ok)throw new Error('The installed atlas catalog is unavailable.');return installedIndex=installedAtlasIndex(await response.json());}).catch(error=>{preparedIndexPromise=null;throw error;});return preparedIndexPromise;}
const installedSelector = selector => {try{return Boolean(installedIndex&&installedAtlasEntry(installedIndex,selector,siteAtlasId));}catch{return false;}};
function atAtlasEntrance(){const selector=session&&currentState(session).selector;return Boolean(selector&&selector.destinationId===installedAtlases.get(atlasKey(selector))?.atlas.manifest.entryDestinationId);}
const builtIn = capsule => capsule?.builder.id === ATLAS_BUILDER && capsule?.builder.version === '1.0.0';
const atlasKey = selector => `${selector.atlasId}/${selector.atlasVersion}`;
const installedIdentity = capsule => {const selector=capsule?.snapshot.session?.states[capsule.snapshot.session.cursor]?.selector;return selector?installedAtlases.get(atlasKey(selector))?.navigator.computationId:undefined;};
// Every browser, route and agent path opens an atlas here: only a version the installed index lists, and only its pinned manifest.
async function ensureAtlas(selector) {
  const entry=installedAtlasEntry(await preparedIndex(),selector,siteAtlasId),key=atlasKey(selector);
  if(!atlasLoads.has(key))atlasLoads.set(key,loadAtlas(`/data/atlas/${encodeURIComponent(selector.atlasId)}/${encodeURIComponent(selector.atlasVersion)}`).then(atlas=>{checkInstalledManifest(entry,atlas);atlas=retainVerifiedShards(atlas);const readSources=createAtlasSourceReader(atlas),navigator=createAtlasNavigator(atlas,{readSources}),loaded={atlas,navigator,readSources,readContext:navigator.readContext,readClarifications:readingClarificationReader(atlas)};loaded.readRelationReviews=relationReviewReader(atlas);installedAtlases.set(key,loaded);return loaded;}).catch(error=>{atlasLoads.delete(key);throw error;}));
  const loaded=await atlasLoads.get(key);await loaded.navigator.prepareDestination?.(selector.destinationId);return loaded;
}
function retainBranch(capsule) {
  if(!capsule?.context.question?.trim())return;
  try {const prior=JSON.parse(localStorage.getItem('eigenquestions:branches:v1')||'[]');prior.unshift(structuredClone(capsule));localStorage.setItem('eigenquestions:branches:v1',JSON.stringify(prior.slice(0,6)));}catch{}
}
const capsuleStorageKey = 'eigenquestions:view:v1';
const columnViews = new Map(), acceptedCapsules = new Map();
const columnStorageKey = 'eigenquestions:columns:v2';
try { for (const item of JSON.parse(localStorage.getItem(columnStorageKey) || '[]')) if (item?.stateId && Array.isArray(item.directions)) columnViews.set(item.stateId, item); } catch {}
let fragment = new URLSearchParams(location.hash.slice(1));
const storageKey = 'eigenquestions:session:v1';
const bridgeStorageKey = 'eigenquestions:companion:v1';
let viewerId;
try { viewerId = sessionStorage.getItem('eigenquestions:viewer:v1') || crypto.randomUUID(); sessionStorage.setItem('eigenquestions:viewer:v1', viewerId); }
catch { viewerId = crypto.randomUUID(); }

function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function safeUrl(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
function short(value, max = 90) { const str = String(value || ''); return str.length > max ? `${str.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : str; }
function setBusy(value, message = 'Updating directions…') {
  busy = value; document.body.classList.toggle('busy', value);
  document.body.dataset.busy = document.documentElement.dataset.busy = String(value);
  $('pending-indicator').hidden = !value; $('pending-label').textContent = message;
  $('explore-button').setAttribute('aria-busy', String(value));
}
function requireSwampWikiSnapshot(snapshot) {
  if (!snapshot.session?.states?.every(state => installedSelector(state.selector)) ||
      !installedSelector(snapshot.view?.atlas?.selector) || snapshot.view.chart) {
    throw new Error('Open a SwampWiki destination or an exported SwampWiki session.');
  }
}
function canAttemptContinuation() { return activeCapsule?.continuation.mode === 'native-actions' && Boolean(activeCapsule.snapshot.session); }
function historicalAction(stateId, direction) { const capsule = acceptedCapsules.get(stateId); return capsule?.continuation.actions.find(item => item.id === direction.id)?.action || (columnViews.get(stateId)?.authored ? null : {type:'select',directionId:direction.id}); }
function stateQuestion(state) { return acceptedCapsules.get(state.id)?.context.question || columnViews.get(state.id)?.question || state.query; }
function stepNumber(index) { return Math.max(1,physicsPath({...session,cursor:index},{activeOnly:true}).filter(step=>stateQuestion(step.state).trim()).length); }
function revisitFor(direction, atSession = session) {
  if (!builtIn(activeCapsule) || !atSession?.schemaVersion) return -1;
  try { return selectionTarget(atSession,direction).revisitIndex; } catch { return -1; }
}
function followDirection(direction) {
  const next = activeCapsule.continuation.actions.find(item => item.id === direction.id);
  if (!next || !canAttemptContinuation()) { status('This supplied group has no executable next action. Inspect its sources, or start a new path.', true); return; }
  const revisit = next.action.type === 'select' ? revisitFor(direction) : -1;
  return action(revisit >= 0 ? {type:'replay',index:revisit} : next.action, { explicitContinuation: true, viaDirectionId:direction.id });
}
function capabilities() { return activeCapsule ? capsuleCapabilities(activeCapsule, installedIdentity(activeCapsule)) : {display: false, recompute: false, continue: false}; }
function machineRead() {
  return structuredClone({apiVersion: '1.0.0', revision: uiRevision, busy, mode: bridge ? 'local-companion' : 'browser', renderedRevision,
    capabilities: capabilities(), capsule: activeCapsule ?? null});
}
function notifyAccepted() {
  ++uiRevision; ++acceptedCount;
  document.documentElement.dataset.uiRevision = String(uiRevision);
  document.documentElement.dataset.acceptedCount = String(acceptedCount);
  const accepted = uiRevision;
  columnAlignment.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (uiRevision !== accepted) return;
    renderedRevision = accepted; document.documentElement.dataset.renderedRevision = String(accepted);
  })));
  const snapshot = machineRead();
  for (const resolve of readyWaiters.splice(0)) resolve(snapshot);
  for (const callback of observers) { try { callback(structuredClone(snapshot)); } catch { /* Observer errors do not change the scientific state. */ } }
  window.dispatchEvent(new CustomEvent('eigenquestions:state', {detail: snapshot}));
}
function assertRevision(expected) {
  if (!Number.isInteger(expected) || expected !== uiRevision) {
    const error = new Error('The visible view changed. Read the current revision before applying another view.'); error.code = 'revision_conflict'; error.current = machineRead(); throw error;
  }
}
function save() {
  if (!session) return;
  try { if (!atAtlasEntrance() && activeCapsule && (activeCapsule.context.question.trim() || view.nodes.length)) localStorage.setItem(capsuleStorageKey, JSON.stringify(activeCapsule)); if (!atAtlasEntrance() && activeCapsule?.snapshot.session && (activeCapsule.context.question.trim() || view.nodes.length)) localStorage.setItem(storageKey, JSON.stringify(exportSession(session))); } catch {}
  const cached = [...columnViews.values()].slice(-24);
  setTimeout(() => { try { localStorage.setItem(columnStorageKey, JSON.stringify(cached)); } catch {} }, 0);
}
function rememberView(result) {
  if (activeCapsule) { acceptedCapsules.delete(result.stateId); acceptedCapsules.set(result.stateId, structuredClone(activeCapsule)); while (acceptedCapsules.size > 24) acceptedCapsules.delete(acceptedCapsules.keys().next().value); }
  const previous = columnViews.get(result.stateId);
  columnViews.delete(result.stateId);
  const papers = paperAccessRows(result);
  columnViews.set(result.stateId, { question: activeCapsule?.context.question || result.query, transitions: previous?.transitions || {}, authored: !builtIn(activeCapsule), stateId: result.stateId, computationId: result.computationId, directions: result.directions.map(direction => {const {id,label,query,seedIds,sourceCount,evidenceIds,intent,lens,workRelation,selector,navigationKind,summary,metadataOnly}=direction;return {id,label,query,seedIds,sourceCount,evidenceIds,intent,lens,workRelation,...(selector?{selector,navigationKind,summary:summary||'',metadataOnly:Boolean(metadataOnly),...(choiceRoute(direction)?{route:choiceRoute(direction)}:{})}:{}),...representativeInfo(direction,result.nodes,!builtIn(activeCapsule))};}), ...(papers ? {papers} : {}) });
  while (columnViews.size > 24) columnViews.delete(columnViews.keys().next().value);
}
function clearViewRoute() { const hash = new URLSearchParams(location.hash.slice(1)); if (hash.has('view') || hash.has('focus') || hash.has('atlas')) history.replaceState(null, '', location.pathname + location.search); }
let lookupGeneration=0;
function clearLookupForDestination(next){
  const previous=activeCapsule?.snapshot.view.atlas?.selector,target=next?.atlas?.selector;
  if(['atlasId','atlasVersion','destinationId'].some(key=>previous?.[key]!==target?.[key])){++lookupGeneration;$('atlas-lookup')?.replaceChildren();}
}
function accept(snapshot, { formVersion, keepRoute = false, preserveContext = false, context: suppliedContext } = {}) {
  if (!snapshot?.session || !snapshot?.view) throw new Error('The companion returned an incomplete session.');
  requireSwampWikiSnapshot(snapshot);
  const next = validateSession(snapshot.session);
  if (snapshot.view.corpusId !== next.corpusId || snapshot.view.computationId !== next.computationId || snapshot.view.stateId !== currentState(next).id) throw new Error('The view does not match the current question or computation. Reconnect or import a fresh session.');
  if (!Array.isArray(snapshot.view.nodes) || !Array.isArray(snapshot.view.directions)) throw new Error('The companion returned an invalid view.');
  if (snapshot.revision !== undefined && snapshot.revision <= revision) return false;
  if (snapshot.revision !== undefined) revision = snapshot.revision;
  clearLookupForDestination(snapshot.view);
  const previousContext = suppliedContext || (preserveContext ? activeCapsule?.context : null);
  activeCapsule = createCapsule(snapshot, previousContext ? {context: {...structuredClone(previousContext), question: currentState(next).query, history: next.states.map((s, index) => ({question: s.query, focusIds: s.focusIds, active: index === next.cursor}))}} : {});
  session = next; view = activeCapsule.snapshot.view; selectedId = null; selectedDirectionId = null; allEvidence = false;
  if (formVersion !== undefined && formVersion === draftVersion) draftDirty = false;
  rememberView(view); render(); save(); notifyAccepted();
  if(currentState(next).selector){try{const url=atlasAddress(currentState(next),location.origin),entry={eigenquestionsSession:exportSession(next)};if(keepRoute)history.replaceState(entry,'',url);else history.pushState(entry,'',url);lastReadRoute=location.href+JSON.stringify(history.state);}catch{clearViewRoute();/* Unsupported filters stay in the local capsule, never behind a stale address. */}}
  if (bridge && Number.isInteger(snapshot.revision)) {
    const renderedState = currentState(next).id, source = sourceEpoch;
    columnAlignment.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (bridge && source === sourceEpoch && document.documentElement.dataset.stateId === renderedState) bridgeFetch('/api/viewer', { method: 'POST', body: JSON.stringify({ viewerId, stateId: renderedState, revision: snapshot.revision }) }).catch(() => {});
    })));
  }
  return true;
}
function acceptCapsule(input, {expectedRevision, clearForm = false, keepRoute = false, persist = true, preserveCompanion = false} = {}) {
  if (expectedRevision !== undefined) assertRevision(expectedRevision);
  const capsule = structuredClone(validateCapsule(input));
  requireSwampWikiSnapshot(capsule.snapshot);
  if (!builtIn(capsule)) throw new Error('This view needs the SwampWiki prepared navigator.');
  if (!keepRoute) clearViewRoute();
  ++routeGeneration; routeAbort?.abort();
  ++userIntent; ++sourceEpoch; events?.close(); bridge = null; revision = -1;
  if (!preserveCompanion) { try { sessionStorage.removeItem(bridgeStorageKey); } catch {} }
  queuedBridgeSnapshot = null; bridgeNeedsRebase = false; actionQueue = Promise.resolve(); loadingTask = Promise.resolve();
  clearLookupForDestination(capsule.snapshot.view);
  activeCapsule = capsule; session = capsule.snapshot.session; view = capsule.snapshot.view;
  selectedId = null; selectedDirectionId = null; allEvidence = false;
  if (clearForm) draftDirty = false;
  $('connection-status').textContent = 'Browser session';
  rememberView(view); render(); if(persist)save(); setBusy(false); notifyAccepted();
  return machineRead();
}
function action(payload, { followup, operation = 'action', clearForm = false, viaDirectionId } = {}) {
  ++routeGeneration; routeAbort?.abort();
  const ticket = ++userIntent, source = sourceEpoch, formVersion = draftVersion;
  const baseCapsule = activeCapsule;
  const baseSession = activeCapsule?.snapshot.session ? structuredClone(activeCapsule.snapshot.session) : null, baseRevision = revision;
  const transport = bridge;
  setBusy(true, payload.type === 'reset' ? 'Starting a new path…' : 'Updating directions…');
  status('Computing directions from the current sources…');
  const run = async () => {
    try {
      await loadingTask;
      if (ticket !== userIntent || source !== sourceEpoch) return;
      let result;
      if (transport) {
        let expectedRevision = baseRevision < 0 ? revision : baseRevision;
        if (bridgeNeedsRebase && baseSession && payload.type !== 'reset') {
          const restored = await bridgeFetch('/api/import', { method: 'POST', headers: { 'If-Match': `"${bridgeRebaseRevision}"` }, body: JSON.stringify(exportSession(baseSession)) }, transport);
          expectedRevision = restored.revision;
          if (ticket !== userIntent || source !== sourceEpoch) { bridgeNeedsRebase = true; bridgeRebaseRevision = restored.revision; return; }
        } else if (bridgeNeedsRebase && payload.type === 'reset') {
          expectedRevision = bridgeRebaseRevision;
        }
        bridgeNeedsRebase = false;
        result = await bridgeFetch(operation === 'import' ? '/api/import' : '/api/action', { method: 'POST', headers: { 'If-Match': `"${expectedRevision}"` }, body: JSON.stringify(payload) }, transport);
      } else if (payload.selector || baseSession && currentState(baseSession).selector) {
        const selector=payload.selector || currentState(baseSession).selector,prepared=await ensureAtlas(selector);
        if(ticket!==userIntent||source!==sourceEpoch)return {superseded:true};
        if(operation==='import'){const imported=importSession(payload,{corpusId:prepared.atlas.manifest.corpusId,computationId:prepared.navigator.computationId});await prepared.navigator.prepareState?.(currentState(imported));result={session:imported,view:prepared.navigator.computeView(currentState(imported))};}
        else {
          const same=baseSession?.computationId===prepared.navigator.computationId;
          if(!same)retainBranch(baseCapsule);
          const starting=same?baseSession:prepared.navigator.createSession({selector,intent:payload.intent||'explore',lens:payload.lens||'combined',workRelation:payload.workRelation||'either'});
          if(same)await prepared.navigator.prepareAction?.(starting,payload);else await prepared.navigator.prepareState?.(currentState(starting));
          if(ticket!==userIntent||source!==sourceEpoch)return {superseded:true};
          result=!same?{session:starting,view:prepared.navigator.computeView(currentState(starting))}:applyAction(starting,payload,prepared.navigator);
        }
      } else throw new Error('Open a SwampWiki destination before navigating.');
      if (ticket !== userIntent || source !== sourceEpoch) { if (transport && source === sourceEpoch) { bridgeNeedsRebase = true; bridgeRebaseRevision = result.revision; } return; }
      if (followup) {
        if (transport) result = await bridgeFetch('/api/action', {method:'POST', headers:{'If-Match':`"${result.revision}"`}, body:JSON.stringify(followup)}, transport);
        else {
          const {navigator} = await ensureAtlas(currentState(result.session).selector);
          await navigator.prepareAction(result.session,followup);
          result = applyAction(result.session,followup,navigator);
        }
      }
      if (ticket !== userIntent || source !== sourceEpoch) { if (transport && source === sourceEpoch) { bridgeNeedsRebase = true; bridgeRebaseRevision = result.revision; } return; }
      // Agent changes may have arrived while this request's response was delayed.
      const externalReplacement = queuedBridgeSnapshot && queuedBridgeSnapshot.revision > (result.revision ?? -1);
      if (externalReplacement) result = queuedBridgeSnapshot;
      queuedBridgeSnapshot = null;
      const fromIndex = payload.type === 'replay' && followup ? payload.index : baseSession?.cursor;
      const fromState = baseSession?.states[fromIndex];
      if (!externalReplacement && fromState && result.view.stateId !== fromState.id && operation === 'action' && !['reset','back','forward','replay'].includes(followup?.type || payload.type)) {
        const parent = columnViews.get(fromState.id);
        if (parent) parent.transitions = {...parent.transitions,[result.view.stateId]:{type:followup?.type || payload.type,directionId:viaDirectionId || followup?.directionId || payload.directionId || null}};
      }
      if (payload.type === 'reset') activeCapsule = null;
      accept(result, { formVersion: clearForm ? formVersion : undefined, context: (['replay','back','forward'].includes(payload.type) && !followup ? acceptedCapsules.get(result.view.stateId)?.context : undefined), preserveContext: !externalReplacement && operation === 'action' && !['reset','pivot','replay','back','forward'].includes(payload.type) });
      return machineRead();
    } catch (error) {
      if (ticket === userIntent && source === sourceEpoch) {
        if (error.current) { draftDirty = true; bridgeNeedsRebase = false; const latest = queuedBridgeSnapshot?.revision > error.current.revision ? queuedBridgeSnapshot : error.current; queuedBridgeSnapshot = null; accept(latest); }
        status(error.message, true);
      }
      return {error: error.message, code: error.code || 'action_failed'};
    }
    finally {
      if (ticket === userIntent && source === sourceEpoch) {
        setBusy(false);
        if (queuedBridgeSnapshot) { const queued = queuedBridgeSnapshot; queuedBridgeSnapshot = null; accept(queued); }
      }
    }
  };
  actionQueue = actionQueue.catch(() => {}).then(run);
  return actionQueue;
}
// Rebuilding the path and columns removes the control that was just used, which drops keyboard focus to <body>
// and sends the next Tab back to Step 1. Keep focus on the same control when a render keeps the step; otherwise
// move it to the active step's heading: Tab reaches the new choices, Shift+Tab earlier steps, Back and New path.
// A destination followed from All connections, or a paper question opened from Source contributions, is rebuilt with the
// panel too, so it continues from that heading.
function navigationFocus() {
  const active = document.activeElement;
  if (active === $('back')) return {back: true};
  if (active?.closest?.('#path')) return {crumb: [...$('path').querySelectorAll('button')].indexOf(active)};
  if (active?.closest?.('#atlas-panel .atlas-connection-list') || active?.matches?.('#atlas-panel a.contribution-question')) return {connection: true};
  const column = active?.closest?.('#columns > .miller-column');
  return column ? {stateId: column.dataset.stateId, directionId: active.closest('.direction-row, .paper-row')?.querySelector('.direction, .paper-question')?.dataset.directionId, sources: active.classList.contains('direction-evidence'), scope: active.classList.contains('direction-scope-toggle'), read: active.classList.contains('paper-read')} : null;
}
function restoreNavigationFocus(saved, sameStep) {
  const active = document.activeElement;
  if (!saved || (active && active !== document.body && active.isConnected && !active.disabled)) return;
  let target = null;
  if (sameStep && saved.crumb >= 0) target = $('path').querySelectorAll('button')[saved.crumb];
  else if (sameStep && saved.directionId) {
    const column = [...$('columns').children].find(item => item.dataset.stateId === saved.stateId);
    const row = [...(column?.querySelectorAll('.direction, .paper-question') || [])].find(item => item.dataset.directionId === saved.directionId)?.closest('.direction-row, .paper-row');
    target = row?.querySelector(saved.sources ? '.direction-evidence' : saved.scope ? '.direction-scope-toggle' : saved.read ? '.paper-read' : '.direction, .paper-question');
  }
  if (!target || target.disabled) target = $('columns').querySelector('.miller-column[data-current="true"] > .current-column-heading');
  target?.focus({preventScroll: true});
}
function render() {
  const state = currentState(session), scope = view.diagnostics?.scope || {}, displayQuestion = activeCapsule.context.question;
  const savedFocus = navigationFocus(), sameStep = lastRenderedStep === state.id;
  // A new step starts with its paper questions folded and drops paper identification still running for the previous step.
  if (!sameStep) { expandedPaperStep = null; paperAttributionTask = null; }
  if (sharedStateId !== state.id) $('share-result').hidden = true;
  $('home-heading').hidden = true;
  $('exploration-workspace').hidden = false;
  document.querySelector('.reading-pane').hidden = Boolean(view.atlas.destination.metadataOnly);
  refreshResume(atAtlasEntrance());
  document.documentElement.classList.add('prepared-view');
  $('columns').after($('full-question-details'));
  $('full-question-details').append($('current-context'));
  $('full-question-details').hidden = false;
  $('full-question-details').querySelector('summary').textContent = 'Question summary and full context';
  $('atlas-lookup-note').hidden = false;
  $('current-question').textContent = atAtlasEntrance() ? 'Swampland collection' : view.atlas.destination.shortTitle || view.atlas.destination.title;
  $('full-question-text').textContent = displayQuestion;
  if (!draftDirty) {
    $('question').value = '';
    $('intent').value = state.intent;
    $('lens').value = state.lens;
    $('work-relation').value = state.workRelation;
  }
  $('back').disabled = session.cursor === 0 || !canAttemptContinuation();
  $('path').replaceChildren();
  physicsPath(session).forEach((step, position) => {
    const {state:item,index}=step;
    if (position) $('path').append(el('span', 'path-arrow', '›'));
    const pathQuestion = bridge ? item.query : stateQuestion(item);
    const visit = builtIn(activeCapsule) && !columnViews.get(item.id)?.authored ? previousVisitIndex(session,index) : -1,earlier=visit<step.startIndex?visit:-1;
    const button = el('button', '', earlier>=0 ? `Return to step ${stepNumber(earlier)}` : displayExcerpt(pathQuestion,48) || 'New path'); button.type = 'button'; button.title = `${item.query || 'New path'} · ${labels[item.intent]}`;
    button.setAttribute('aria-label', pathQuestion ? `Step ${stepNumber(index)}: ${pathQuestion}` : 'New path');
    if (step.current) button.setAttribute('aria-current', 'step');
    button.disabled = !canAttemptContinuation(); button.addEventListener('click', () => action({ type: 'replay', index })); $('path').append(button);
  });
  const paperCount = view.diagnostics.distinctPapers;
  $('evidence-count').textContent = `${paperCount} papers`;
  $('current-context').textContent = view.atlas.destination.metadataOnly ? 'Swampland collection' : `${labels[state.intent]} · ${labels[state.lens]} · ${view.atlas.membershipCount.toLocaleString()} listed descriptions`;
  $('corpus-scope').textContent = scope.description;
  $('export').disabled = !activeCapsule.snapshot.session;
  updateOptionsSummary(); renderColumns(); renderEvidence();
  const selector=state.selector,loaded=selector&&installedAtlases.get(atlasKey(selector));
  const sourceHistory=sourceInspectionHistory(session,item=>{const focus=acceptedCapsules.get(item.id)?.snapshot.view.atlas?.sourceInspection;return focus?{paperId:focus.source.paperId,endpointSide:focus.endpointSide}:null;});
  const renderPreparedPanel=()=>renderAtlasPanel({capsule:activeCapsule,navigator:loaded?.navigator,manifest:loaded?.atlas.manifest,readSources:loaded?.readSources,readRelationReviews:loaded?.readRelationReviews,sourceHistory,contextForSource:loaded?unitId=>sourceContextDisclosure(()=>loaded.readContext(unitId),{onInspect:payload=>action(payload),clarifications:loaded.readClarifications}):undefined,onNavigate:payload=>action(payload),onError:message=>status(message,true)});
  renderPreparedPanel();
  if(state.sourceInspection&&lastRenderedInspection!==state.id){const focusedStateId=state.id;requestAnimationFrame(()=>{if(currentState(session).id===focusedStateId)$('source-inspection-panel')?.scrollIntoView({block:'start'});});}
  lastRenderedInspection=state.sourceInspection?state.id:null;
  // Choices flow with the page, so a step chosen far down would otherwise open mid-list. Start the new step at its path and title.
  if(!state.sourceInspection&&lastRenderedStep&&lastRenderedStep!==state.id){const stepId=state.id;requestAnimationFrame(()=>{if(currentState(session).id===stepId&&$('current-question').getBoundingClientRect().top<0)document.querySelector('.path-section')?.scrollIntoView({block:'start'});});}
  lastRenderedStep=state.id;
  restoreNavigationFocus(savedFocus, sameStep);
  if(selector&&!loaded){const identity=state.id;ensureAtlas(selector).then(()=>{if(currentState(session).id===identity)render();}).catch(error=>status(`This exact snapshot remains readable; prepared continuation unavailable: ${error.message}`,true));}
  loadPaperAttribution();
  const paperQuestions = new Set((paperAccessRows(view) || []).map(paper => paper.id)), topicCount = view.directions.filter(direction => !paperQuestions.has(direction.id)).length;
  status(view.atlas.destination.metadataOnly ? `${view.directions.length} paths into the Swampland collection` : `${topicCount} next direction${topicCount === 1 ? '' : 's'}${paperQuestions.size ? ` · ${paperQuestions.size} paper question${paperQuestions.size === 1 ? '' : 's'}` : ''} · ${paperCount} papers in this view`);
  document.documentElement.dataset.ready = 'true';
  document.documentElement.dataset.stateId = state.id;
  document.documentElement.dataset.corpusId = state.corpusId;
  document.documentElement.dataset.destinationId = state.selector?.destinationId || '';
  document.documentElement.dataset.sourceObjectId = state.sourceInspection?.objectId || '';
  document.documentElement.dataset.sourceUnitId = state.sourceInspection?.unitId || '';
}
// A paper question (an outgoing source_question link) opens one paper's own extracted question. It is source access,
// not a narrower topic, so it is listed after the topic choices in its own group. Topic order, numbering and actions are
// unchanged. Paper links beyond the 15 default choices, before reachable only in All connections, follow one "Show more" button.
// The paper is identified from the linked destination's recorded representative unit, loaded lazily after the view renders
// (loadPaperAttribution); never from the question text or an ID suffix. Until then a row shows its question only.
// Its labels keep membership ("Listed description") separate from reviewed contribution roles.
const attributionKey = (computationId, destinationId) => `${computationId}\n${destinationId}`;
function withAttribution(papers, key) {
  const resolved = paperAttributions.get(key)?.resolved; if (!resolved) return papers;
  return papers.map(paper => { const found = paper.destinationId && resolved.get(paper.destinationId); return found ? {...paper, ...structuredClone(found)} : paper; });
}
function paperAccessRows(result) {
  const atlas = result?.atlas; if (!atlas?.connections) return null;
  const first = new Map(); for (const relation of atlas.connections) if (!first.has(relation.destinationId)) first.set(relation.destinationId, relation);
  return withAttribution([...first.values()].filter(relation => relation.navigationKind === 'source_question' && relation.traversal === 'outgoing')
    .map(relation => ({id: `connection:${relation.id}`, label: relation.choiceTitle || relation.title, selector: relation.selector, destinationId: relation.destinationId})), attributionKey(result.computationId, atlas.selector?.destinationId));
}
// Identification state of the current step's group, for its heading and progress line.
function paperProgress(stateId, key) {
  const task = paperAttributionTask;
  return {attempted: paperAttributions.get(key)?.attempted || new Set(), loading: Boolean(task?.loading && task.key === key && task.stateId === stateId), expanded: expandedPaperStep === stateId};
}
// Lazy and bounded: batches of at most PAPER_ATTRIBUTION_LIMIT links (4 at a time). The folded group asks only for the rows it
// shows (the default choices); rows behind "Show more" make no request until the reader asks for them, then follow in further
// batches. The current step is the last in the path, so it has no followed row: its shown rows are exactly the default
// choices. The topic choices are already rendered and never wait for this. Each row's result applies as soon as that row is
// identified, and only while the same step is current: a step change (render) or a newer task discards later results. Returning
// to the destination reuses what was identified (including rows identified before leaving) and the navigator's checked shard cache.
function loadPaperAttribution() {
  const state = currentState(session), selector = state.selector, loaded = selector && installedAtlases.get(atlasKey(selector));
  if (!loaded || !view?.atlas || view.atlas.destination.metadataOnly || view.stateId !== state.id) return;
  const parentId = view.atlas.selector.destinationId, key = attributionKey(view.computationId, parentId), stateId = state.id;
  // A task already running for this step re-reads the request (including a later "Show more") after each batch.
  if (paperAttributionTask?.key === key && paperAttributionTask.stateId === stateId) return;
  const nextBatch = () => nextPaperAttributionBatch(paperAccessRows(view) || [], {attempted: paperAttributions.get(key)?.attempted, shownIds: new Set(view.directions.map(direction => direction.id)), expanded: expandedPaperStep === stateId});
  if (!nextBatch().length) return;
  const task = {key, stateId, loading: false}; paperAttributionTask = task;
  const isCurrent = () => paperAttributionTask === task && currentState(session).id === stateId && view.stateId === stateId;
  const apply = () => {
    const papers = paperAccessRows(view), cached = columnViews.get(stateId); if (cached?.papers) cached.papers = papers;
    if (currentPaperGroup?.stateId === stateId) currentPaperGroup.update(papers, paperProgress(stateId, key));
  };
  // This step's record (identified rows and links tried), kept as the most recent of at most 24.
  const record = () => {
    const value = paperAttributions.get(key) || {resolved: new Map(), attempted: new Set()};
    paperAttributions.delete(key); paperAttributions.set(key, value); while (paperAttributions.size > 24) paperAttributions.delete(paperAttributions.keys().next().value);
    return value;
  };
  // Each row shows its paper as soon as its own link is identified; a revealed row never waits for the rest of its batch.
  // Reports arrive only while this task is current (resolvePaperAttribution checks isCurrent), and are checked again here.
  const onResolved = (id, row) => { if (!isCurrent()) return; const value = record(); value.attempted.add(id); if (row) value.resolved.set(id, row); apply(); };
  (async () => {
    for (let batch = nextBatch(); batch.length && isCurrent(); batch = nextBatch()) {
      task.loading = true; apply();
      const resolved = await resolvePaperAttribution(loaded.navigator, parentId, batch, {isCurrent, onResolved});
      if (!resolved || !isCurrent()) return;
      const value = record(); for (const id of batch) value.attempted.add(id); for (const [id, row] of resolved) value.resolved.set(id, row);
      task.loading = false; apply();
    }
  })().catch(error => { if (isCurrent()) { task.loading = false; apply(); status(`Paper identification is unavailable for this step: ${error.message}`, true); } })
    .finally(() => { if (paperAttributionTask === task) paperAttributionTask = null; });
}
// Saved rows from before this repair carry roles as bare strings.
const reviewedRoles = paper => (paper.roles || []).map(role => typeof role === 'string' ? {role, bases: [], qualifications: []} : role);
function paperFacts(paper, {current, followedRow, revisit}) {
  const roles = reviewedRoles(paper), facts = el('div', 'paper-source');
  const roleText = roles.map(({role, bases}) => `${contributionLabels[role] || role}${bases?.length ? ` (${bases.map(basis => contributionBasisLabels[basis] || basis.replaceAll('_', ' ')).join(', ')})` : ''}`).join('; ');
  const metaParts = [paper.listed && 'Listed description', paper.unitId && (roles.length ? `Reviewed role${roles.length === 1 ? '' : 's'}: ${roleText}` : 'No reviewed role recorded')].filter(Boolean);
  if (paper.paperId || metaParts.length) {
    // The identifier is kept whole when the line wraps (see .source-id).
    const meta = el('span', 'paper-meta'); if (paper.paperId) meta.append(el('span', 'source-id', `Paper ${paper.paperId}`));
    if (metaParts.length) meta.append(`${paper.paperId ? ' · ' : ''}${metaParts.join(' · ')}`); facts.append(meta);
  }
  // A reviewed role is never shown without the qualification recorded with it.
  const qualifications = [...new Set(roles.flatMap(role => role.qualifications || []))];
  if (qualifications.length) { const limits = el('details', 'paper-qualification'); limits.append(el('summary', '', qualifications.length === 1 ? 'Review qualification' : `Review qualifications · ${qualifications.length}`), ...qualifications.map(text => el('p', '', text))); facts.append(limits); }
  if (followedRow) facts.append(el('span', 'direction-state', 'Followed'));
  if (revisit >= 0) facts.append(el('span', 'direction-state', `Return to step ${stepNumber(revisit)}`));
  const url = current && safeUrl(paper.url || '');
  if (url) { const link = el('a', 'paper-read', 'Read paper ↗'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; if (paper.paperTitle) link.title = paper.paperTitle; link.setAttribute('aria-label', `Read paper ${paper.paperId}${paper.paperTitle ? `: ${paperTitle(paper.paperTitle)}` : ''} (opens in a new tab)`); facts.append(link); }
  return facts;
}
function paperAccessGroup(papers, {current, index, state, directions, authored, transition, progress, onExpand}) {
  // The question count is exact; a paper count is a total only once every row is identified (paperGroupTitle).
  const title = paperGroupTitle(papers);
  const isFollowed = paper => Boolean(transition?.directionId === paper.id && ['select','refine','pivot','navigate'].includes(transition.type)), followed = papers.some(isFollowed);
  // Earlier steps stay a short outline for travel: only a followed paper question stays in view; the others fold into a
  // closed disclosure, and primary-source links are kept to the current step.
  const node = el(current ? 'section' : 'div', 'paper-access'), list = el('ol', 'paper-list'), folded = el('ol', 'paper-list'), priorSession = session.schemaVersion ? {...session, cursor: index} : null, rowsById = new Map();
  let heading = null, foldedSummary = null, progressLine = null;
  // The visible count follows every identified row. While a batch is identifying, the polite live line is aria-busy, so
  // assistive technology is not sent one announcement per row; it reads the line again once the batch settles.
  const showProgress = (rows, value) => {
    if (!progressLine) return; const text = paperGroupProgress(rows, value); if (progressLine.textContent !== text) progressLine.textContent = text; progressLine.hidden = !text;
    if (value?.loading) progressLine.setAttribute('aria-busy', 'true'); else progressLine.removeAttribute('aria-busy');
  };
  if (current) {
    heading = el('h3', 'paper-access-heading', title); heading.id = `paper-access-${index}`; node.setAttribute('aria-labelledby', heading.id);
    // Exact identification progress while the paper count is partial; announced politely as batches finish.
    progressLine = el('p', 'paper-access-progress'); progressLine.setAttribute('aria-live', 'polite'); showProgress(papers, progress);
    node.append(heading, progressLine, el('p', 'paper-access-note', 'Each opens one paper’s own question. This is source access: it does not make that question narrower than, or equivalent to, this topic.'));
  }
  papers.forEach((paper, paperIndex) => {
    const item = el('li', 'paper-row'), open = el('button', 'paper-question', paper.label), direction = directions?.find(candidate => candidate.id === paper.id), followedRow = isFollowed(paper);
    open.type = 'button'; open.dataset.directionId = paper.id; open.setAttribute('aria-label', `Paper question ${paperIndex + 1} of ${papers.length}: ${paper.label}`);
    if (followedRow) open.setAttribute('aria-current', 'step');
    // Links within the default choices keep their original controller action; the others navigate like All connections.
    open.disabled = !canAttemptContinuation() || Boolean(direction && ((!current && !historicalAction(state.id, direction)) || (current && !activeCapsule.continuation.actions.some(item => item.id === direction.id && (builtIn(activeCapsule) || item.action.type !== 'select')))));
    open.addEventListener('click', () => current ? (direction ? followDirection(direction) : action({type: 'navigate', selector: paper.selector}, {viaDirectionId: paper.id})) : action({type: 'replay', index}, {followup: direction ? historicalAction(state.id, direction) : {type: 'navigate', selector: paper.selector}, viaDirectionId: paper.id}));
    const context = {current, followedRow, revisit: direction && (current || !authored) ? revisitFor(direction, priorSession) : -1}, facts = paperFacts(paper, context);
    item.append(open); if (facts.childNodes.length) item.append(facts); (current || followedRow ? list : folded).append(item); rowsById.set(paper.id, {item, context, unitId: paper.unitId || null});
    // The current step shows the same paper links as the 15 default choices; the rest are one button away here instead of only in All connections.
    // A re-render of the same step keeps them shown once the reader asked for them (progress.expanded).
    if (current && !direction && !followedRow && !progress?.expanded) item.hidden = true;
  });
  if (list.children.length) node.append(list);
  if (folded.children.length) { const rest = el('details', 'paper-access-folded'); foldedSummary = el('summary', '', followed ? `Other paper questions · ${folded.children.length}` : title); rest.append(foldedSummary, folded); node.append(rest); }
  // Late paper attribution arrives in batches. It replaces the source facts only of rows it newly identifies, so a focused
  // "Read paper" link or open review qualification in an earlier row survives, as do "Show more" and the question buttons.
  const update = (rows, value) => {
    for (const paper of rows) {
      const row = rowsById.get(paper.id); if (!row || !paper.unitId || row.unitId === paper.unitId) continue;
      const facts = paperFacts(paper, row.context); row.item.querySelector(':scope > .paper-source')?.remove(); if (facts.childNodes.length) row.item.append(facts); row.unitId = paper.unitId;
    }
    const text = paperGroupTitle(rows); if (heading && heading.textContent !== text) heading.textContent = text; if (foldedSummary && !followed) foldedSummary.textContent = text;
    showProgress(rows, value);
  };
  const more = [...list.children].filter(item => item.hidden);
  if (more.length) {
    const reveal = el('button', 'paper-more', `Show ${more.length} more paper question${more.length === 1 ? '' : 's'}`); reveal.type = 'button';
    reveal.setAttribute('aria-label', `Show ${more.length} more paper question${more.length === 1 ? '' : 's'} beyond the default choices`);
    // Showing every question is the request to identify the papers of the rest; until then they make none (bounded batches, see loadPaperAttribution).
    reveal.addEventListener('click', () => { for (const item of more) item.hidden = false; reveal.remove(); more[0].querySelector('.paper-question')?.focus(); onExpand?.(); });
    node.append(reveal);
  }
  return {node, followed, update};
}
function renderColumns() {
  const host = $('columns'); host.replaceChildren(); currentPaperGroup = null;
  host.classList.toggle('prepared-columns',Boolean(view.atlas));
  host.classList.toggle('empty-path', !currentState(session).query && !view.directions.length);
  $('directions-count').textContent = '';
  const steps = physicsPath(session,{activeOnly:true});
  for (let position = 0; position < steps.length; position++) {
    const {state,index,current}=steps[position],next=steps[position+1]&&session.states[steps[position+1].startIndex];
    if (!current && !stateQuestion(state).trim()) continue;
    const cached = columnViews.get(state.id);
    const directions = current ? view.directions : cached?.computationId === state.computationId && !(bridge && cached.authored) ? cached.directions : null;
    const papers = !directions ? [] : (current ? paperAccessRows(view) : cached?.papers && withAttribution(cached.papers, attributionKey(state.computationId, state.selector?.destinationId))) || [], paperIds = new Set(papers.map(paper => paper.id));
    const topics = directions?.filter(direction => !paperIds.has(direction.id)) || null;
    const column = el('section', 'miller-column'); column.dataset.stateId = state.id; column.dataset.historyIndex = index; column.dataset.current = String(current);
    const visit = builtIn(activeCapsule) && !cached?.authored ? previousVisitIndex(session,index) : -1,legacyReturn=visit<steps[position].startIndex?visit:-1;
    const heading = el('div', `column-heading${current ? ' current-column-heading' : ''}`); heading.append(el('span', 'column-step', `Step ${stepNumber(index)} · ${current ? 'Next choices' : 'Choices then'}`));
    if (current) heading.tabIndex = -1;
    if (!current) heading.append(el('h3', '', displayExcerpt(stateQuestion(state) || 'Your first question',72)));
    if(legacyReturn>=0)heading.append(el('span','direction-state',`Return to step ${stepNumber(legacyReturn)}`));
    heading.title = state.query; column.append(heading);
    const list = el('div', 'directions'); if (current) list.id = 'directions';
    if (topics?.length || papers.length) {
      let selected = false;
      // Prepared choices are listed in recorded-relation order; each run of one family (narrower, typed sideways, broader,
      // organizational, listing) gets a labelled group so the kinds read apart. The collection entrance is one family and stays
      // a plain list. Rows keep their order, numbers, IDs and actions; only the container and labels change.
      const families = topics.some(direction => direction.selector) && !topics.every(direction => direction.navigationKind === 'collection_access') ? topics.map(choiceFamily) : null;
      let group = null, groupCount = 0;
      topics.forEach((direction, directionIndex) => {
        if (families && families[directionIndex] !== families[directionIndex - 1]) {
          const family = families[directionIndex], members = [];
          for (let next = directionIndex; next < topics.length && families[next] === family; next++) members.push(topics[next]);
          group = el('div', 'choice-group'); group.dataset.choiceFamily = family; group.setAttribute('role', 'group');
          const groupHeading = el('h3', 'choice-group-heading', choiceGroupHeading(family, members)); groupHeading.id = `choice-group-${index}-${groupCount++}`;
          group.setAttribute('aria-labelledby', groupHeading.id);
          const note = current && choiceGroupNote(family, members);
          if (note) {
            // The full note always stays in the page. Wider screens show it under the heading and hide the toggle; narrow screens
            // fold it behind the toggle on the heading line (styles.css), keeping the label, count and each row's relation in view.
            // `group` is reassigned for each later run, so the toggle keeps its own group (noteGroup).
            const noteGroup = group, header = el('div', 'choice-group-header'), toggle = el('button', 'choice-group-note-toggle', 'Reading note'), text = el('p', 'choice-group-note', note), open = openGroupNotes.has(note);
            text.id = `${groupHeading.id}-note`; toggle.type = 'button';
            toggle.setAttribute('aria-controls', text.id); toggle.setAttribute('aria-describedby', groupHeading.id); toggle.setAttribute('aria-expanded', String(open)); noteGroup.classList.toggle('note-open', open);
            toggle.addEventListener('click', () => { const show = !noteGroup.classList.contains('note-open'); noteGroup.classList.toggle('note-open', show); toggle.setAttribute('aria-expanded', String(show)); if (show) openGroupNotes.add(note); else openGroupNotes.delete(note); });
            header.append(groupHeading, toggle); noteGroup.append(header, text);
          } else group.append(groupHeading);
          list.append(group);
        }
        const row = el('div', 'direction-row'), button = el('button', 'direction'); button.type = 'button'; button.dataset.directionId = direction.id;
        const fullLabel = direction.label, label = direction.selector?fullLabel:displayExcerpt(fullLabel,72);
        button.title = direction.query || fullLabel; button.setAttribute('aria-label', `Direction ${directionIndex + 1}: ${direction.query || fullLabel}`);
        const transition = next && cached?.transitions?.[next.id];
        const followed = Boolean(transition?.directionId === direction.id && ['select','refine','pivot','navigate'].includes(transition.type));
        if (followed) { button.setAttribute('aria-current','step');selected=true; }
        const priorSession = session.schemaVersion ? {...session,cursor:index} : null;
        const revisit = (current || !cached?.authored) ? revisitFor(direction,priorSession) : -1;
        const info = direction.selector ? {kind:choiceKindLabel(direction),sourceTitle:direction.summary===direction.label?'':direction.summary || ''} : current ? representativeInfo(direction,view.nodes,!builtIn(activeCapsule)) : {kind:direction.kind || 'Source direction',sourceTitle:direction.sourceTitle || ''};
        const route = direction.selector ? choiceRoute(direction) : null;
        button.append(el('span', 'direction-number', String(directionIndex + 1).padStart(2, '0')));
        const content = el('span', 'direction-content'), title = el('h3', '', label); content.append(title);
        if(info.sourceTitle && !fullLabel.includes(info.sourceTitle))content.append(el('span','direction-source direction-source-title',displayExcerpt(info.sourceTitle,72)));
        // A typed related-question choice with zero listed descriptions states no count (choiceCountText); other counts are unchanged.
        const meta=el('span','direction-meta');if(!direction.metadataOnly){const count=choiceCountText(direction);meta.append(el('span','direction-kind',info.kind));if(count)meta.append(document.createTextNode(count));}
        // Scope-wide shared-source witnesses of an organizational route, and the other relation kinds recorded to the same destination.
        if(route?.witnesses)meta.append(el('span','direction-witnesses',` · ${route.witnesses} shared source question${route.witnesses===1?'':'s'}`));
        if(direction.routeCount>1)meta.append(el('span','direction-route-count',` · ${direction.routeCount} recorded routes${route?.others?.length?`, also ${route.others.join(', ')}`:''}`));
        else if(route?.others?.length)meta.append(el('span','direction-route-count',` · also ${route.others.join(', ')}`));
        if(followed)meta.append(el('span','direction-state','Followed'));
        if(revisit>=0)meta.append(el('span','direction-state',`Return to step ${stepNumber(revisit)}`));
        if(meta.childNodes.length)content.append(meta);
        button.append(content, el('span', 'direction-arrow', '›'));
        button.disabled = !canAttemptContinuation() || (!current && !historicalAction(state.id,direction)) || (current && !activeCapsule.continuation.actions.some(item => item.id === direction.id && (builtIn(activeCapsule) || item.action.type !== 'select')));
        button.addEventListener('click', () => current ? followDirection(direction) : action({ type: 'replay', index }, { followup: historicalAction(state.id,direction), viaDirectionId:direction.id }));
        row.append(button);
        // A premise check's recorded scope (SW-006): a disclosure beside the navigation button, never inside it. Opening it shows
        // the route's recorded qualification in a panel under the row and does not follow the route; All connections keeps the
        // same text. Only the current step has one; it stays open for this step across re-renders and Back (openChoiceScopes).
        const scopes = current && direction.selector ? choiceScope(direction) : [];
        let scopePanel = null;
        if (scopes.length) {
          const key = `${state.id}\n${direction.id}`, open = openChoiceScopes.has(key), scopeToggle = el('button', 'direction-scope-toggle', 'Scope'), panel = el('div', 'direction-scope');
          title.id = `direction-title-${index}-${directionIndex}`; panel.id = `direction-scope-${index}-${directionIndex}`; panel.hidden = !open;
          panel.append(el('p', 'direction-scope-label', scopes.length === 1 ? 'Recorded scope of this premise check' : `Recorded scopes · ${scopes.length} premise-check routes to this choice`), ...scopes.map(text => el('p', 'direction-scope-text', text)), el('p', 'direction-scope-note', 'The same text is listed under All connections with the relation’s rationale and review record.'));
          scopeToggle.type = 'button'; scopeToggle.setAttribute('aria-expanded', String(open)); scopeToggle.setAttribute('aria-controls', panel.id); scopeToggle.setAttribute('aria-describedby', title.id);
          // Shows or hides the panel only: no navigation, render or history entry.
          scopeToggle.addEventListener('click', () => { const show = panel.hidden; panel.hidden = !show; scopeToggle.setAttribute('aria-expanded', String(show)); if (show) openChoiceScopes.add(key); else openChoiceScopes.delete(key); });
          row.append(scopeToggle); scopePanel = panel;
        }
        if (current && !direction.metadataOnly && direction.evidenceIds.length) {
          const inspect = el('button', 'direction-evidence', 'Sources'); inspect.type = 'button'; inspect.setAttribute('aria-label', `Inspect sources for direction ${directionIndex + 1}`); inspect.title = 'Inspect sources'; inspect.setAttribute('aria-pressed', String(selectedDirectionId === direction.id));
          inspect.addEventListener('click', () => {
            selectedDirectionId = direction.id; selectedId = null; allEvidence = false; document.querySelector('.reading-pane').hidden = false; renderEvidence();
            host.querySelectorAll('.direction-evidence').forEach(item => item.setAttribute('aria-pressed', String(item === inspect)));
            const heading = $('reading-heading'); heading.focus({ preventScroll: true });
            heading.closest('.reading-pane').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
          }); row.append(inspect);
        }
        (group || list).append(row); if (scopePanel) (group || list).append(scopePanel);
      });
      if (!topics.length) list.append(el('p', 'empty-state', 'No further topic is recorded here. Each paper question below opens one paper.'));
      if (papers.length) {
        const key = attributionKey(state.computationId, state.selector?.destinationId), stateId = state.id;
        const onExpand = () => { expandedPaperStep = stateId; currentPaperGroup?.update(paperAccessRows(view), paperProgress(stateId, key)); loadPaperAttribution(); };
        const group = paperAccessGroup(papers, {current, index, state, directions, authored: Boolean(cached?.authored), transition: next && cached?.transitions?.[next.id], ...(current ? {progress: paperProgress(stateId, key), onExpand} : {})});
        selected ||= group.followed; list.append(group.node); if (current) currentPaperGroup = {stateId, update: group.update};
      }
      if(!current && cached?.authored && !acceptedCapsules.has(state.id))list.append(el('p','column-restore','These authored choices are a saved reference. Reopen the full view file to restore their exact context and continue.'));
      if (next && !selected) { const follow = el('div', 'column-followup'); follow.append(el('strong', '', cached?.transitions?.[next.id]?.type === 'refine' ? 'Refined question →' : 'Follow-up →'), el('span', '', displayExcerpt(acceptedCapsules.get(next.id)?.context.question || next.query,72))); list.append(follow); }
    } else if (!current && !directions) {
      const restore = el('div', 'column-restore'); restore.append(el('p', '', 'This step is in your path. Restore it to recompute its directions.'));
      const button = el('button', '', 'Restore step →'); button.type = 'button'; button.addEventListener('click', () => action({ type: 'replay', index })); restore.append(button); list.append(restore);
    } else list.append(el('p', 'empty-state', 'This question has no further recorded direction. Read its scope and sources, or search for another question.'));
    column.append(list); host.append(column);
  }
  $('navigator-note').hidden = Boolean(view.atlas) || host.children.length < 2 || !canAttemptContinuation();
  columnAlignment = alignColumn(session.cursor,{followed:true,allFollowed:true});
  columnAlignment.then(alignBreadcrumb);
}
function alignBreadcrumb() {const nav=$('path'),crumb=nav.querySelector('[aria-current]');if(crumb&&nav.clientWidth){const rect=crumb.getBoundingClientRect(),navRect=nav.getBoundingClientRect();nav.scrollLeft+=rect.left-navRect.left-nav.clientLeft;}}
function revealFollowed(column) {
  const selected=column.querySelector('.direction[aria-current="step"], .paper-question[aria-current="step"]')?.closest('.direction-row, .paper-row');
  if(!selected)return;
  const header=column.querySelector('.column-heading'),box=column.getBoundingClientRect(),row=selected.getBoundingClientRect();
  const inset=(header?.getBoundingClientRect().height||0)+10;
  column.scrollTop=Math.max(0,column.scrollTop+row.top-box.top-inset);
}
function alignColumn(index,{followed=false,allFollowed=false}={}) {
  const ticket=++columnAlignmentTicket;visibleHistoryIndex=index;userColumnScroll=false;
  return new Promise(resolve=>{
    let frames=0;
    const settle=()=>{
      if(ticket!==columnAlignmentTicket){resolve(false);return;}
      const host=$('columns'),column=[...host.children].find(item=>Number(item.dataset.historyIndex)===index);
      if(!column||!host.clientWidth){updateColumnControls();resolve(false);return;}
      const hostRect=host.getBoundingClientRect(),box=column.getBoundingClientRect(),left=hostRect.left+host.clientLeft;
      const delta=column.dataset.current==='true'?box.right-left-host.clientWidth:box.left-left;
      host.scrollLeft=Math.max(0,Math.min(host.scrollWidth-host.clientWidth,host.scrollLeft+delta));
      if(allFollowed)for(const item of host.children)revealFollowed(item);
      else if(followed)revealFollowed(column);
      lastColumnWidth=host.clientWidth;host.dataset.visibleHistoryIndex=String(index);updateColumnControls();
      if(++frames<3)requestAnimationFrame(settle);else resolve(true);
    };
    requestAnimationFrame(settle);
  });
}
function rememberVisibleColumn() {
  const host=$('columns');if(!userColumnScroll||host.clientWidth!==lastColumnWidth)return;
  const frame=host.getBoundingClientRect(),left=frame.left+host.clientLeft,right=left+host.clientWidth;
  let best=null;
  for(const column of host.children){const box=column.getBoundingClientRect(),visible=Math.max(0,Math.min(right,box.right)-Math.max(left,box.left));const score=visible/Math.max(1,box.width);if(!best||score>best.score+.001||(Math.abs(score-best.score)<.001&&Math.abs(box.left-left)<best.distance))best={index:Number(column.dataset.historyIndex),score,distance:Math.abs(box.left-left)};}
  if(best){visibleHistoryIndex=best.index;host.dataset.visibleHistoryIndex=String(best.index);}
}
function updateColumnControls() { const host = $('columns'); $('browse-prev').disabled = host.scrollLeft < 2; $('browse-next').disabled = host.scrollLeft + host.clientWidth >= host.scrollWidth - 2; }
function renderEvidence() {
  $('evidence').replaceChildren();
  let nodes = [...view.nodes];
  const direction = view.directions.find(item => item.id === selectedDirectionId);
  if (direction) { const ids = new Set(direction.memberIds || direction.evidenceIds); nodes = nodes.filter(node => ids.has(node.id)); }
  $('clear-evidence').hidden = !direction;
  const primaryCount=view.atlas?.matchingSourceCount,contextCount=view.atlas?.matchingContextCount||0,paperCount=new Set(nodes.map(n=>n.paperId).filter(Boolean)).size;
  // Some questions record their sources only as reviewed contributions and list no member descriptions. Say so and
  // point to those roles, so "0 primary descriptions" is not read as a gap in the source record.
  const contributions=view.atlas?.destination.sourceContributions||[],membershipEmpty=Boolean(view.atlas&&contributions.length&&!view.atlas.membershipCount&&!view.atlas.contextMembershipCount),reviewedRoles=new Map();
  if(membershipEmpty)for(const row of contributions){if(!reviewedRoles.has(row.unitId))reviewedRoles.set(row.unitId,new Set());reviewedRoles.get(row.unitId).add(row.role);}
  const roleCount=[...reviewedRoles.values()].reduce((sum,roles)=>sum+roles.size,0),rolePapers=new Set(contributions.map(row=>row.paperId).filter(Boolean)).size,shownWithRole=nodes.filter(node=>reviewedRoles.has(node.id)).length,plural=(count,word)=>`${count} ${word}${count===1?'':'s'}`;
  $('evidence-description').textContent = direction ? `Sources behind: ${direction.label}` : membershipEmpty ? `No listed descriptions are recorded for this question. Its ${plural(roleCount,'reviewed source role')} across ${plural(rolePapers,'paper')} ${roleCount===1?'is':'are'} under Source contributions, separate from membership. This view shows ${plural(nodes.length,'description')} across ${plural(paperCount,'paper')}; ${shownWithRole} ${shownWithRole===1?'has':'have'} a reviewed role.` : view.atlas ? `${primaryCount} primary description${primaryCount===1?'':'s'}${contextCount?` and ${contextCount} contextual method description${contextCount===1?'':'s'}`:''} ${primaryCount+contextCount===1?'matches':'match'} this selection. This view shows ${nodes.length} description${nodes.length===1?'':'s'} across ${paperCount} paper${paperCount===1?'':'s'}; supporting context is labeled separately.` : 'Read the extracted descriptions, then check the original papers.';
  if (selectedId) nodes.sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId));
  const papers = view.atlas ? [...Map.groupBy(nodes,node=>node.paperId || node.id).values()] : nodes.map(node=>[node]);
  const shown = allEvidence ? papers : papers.slice(0, 7);
  function sourceCard(node, {repeatTitle=false}={}) {
    const evidence = node.evidence || {}, card = el('article', `evidence-card${node.id === selectedId ? ' selected' : ''}`);
    card.dataset.sourceId = node.id;
    const relation = node.retrieval?.workRelation?.kind;
    card.append(el('p', 'source-meta', `${evidence.date || evidence.year || node.year || 'date unavailable'} · ${labels[evidence.lens || node.lens] || 'Source'}${relation ? ` · ${relation === 'ambiguous' ? 'role uncertain' : relation}` : ''}${node.atlasContextScope==='same_paper_context'?' · Same-paper context; check applicability':node.atlasRole ? ` · ${node.atlasRole==='context-evidence'?(reviewedRoles.has(node.id)?`Reviewed role: ${[...reviewedRoles.get(node.id)].map(role=>contributionLabels[role]||role).join('; ')} · not a listed description`:'Related source; outside this view’s primary selection'):'Matches current source selection'}` : ''}`));
    const title = el('h3'), paperUrl = safeUrl(node.sourceUrl || evidence.url);
    if (paperUrl) { const link = el('a', '', paperTitle(node.title)); link.title=node.title; link.href = paperUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; title.append(link); } else title.textContent = paperTitle(node.title); if(!repeatTitle)card.append(title);
    card.append(el('p', 'passage', evidence.text || node.label));
    const details = el('details'); details.append(el('summary', '', 'Source scope & provenance'));
    details.append(el('p', '', 'Extracted source description, not a direct quotation or independently verified result.'));
    if(node.atlasMembershipChecked===false)details.append(el('p','','This description is shown as context. The complete membership list has not been loaded for this selection; this is a display-coverage limit, not a claim about how much of the paper has been read.'));
    if (node.retrieval?.workRelation?.basis) details.append(el('p', '', `Role assessment: ${node.retrieval.workRelation.basis}.`));
    if (evidence.sourceNotice) details.append(el('p', '', evidence.sourceNotice));
    appendSourceCoverage(card,node,{provenance:details,navigator:view.atlas?installedAtlases.get(atlasKey(view.atlas.selector))?.navigator:undefined,selector:view.atlas?.selector,onNavigate:action});
    details.append(el('p', '', `Source ID: ${node.id}`));
    if (evidence.sourceRecordIds?.length) details.append(el('p', '', `Source records: ${evidence.sourceRecordIds.join(', ')}`));
    card.append(details);
    if(view.atlas&&node.kind!=='vocabulary'){const selector=structuredClone(currentState(session).selector);card.append(sourceContextDisclosure(async()=>{const prepared=await ensureAtlas(selector);return prepared.readContext(node.id);},{onInspect:payload=>action(payload),clarifications:async()=>(await ensureAtlas(selector)).readClarifications()}));}
    const actions = el('div', 'source-actions'), url = safeUrl(node.sourceUrl || evidence.url);
    if (url) { const link = el('a', '', node.kind==='vocabulary'?'Read vocabulary source ↗':'Read paper ↗'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; actions.append(link); }
    card.append(actions); return card;
  }
  if(membershipEmpty&&!direction){
    const pointer=el('div','source-actions'),open=el('button','',`Open Source contributions (${roleCount})`);open.type='button';
    open.addEventListener('click',()=>{const box=document.querySelector('#atlas-panel details.source-contributions'),summary=box?.querySelector(':scope > summary');if(!summary)return;box.open=true;summary.focus({preventScroll:true});summary.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
    pointer.append(open);$('evidence').append(pointer);
  }
  for(const group of shown){
    group.sort((a,b)=>Number(b.id===selectedId)-Number(a.id===selectedId)||Number(a.atlasRole==='context-evidence')-Number(b.atlasRole==='context-evidence')||Number(Boolean(b.atlasContextMatchesFilters))-Number(Boolean(a.atlasContextMatchesFilters))||Number(a.lens==='methods')-Number(b.lens==='methods'));
    const paper=el('section','source-paper');paper.dataset.paperId=group[0].paperId||group[0].id;paper.append(sourceCard(group[0]));
    if(group.length>1){const extra=el('details','source-facets');extra.append(el('summary','',`${group.length-1} more extracted descriptions from this paper`));let populated=false;extra.addEventListener('toggle',()=>{if(!extra.open||populated)return;populated=true;for(const node of group.slice(1))extra.append(sourceCard(node,{repeatTitle:true}));});paper.append(extra);}
    $('evidence').append(paper);
  }
  if (!allEvidence && papers.length > shown.length) { const more = el('button', '', view.atlas?`Show all ${papers.length} papers in this view`:`Show all ${nodes.length} source descriptions`); more.type = 'button'; more.addEventListener('click', () => { allEvidence = true; renderEvidence(); }); $('evidence').append(more); }
}
function download(name, payload) { const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const a = el('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function bridgeFetch(route, options = {}, connection = bridge) {
  const response = await fetch(new URL(route, connection.origin), { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}`, ...options.headers }, signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(response.status === 409 ? 'Your agent changed the path while this request was pending. The newer path is shown; your draft is preserved. Review it and search again.' : `Companion returned HTTP ${response.status}. Check the origin and session token.`);
    if (response.status === 409) error.current = result.current;
    throw error;
  }
  return result;
}
async function connect(origin, token) {
  const url = new URL(origin);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) throw new Error('The companion must use a loopback origin on your computer.');
  if (!token) throw new Error('A session token is required. Use the companion launch link.');
  const source = ++sourceEpoch, connectionIntent = ++userIntent; events?.close(); queuedBridgeSnapshot = null; bridgeNeedsRebase = false;
  actionQueue = Promise.resolve(); loadingTask = Promise.resolve();
  bridge = { origin: url.origin, token }; revision = -1;
  const connection = bridge;
  try {
    loadingTask = bridgeFetch('/api/session', {}, connection);
    const [snapshot] = await Promise.all([loadingTask, preparedIndex()]);
    if (source !== sourceEpoch) return;
    accept(snapshot); if (connectionIntent === userIntent) setBusy(false);
    const eventUrl = new URL('/api/events', bridge.origin); eventUrl.searchParams.set('token', token);
    events = new EventSource(eventUrl);
    events.onmessage = ({ data }) => {
      if (source !== sourceEpoch) return;
      try { const snapshot = JSON.parse(data); if (busy) { if (!queuedBridgeSnapshot || snapshot.revision > queuedBridgeSnapshot.revision) queuedBridgeSnapshot = snapshot; } else accept(snapshot); $('connection-status').textContent = 'Agent connected · live updates'; } catch (error) { status(error.message, true); }
    };
    events.onopen = () => { if (source === sourceEpoch) $('connection-status').textContent = 'Agent connected · live updates'; };
    events.onerror = () => { if (source === sourceEpoch) { $('connection-status').textContent = 'Companion reconnecting…'; status('The companion connection interrupted. Updates resume when it reconnects.', true); } };
    $('connection-status').textContent = 'Agent connected · live updates'; $('bridge-message').textContent = 'Connected. Agent actions update this view automatically.';
    let savedToken = false;
    try { sessionStorage.setItem(bridgeStorageKey, JSON.stringify(bridge)); savedToken = true; } catch {}
    if (fragment.has('token') && savedToken) history.replaceState(null, '', location.pathname + location.search);
  } catch (error) { if (source === sourceEpoch) { bridge = null; events?.close(); $('connection-status').textContent='Browser session · companion disconnected'; setBusy(false); } throw error; }
}
async function restoreSession(payload) {
  const ticket = userIntent;
  const session = importSession(payload);
  const state = currentState(session);
  const prepared = await ensureAtlas(state.selector);
  importSession(payload,{corpusId:prepared.atlas.manifest.corpusId,computationId:prepared.navigator.computationId});
  await prepared.navigator.prepareState(state);
  if (ticket !== userIntent) return {superseded:true};
  return accept({session,view:prepared.navigator.computeView(state)});
}
function updateOptionsSummary() {
  const defaults = { intent: 'explore', lens: 'combined', 'work-relation': 'either' };
  const changed = Object.entries(defaults).filter(([id, value]) => $(id).value !== value).length;
  const approach = $('intent').selectedOptions[0]?.textContent || 'Explore connections';
  $('options-summary').textContent = changed ? `${approach} · customized` : approach;
}
$('options-toggle').addEventListener('click', () => { const open = $('options-toggle').getAttribute('aria-expanded') !== 'true'; $('options-toggle').setAttribute('aria-expanded', String(open)); $('options-toggle').closest('.search-workbench').classList.toggle('options-open', open); });
const markDraft = () => { draftDirty = true; draftVersion++; updateOptionsSummary(); };
$('question').addEventListener('input', markDraft);
for (const id of ['intent', 'lens', 'work-relation']) $(id).addEventListener('change', markDraft);
$('question-form').addEventListener('submit', event => {
  event.preventDefault(); const query = $('question').value.trim();
  if (!query) { status('Enter a physics question or concept.', true); $('question').focus(); return; }
  if (session) lookupPrepared(query);
});
// Choosing a result clears the result list, which removes the chosen button and drops keyboard focus to <body>, so the
// next Tab restarted at Back. Continue from the new step's heading, as after any other step change (Tab reaches the
// choices). It is focused after the render's own scroll-to-path frame and scrolls only if it is out of view. If the
// navigation failed, return to the search field; if another action superseded it, leave focus alone.
function focusAfterSearch(outcome) {
  if (!outcome || outcome.superseded) return;
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    (outcome.error ? $('question') : $('columns').querySelector('.miller-column[data-current="true"] > .current-column-heading'))?.focus();
  });
}
async function lookupPrepared(query) {
  const ticket=++lookupGeneration;
  try {const selector=currentState(session).selector,loaded=await ensureAtlas(selector);await loaded.navigator.prepareSearch?.();if(ticket!==lookupGeneration)return;const results=loaded.navigator.search(query,{limit:15});let host=$('atlas-lookup');if(!host){host=el('section','atlas-lookup');host.id='atlas-lookup';$('question-form').after(host);}host.replaceChildren(el('p','','Title and alias lookup. A connected agent can interpret a longer question and check its scope.'));for(const result of results){const button=el('button','',result.title);button.type='button';button.addEventListener('click',()=>{host.replaceChildren();action({type:'navigate',selector:result.selector,intent:$('intent').value,lens:$('lens').value,workRelation:$('work-relation').value},{clearForm:true}).then(focusAfterSearch);});host.append(button);if(result.summary!==result.title)host.append(el('p','',result.summary));}if(!results.length)host.append(el('p','','No title or alias match. Try another term or follow a connection from a nearby topic.'));status(`${results.length} title/alias matches; the current destination is unchanged.`);}catch(error){status(error.message,true);}
}
$('intent').addEventListener('change', () => { if ($('intent').value === 'using') $('work-relation').value = 'using'; updateOptionsSummary(); });
$('clear-evidence').addEventListener('click', () => { selectedDirectionId = null; selectedId = null; allEvidence = false; renderEvidence(); $('columns').querySelectorAll('.direction-evidence').forEach(button => button.setAttribute('aria-pressed', 'false')); });
$('columns').addEventListener('scroll',()=>{rememberVisibleColumn();updateColumnControls();},{passive:true});
for(const type of ['pointerdown','touchstart','wheel','keydown'])$('columns').addEventListener(type,()=>{userColumnScroll=true;++columnAlignmentTicket;},{passive:true});
for (const [id, sign] of [['browse-prev', -1], ['browse-next', 1]]) $(id).addEventListener('click', () => {
  const columns=[...$('columns').children],current=Math.max(0,columns.findIndex(column=>Number(column.dataset.historyIndex)===visibleHistoryIndex));
  const target=columns[Math.max(0,Math.min(columns.length-1,current+sign))];
  if(target)columnAlignment=alignColumn(Number(target.dataset.historyIndex),{followed:true});
});
let columnResizeFrame;
window.addEventListener('resize', () => { cancelAnimationFrame(columnResizeFrame); columnResizeFrame = requestAnimationFrame(() => { if(session){columnAlignment=alignColumn(visibleHistoryIndex ?? session.cursor,{followed:true});columnAlignment.then(alignBreadcrumb);}else updateColumnControls(); }); });
$('back').addEventListener('click', () => { if (session) action({ type: 'replay', index: Math.max(0, session.cursor - 1) }); });
$('reset').addEventListener('click', async () => {
  retainBranch(activeCapsule);
  $('question').value = ''; $('intent').value = 'explore'; $('lens').value = 'combined'; $('work-relation').value = 'either';
  markDraft(); $('question').focus(); selectedDirectionId = null;
  if (session) await action({type:'reset'},{clearForm:true});
  else { draftDirty=false; history.replaceState(null,'',location.pathname); await loadRoute({initial:true}); }
});
$('export').addEventListener('click', () => { if (activeCapsule?.snapshot.session) download('swampwiki-session.json', exportSession(activeCapsule.snapshot.session)); });
$('export-view').addEventListener('click', () => { if (activeCapsule) download('swampwiki-view.json', activeCapsule); });
// The status line sits above the path, thousands of pixels from these controls on a long page, so report the result
// beside the button as well and show the exact link. If the browser refuses the clipboard, select that link for copying.
function showShareResult(message, url) {
  sharedStateId = currentState(session)?.id ?? null;
  $('share-message').textContent = message; $('share-url').value = url || ''; $('share-url').hidden = !url; $('share-result').hidden = false;
}
$('share-url').addEventListener('focus', event => event.target.select());
$('share').addEventListener('click', async () => {
  try {
    const url = atlasAddress(currentState(session),location.origin), opens = `It opens “${short($('current-question').textContent,120)}” with this view’s search options. Your path and work note stay in this browser.`;
    try { await navigator.clipboard.writeText(url); status('Destination link copied. Your work note stays in this browser.'); showShareResult(`Destination link copied. ${opens}`, url); }
    catch { history.replaceState(history.state,'',url); status('Copy the destination link from the address bar.'); showShareResult(`This browser did not allow copying. The link below is selected; copy it with your keyboard or the context menu. ${opens}`, url); $('share-url').focus(); $('share-url').select(); }
  } catch (error) { status(error.message,true); showShareResult(error.message); }
});
async function importFile(file) {
  if (!file) return;
  const ticket = ++userIntent; ++routeGeneration; routeAbort?.abort();
  setBusy(true, 'Opening view file…');
  try {
    if (file.size > MAX_JSON_BYTES) throw new Error('View file exceeds the 2 MiB decoded limit.');
    const [buffer] = await Promise.all([file.arrayBuffer(), preparedIndex()]), bytes = new Uint8Array(buffer);
    if (ticket !== userIntent) return {superseded:true};
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) { const capsule = await decodeCapsuleBytes(bytes); if(ticket!==userIntent)return {superseded:true}; return acceptCapsule(capsule); }
    const payload = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
    if (payload.kind === CAPSULE_KIND) return acceptCapsule(payload);
    if (payload.view && payload.session) return acceptCapsule(createCapsule(payload));
    if (payload.kind === 'eigenquestions-session') { if (bridge) throw new Error('Disconnect before restoring a separate session.'); return restoreSession(payload); }
    throw new Error('This file is not a supported contextual view or navigation session.');
  } catch(error) { if(ticket===userIntent)throw error; return {superseded:true}; }
  finally { if(ticket===userIntent){setBusy(false);if(queuedBridgeSnapshot){const latest=queuedBridgeSnapshot;queuedBridgeSnapshot=null;accept(latest);}} }
}
$('import-open').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => { try { await importFile(event.target.files[0]); } catch (error) { status(error.message, true); } finally { event.target.value = ''; } });
window.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
window.addEventListener('drop', async event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); try { await importFile(event.dataTransfer.files[0]); } catch (error) { status(error.message, true); } });
$('agent-open').addEventListener('click', () => $('agent-dialog').showModal()); $('agent-close').addEventListener('click', () => $('agent-dialog').close());
$('bridge-form').addEventListener('submit', async event => { event.preventDefault(); try { await connect($('bridge-origin').value, $('bridge-token').value); } catch (error) { $('bridge-message').textContent = `${error.message} If your browser blocks access to apps on this device, allow the site permission for SwampWiki or open the companion’s local link.`; } });
$('bridge-disconnect').addEventListener('click', async () => { ++userIntent; events?.close(); bridge = null; revision = -1; try { sessionStorage.removeItem(bridgeStorageKey); } catch {} history.replaceState(null, '', location.pathname + location.search); $('connection-status').textContent = 'Browser session'; $('bridge-message').textContent = 'Disconnected. Continuing this session in the browser.'; try { if (session) await restoreSession(exportSession(session)); } catch (error) { status(error.message, true); } });

function refreshResume(home = $('exploration-workspace').hidden) {
  resumeCandidate = null; resumeCompanion = null; let invalid = false;
  try {
    const stored=localStorage.getItem(capsuleStorageKey),legacy=localStorage.getItem(storageKey);
    if(stored){const capsule=validateCapsule(JSON.parse(stored));if((capsule.context.question.trim()||capsule.snapshot.view.nodes.length)&&capsule.snapshot.view.stateId!==view?.stateId)resumeCandidate={kind:'capsule',payload:capsule,label:capsule.context.question};}
    else if(legacy){const payload=JSON.parse(legacy),previous=importSession(payload);if(currentState(previous).query.trim())resumeCandidate={kind:'session',payload,label:currentState(previous).query};}
  } catch { invalid = true; }
  try {const saved=JSON.parse(sessionStorage.getItem(bridgeStorageKey)||'null');if(saved&&typeof saved.origin==='string'&&typeof saved.token==='string'&&saved.token)resumeCompanion=saved;}catch{invalid=true;}
  $('resume-prior').hidden = !home || (!resumeCandidate && !resumeCompanion && !invalid);
  let recovery=document.getElementById('resume-disclosure');
  if(atAtlasEntrance()){
    if(!recovery){recovery=el('details','resume-disclosure');recovery.id='resume-disclosure';recovery.hidden=true;recovery.append(el('summary','','Resume a previous exploration'));}
    if(recovery.hidden)recovery.open=false;
    $('columns').after(recovery);recovery.append($('resume-prior'));recovery.hidden=$('resume-prior').hidden;
  }else{
    $('exploration-workspace').before($('resume-prior'));if(recovery)recovery.hidden=true;
  }

  $('resume-view').hidden = !resumeCandidate; $('resume-companion').hidden = !resumeCompanion;
  $('resume-label').textContent = invalid ? 'A saved exploration could not be read. It has been kept; open a valid file or begin a new question.' : resumeCandidate ? `Saved exploration: ${displayExcerpt(resumeCandidate.label,90)}` : 'A previous local agent connection is available. Reconnect explicitly to inspect its current state.';
  let branches=$('saved-branches');if(!branches){branches=el('details','saved-branches');branches.id='saved-branches';document.querySelector('.session-tools').append(branches);}branches.replaceChildren(el('summary','','Earlier paths on this browser'));
  try{for(const capsule of JSON.parse(localStorage.getItem('eigenquestions:branches:v1')||'[]')){const button=el('button','',displayExcerpt(capsule.context.question,90));button.type='button';button.addEventListener('click',()=>{try{retainBranch(activeCapsule);acceptCapsule(capsule);}catch(error){status(error.message,true);}});branches.append(button);}}catch{}
}
$('resume-view').addEventListener('click',async()=>{const candidate=resumeCandidate;if(!candidate)return;try{if(candidate.kind==='capsule')acceptCapsule(candidate.payload,{preserveCompanion:true});else await restoreSession(candidate.payload);}catch(error){status(`Unable to resume: ${error.message} The saved data is unchanged.`,true);}});
$('resume-companion').addEventListener('click',async()=>{const connection=resumeCompanion;if(!connection)return;try{await connect(connection.origin,connection.token);}catch(error){status(`Unable to reconnect: ${error.message} Open the companion’s local URL or resume the saved view.`,true);}});

async function openPreparedHome(generation){
  const index=await preparedIndex();if(generation!==routeGeneration)return true;if(!index?.home)return false;
  setBusy(true,'Opening the Swampland collection…');
  const home=index.home,entry=index.atlases.find(item=>item.atlasId===home.atlasId&&item.atlasVersion===home.atlasVersion&&item.entryDestinationId===home.destinationId);if(!entry)throw new Error('The default collection entrance is not in the installed catalog.');
  const selector={kind:'atlas-destination',atlasId:home.atlasId,atlasVersion:home.atlasVersion,destinationId:home.destinationId},loaded=await ensureAtlas(selector);if(generation!==routeGeneration)return true;if(loaded.atlas.manifest.entryDestinationId!==home.destinationId)throw new Error('The configured collection entrance does not match its pinned manifest.');
  const next=loaded.navigator.createSession({selector});await loaded.navigator.prepareState?.(currentState(next));if(generation!==routeGeneration)return true;
  acceptCapsule(createCapsule({session:next,view:loaded.navigator.computeView(currentState(next))}),{keepRoute:true,persist:false,preserveCompanion:true});return true;
}
let lastReadRoute;
async function loadRoute({initial = false} = {}) {
  const routeKey=location.href+JSON.stringify(history.state);if(!initial&&routeKey===lastReadRoute)return;lastReadRoute=routeKey;
  const generation = ++routeGeneration; routeAbort?.abort(); routeAbort = new AbortController();
  ++userIntent; ++sourceEpoch; queuedBridgeSnapshot = null;
  fragment = new URLSearchParams(location.hash.slice(1));
  try {
    if(fragment.has('atlas')){
      const route=routeTarget(fragment);
      setBusy(true,'Opening prepared atlas…');const prepared=await ensureAtlas(route.selector);
      if(generation!==routeGeneration)return;
      const next=routeSession(history.state?.eigenquestionsSession,route,prepared.navigator,prepared.atlas.manifest.corpusId);
      if(bridge)retainBranch(activeCapsule);
      events?.close();bridge=null;revision=-1;queuedBridgeSnapshot=null;bridgeNeedsRebase=false;actionQueue=Promise.resolve();loadingTask=Promise.resolve();
      $('connection-status').textContent='Browser session';
      await prepared.navigator.prepareState?.(currentState(next));
      if(generation!==routeGeneration)return;
      accept({session:next,view:prepared.navigator.computeView(currentState(next))},{keepRoute:true});return;
    }
    if (fragment.has('token')) {
      try { await connect(fragment.get('bridge') || location.origin, fragment.get('token')); return; }
      catch (error) { try {sessionStorage.removeItem(bridgeStorageKey);}catch{} $('bridge-message').textContent=`${error.message} Open the companion’s local URL for same-origin operation.`; }
    }
    if (!await openPreparedHome(generation)) throw new Error('Missing SwampWiki collection entrance.');
  } catch (error) { if(generation===routeGeneration && error.name!=='AbortError') {status(`Unable to open this view: ${error.message} Start a new path or open a file to continue.`,true);document.documentElement.dataset.ready='true';} }
  finally { if(generation===routeGeneration) setBusy(false); }
}
window.addEventListener('hashchange', () => loadRoute());
window.addEventListener('popstate', () => loadRoute());
window.swampwikiNavigator = window.eigenquestionsNavigator = Object.freeze({
  version:'1.0.0',
  ready:() => activeCapsule ? Promise.resolve(machineRead()) : new Promise(resolve=>readyWaiters.push(resolve)),
  read:machineRead,
  orient:async (query, options={}) => {
    const selector=options.selector || currentState(session).selector;
    const {navigator}=await ensureAtlas(selector);
    const oriented=navigator.createSession({...options,selector});
    await navigator.prepareState(currentState(oriented));
    return createCapsule({session:oriented,view:navigator.computeView(currentState(oriented))},{context:{question:currentState(oriented).query,originalQuestion:query}});
  },
  lookup:async (query,selector=currentState(session)?.selector) => {const prepared=await ensureAtlas(selector);await prepared.navigator.prepareSearch?.();return prepared.navigator.search(query,{limit:15});},
  describe:async selector => {const prepared=await ensureAtlas(selector);await prepared.navigator.prepareDestination?.(selector.destinationId);return prepared.navigator.destination(selector.destinationId);},
  sources:async (selector,{offset=0,limit=20,collection='membership',...filters}={}) => {const prepared=await ensureAtlas(selector);if(collection==='membership')await prepared.navigator.prepareSources?.(selector.destinationId);const page=prepared.navigator.sources(selector.destinationId,{offset,limit,collection,...filters});return {...page,items:await prepared.readSources(page.items)};},
  connections:async (selector,options={}) => {const prepared=await ensureAtlas(selector);await prepared.navigator.prepareDestination?.(selector.destinationId);return prepared.navigator.connections(selector.destinationId,options);},
  context:async (unitId,selector=currentState(session)?.selector,options={}) => {const prepared=await ensureAtlas(selector);return pageSourceContext(await prepared.readContext(unitId),options);},
  evidence:async ids => {
    if (!Array.isArray(ids) || ids.length>100) throw new Error('Supply at most 100 evidence IDs');
    const state=currentState(session),prepared=await ensureAtlas(state.selector);
    return prepared.navigator.getEvidence(ids,{destinationId:state.selector.destinationId});
  },
  apply:(capsule,{expectedRevision}={}) => {assertRevision(expectedRevision);return acceptCapsule(capsule,{expectedRevision});},
  navigate:async (payload,{expectedRevision}={}) => {assertRevision(expectedRevision);const result=await action(payload,{explicitContinuation:true});if(result?.error)throw new Error(result.error);if(!result)throw new Error('Navigation was superseded. Read current state.');return result;},
  export:() => activeCapsule ? structuredClone(activeCapsule) : null,
  subscribe:callback => {if(typeof callback!=='function')throw new Error('subscribe needs a callback.');observers.add(callback);return()=>observers.delete(callback);}
});
loadRoute({initial:true});
