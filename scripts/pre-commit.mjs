import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, TOGAI_STAGED_CHECK: '1' },
  });
  if (result.error || result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed`, { cause: result.error });
}
const snapshot = mkdtempSync(join(tmpdir(), 'togai-staged-'));
try {
  // checkout-index copies the entire index, including partially staged file contents.
  // It never changes the working tree, index, or user's unstaged edits.
  run('git', ['checkout-index', '--all', `--prefix=${snapshot}${sep}`]);
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], snapshot);
  run('npm', ['run', 'verify'], snapshot);
  console.log('Staged commit passed lint, all tests, and security checks.');
} catch (error) {
  console.error(`Commit blocked: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(snapshot, { recursive: true, force: true });
}
