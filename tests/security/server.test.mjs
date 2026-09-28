import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { createAppServer } from '../../src/server/server.js';
let dir, server, port;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'togai-security-'));
  const root = join(dir, 'public');
  await mkdir(root);
  await writeFile(join(root, 'index.html'), '<h1>game</h1>');
  await writeFile(join(root, 'app.js'), 'export {};');
  await writeFile(join(root, 'engine.wasm'), new Uint8Array([0, 97, 115, 109]));
  await writeFile(join(dir, 'secret.js'), 'PRIVATE');
  await symlink(join(dir, 'secret.js'), join(root, 'escape.js'));
  server = createAppServer({ root });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});
function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}
test('serves HTML, JavaScript, WASM and HEAD with correct content types', async () => {
  for (const [path, type] of [
    ['/', 'text/html'],
    ['/app.js?x=1', 'text/javascript'],
    ['/engine.wasm', 'application/wasm'],
  ]) {
    const r = await request(path);
    assert.equal(r.status, 200);
    assert(r.headers['content-type'].startsWith(type));
  }
  const head = await request('/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert(Number(head.headers['content-length']) > 0);
});
test('CSP blocks inline scripts and embedding while allowing compiled WASM', async () => {
  const { headers } = await request('/');
  assert.match(headers['content-security-policy'], /script-src 'self' 'wasm-unsafe-eval'/);
  assert(!headers['content-security-policy'].includes("'unsafe-inline'"));
  assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['referrer-policy'], 'no-referrer');
  assert.equal(headers['cross-origin-resource-policy'], 'same-origin');
});
test('rejects traversal, encoded traversal, dotfiles, NULs, and symlink escapes', async () => {
  for (const path of [
    '/../secret.js',
    '/%2e%2e/secret.js',
    '/a/../../secret.js',
    '/.env',
    '/.git/config',
    '/%5c..%5csecret.js',
    '/app.js%00',
    '/escape.js',
  ]) {
    const r = await request(path);
    assert.equal(r.status, 403, path);
    assert(!r.body.includes('PRIVATE'));
    assert(!r.body.includes(dir));
  }
});
test('malformed URLs and unknown files fail closed without leaking internals', async () => {
  assert.equal((await request('/%ZZ')).status, 400);
  assert.equal((await request('/%E0%A4%A')).status, 400);
  for (const path of [
    '/package.json',
    '/missing.js',
    '/src/physics/physics.ts',
    '/%252e%252e/secret.js',
  ]) {
    const r = await request(path);
    assert.equal(r.status, 404);
    assert(!r.body.includes(dir));
    assert(!r.body.includes('Error:'));
  }
});
test('rejects mutation methods with restrictive headers', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const r = await request('/', method);
    assert.equal(r.status, 405);
    assert.equal(r.headers.allow, 'GET, HEAD');
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
  }
});
