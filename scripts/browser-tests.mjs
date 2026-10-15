import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

// Each verification (including isolated pre-commit snapshots) owns its server.
// Keep reuseExistingServer disabled so tests can never run against stale builds.
const reservation = createServer();
await new Promise((resolve, reject) => {
  reservation.once('error', reject);
  reservation.listen(0, '127.0.0.1', resolve);
});
const port = reservation.address().port;
await new Promise((resolve, reject) => {
  reservation.close((error) => (error ? reject(error) : resolve()));
});
const env = { ...process.env };
env.TOGAI_TEST_PORT = String(port);
// Playwright sets FORCE_COLOR for workers. Avoid a conflicting inherited setting.
delete env.NO_COLOR;
const result = spawnSync(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
  { env, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
