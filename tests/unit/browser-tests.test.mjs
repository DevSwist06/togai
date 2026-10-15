import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const runner = new URL('../../scripts/browser-tests.mjs', import.meta.url);
const config = new URL('../../playwright.config.js', import.meta.url);
function run(args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, options);
    let stdout = '',
      stderr = '';
    child.stdout.setEncoding('utf8').on('data', (data) => {
      stdout += data;
    });
    child.stderr.setEncoding('utf8').on('data', (data) => {
      stderr += data;
    });
    child.once('error', reject);
    child.once('close', (status) => resolve({ status, stdout, stderr }));
  });
}
async function fixture(exitCode = 0) {
  const dir = await mkdtemp(join(tmpdir(), 'togai-browser-runner-'));
  const cli = join(dir, 'node_modules/@playwright/test');
  await mkdir(cli, { recursive: true });
  await writeFile(join(cli, 'package.json'), '{"type":"module"}');
  // Replace only the Playwright CLI. Exercise the real runner and configuration
  // with real loopback listeners, without allocating a GPU for orchestration tests.
  await writeFile(
    join(cli, 'cli.js'),
    `
    import assert from 'node:assert/strict';
    import { createServer } from 'node:http';
    import config from ${JSON.stringify(config.href)};
    const port = Number(config.webServer.env.PORT);
    const origin = 'http://127.0.0.1:' + port;
    assert.equal(config.use.baseURL, origin);
    assert.equal(config.webServer.url, origin);
    assert.equal(config.webServer.reuseExistingServer, false);
    const server = createServer((req, res) => res.end(String(port)));
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    const response = await fetch(config.use.baseURL);
    assert.equal(await response.text(), String(port));
    console.log(JSON.stringify({ port, args: process.argv.slice(2), noColor: process.env.NO_COLOR }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await new Promise((resolve) => server.close(resolve));
    process.exitCode = ${exitCode};
  `,
  );
  return dir;
}

test('concurrent browser gates own separate live servers and keep strict server identity', async () => {
  const dir = await fixture();
  try {
    const options = { cwd: dir, env: { ...process.env, NO_COLOR: '1', TOGAI_TEST_PORT: '5187' } };
    const results = await Promise.all([
      run([runner.pathname, '--grep', 'camera'], options),
      run([runner.pathname, '--grep', 'camera'], options),
    ]);
    const ports = [];
    for (const result of results) {
      assert.equal(result.status, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      assert.deepEqual(output.args, ['test', '--grep', 'camera']);
      assert.equal(output.noColor, undefined);
      assert(output.port > 0 && output.port <= 65535);
      assert.notEqual(output.port, 5187, 'An inherited fixed port must not be reused');
      ports.push(output.port);
    }
    assert.notEqual(ports[0], ports[1], 'Concurrent verification cannot share a listener');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('browser gate propagates a failed suite instead of bypassing it', async () => {
  const dir = await fixture(7);
  try {
    const result = await run([runner.pathname], { cwd: dir, env: process.env });
    assert.equal(result.status, 7, result.stderr);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('test server configuration rejects invalid port overrides', async () => {
  for (const port of ['0', '-1', '65536', '1.5', 'invalid']) {
    const result = await run(
      ['--input-type=module', '--eval', `await import(${JSON.stringify(config.href)})`],
      {
        env: { ...process.env, TOGAI_TEST_PORT: port },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /TOGAI_TEST_PORT must be an integer from 1 to 65535/);
  }
});
