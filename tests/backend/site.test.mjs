import assert from 'node:assert/strict';
import test from 'node:test';
import site from '../../backend/site.mjs';

test('www redirects pages, assets and API requests to the HTTPS apex', async () => {
  for (const [path, method] of [
    ['/', 'GET'],
    ['/atlas/a%2Fb.html?tag=a+b&tag=c%2Fd', 'GET'],
    ['/styles.css?v=2', 'HEAD'],
    ['/api/views', 'POST'],
  ]) {
    const request = new Request(`http://www.swampwiki.com${path}`, {method});
    const response = await site.fetch(request, {});
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('Location'), `https://swampwiki.com${path}`);
  }
});

test('the apex sends the original request through to the assets binding', async () => {
  const request = new Request('https://swampwiki.com/atlas/?q=spectrum');
  const response = new Response('atlas');
  const env = {ASSETS: {fetch(input) {
    assert.strictEqual(input, request);
    return response;
  }}};
  assert.strictEqual(await site.fetch(request, env), response);
});

test('stored-view writes and reads report unavailable storage on the apex', async () => {
  for (const [path, method] of [
    ['/api/views', 'POST'],
    ['/api/views/AAAAAAAAAAAAAAAAAAAAAA', 'GET'],
  ]) {
    const response = await site.fetch(new Request(`https://swampwiki.com${path}`, {method}), {});
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'storage_unavailable');
  }
});
