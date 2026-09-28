import { spawnSync } from 'node:child_process';
const env = { ...process.env };
// Playwright sets FORCE_COLOR for workers. Avoid a conflicting inherited setting.
delete env.NO_COLOR;
const result = spawnSync(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
  { env, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
