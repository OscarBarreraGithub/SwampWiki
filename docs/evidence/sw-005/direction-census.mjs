import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Run after npm run build. An optional argument selects a copy of the same SwampWiki distribution.
const directory = process.argv[2] ?? 'dist/data/atlas/swampwiki/2026-11-18-text-v1';
const read = filename => JSON.parse(readFileSync(join(directory, filename), 'utf8'));
const catalog = read('catalog.json');
const catalogRows = catalog.destinations;
const records = new Map(catalogRows.map(row => [row.id, row]));
const incident = new Map(catalogRows.map(row => [row.id, []]));
const entry = 'collection:q025-quantum-gravity';
const otherEnd = (relation, origin) => relation.source === origin ? relation.target : relation.source;
const organization = relation => relation.provenance?.navigationBasis;

for (const relation of catalog.relations) {
  for (const id of new Set([relation.source, relation.target])) incident.get(id).push(relation);
}
for (const filename of readdirSync(directory).filter(name => name.startsWith('destination-details-authored-'))) {
  for (const [id, { navigation }] of Object.entries(read(filename).destinations)) {
    for (const row of navigation?.destinations ?? []) records.set(row.id, row);
    for (const relation of navigation?.relations ?? []) {
      if (!incident.has(id)) throw new Error(`Unexpected authored destination ${id}`);
      if (relation.indexTemplate !== 'source_question') throw new Error('Unknown lazy relation template');
      incident.get(id).push({ ...relation, type: 'source_question' });
    }
  }
}

// Mirror the published adapter rather than inferring rank from the array order in a shard.
function priority(relation, origin) {
  if (relation.type === 'source_question') return 4;
  if (['same_source_organizational_access', 'curated_collection_entry'].includes(organization(relation))) return 3;
  if (relation.type === 'narrower') return relation.source === origin ? 0 : 2;
  return 1;
}

function shownChoices(row) {
  const target = relation => otherEnd(relation, row.id);
  const sorted = [...incident.get(row.id)].sort((a, b) =>
    priority(a, row.id) - priority(b, row.id)
    || records.get(target(a)).title.localeCompare(records.get(target(b)).title)
    || a.id.localeCompare(b.id));
  const choices = new Map();
  for (const link of sorted) if (!choices.has(target(link))) choices.set(target(link), link);
  return [...choices.values()].slice(0, row.metadataOnly ? 20 : 15);
}

function reachable(allow) {
  const seen = new Set([entry]);
  const queue = [entry];
  for (const origin of queue) {
    for (const relation of incident.get(origin)) {
      const target = otherEnd(relation, origin);
      if (!incident.has(target) || seen.has(target) || !allow(relation, origin)) continue;
      seen.add(target);
      queue.push(target);
    }
  }
  return seen.size - 1;
}

const choicesByClass = {};
for (const row of catalogRows) {
  if (row.id === entry) continue;
  const group = row.kind === 'region' ? 'region'
    : row.id.startsWith('q025-placement-question:') ? 'placement' : 'authored';
  const totals = choicesByClass[group] ??= { pages: 0, shown: 0, papers: 0, mixedWithNarrower: 0 };
  const shown = shownChoices(row);
  const papers = shown.filter(link => link.type === 'source_question').length;
  totals.pages++;
  totals.shown += shown.length;
  totals.papers += papers;
  if (papers && shown.some(link => link.type === 'narrower' && link.source === row.id)) totals.mixedWithNarrower++;
}

const directedCounts = new Map();
for (const r of catalog.relations) {
  const key = JSON.stringify([r.source, r.target, r.type]);
  directedCounts.set(key, (directedCounts.get(key) ?? 0) + 1);
}
const repeated = [...directedCounts.values()].filter(n => n > 1);
console.log(JSON.stringify({
  otherCatalogDestinations: catalogRows.length - 1,
  reachableByNarrowing: reachable((r, from) => r.source === from &&
    (r.type === 'narrower' || (from === entry && organization(r) === 'curated_collection_entry'))),
  reachableByAllCatalogLinks: reachable(() => true),
  choicesByClass,
  repeatedDirectedTriples: repeated.length,
  additionalRelations: repeated.reduce((sum, n) => sum + n - 1, 0),
}, null, 2));
