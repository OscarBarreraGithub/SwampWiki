import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {atlasId, atlasVersion, entryDestinationId} from '../../lib/swampwiki.mjs';
import {checkPublication} from './publication_check.mjs';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));

test('publication probe distinguishes the scoped text release, stale assets and a parked domain', async () => {
  const catalog = `/data/atlas/${atlasId}/${atlasVersion}/catalog.json`;
  const entry = `/atlas/${atlasId}/${atlasVersion}/${entryDestinationId}.html`;
  const staleAssets = new Set(['/app.js', '/lib/swampwiki.mjs', catalog]);
  let mode = 'current';
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (mode === 'parked') {
      response.end('<title>Domain parking</title>');
      return;
    }
    if (mode === 'stale' && (staleAssets.has(pathname) || pathname === '/overview.html')) {
      response.end('old release');
      return;
    }
    if (mode === 'stale' && pathname === '/api/vote') {
      response.writeHead(400);
      response.end('old API');
      return;
    }
    try {
      response.end(await readFile(path.join(dist, pathname === '/' ? 'index.html' : pathname.slice(1))));
    } catch {
      response.writeHead(request.method === 'POST' ? 405 : 404);
      response.end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const options = {origin: `http://127.0.0.1:${server.address().port}`, dist};
    const good = await checkPublication(options);
    assert.equal(good.passed, true);
    assert.equal(good.kind, 'swampwiki-publication-check');
    assert.equal(good.expected.atlasVersion, atlasVersion);
    assert.equal(good.expected.entryDestinationId, entryDestinationId);
    assert.match(good.expected.manifestSha256, /^[a-f0-9]{64}$/);
    for (const pathname of [catalog, entry, '/lib/swampwiki.mjs', '/lib/protocol/presentation.mjs']) {
      assert.equal(good.assets.find(item => item.path === pathname)?.passed, true, pathname);
    }
    assert.equal(JSON.stringify(good).includes(dist), false);

    mode = 'stale';
    const stale = await checkPublication(options);
    assert.equal(stale.passed, false);
    assert.deepEqual(new Set(stale.assets.filter(item => !item.passed).map(item => item.path)), staleAssets);
    assert.equal(stale.retiredRoutes.find(item => item.path === '/overview.html' && item.method === 'GET').passed, false);
    assert.equal(stale.retiredRoutes.find(item => item.path === '/api/vote' && item.method === 'POST').passed, false);

    mode = 'parked';
    const parked = await checkPublication(options);
    assert.equal(parked.passed, false);
    assert.equal(parked.summary.matchedAssets, 0);
    assert.equal(parked.summary.retiredRoutePasses, 0);
  } finally {
    server.closeIdleConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
