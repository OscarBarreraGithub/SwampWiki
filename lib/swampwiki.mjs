/** Public product identity. The frozen source corpus has its own upstream ID. */
export const siteOrigin = 'https://swampwiki.com';
export const atlasId = 'swampwiki';
export const atlasVersion = '2026-11-18-text-v1';
export const entryDestinationId = 'collection:q025-quantum-gravity';

export function isSwampWikiSelector(selector) {
  return selector?.kind === 'atlas-destination' && selector.atlasId === atlasId && selector.atlasVersion === atlasVersion;
}
