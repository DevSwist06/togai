import { spawnSync } from 'node:child_process';
import { chmodSync } from 'node:fs';
const git = spawnSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf8' });
if (git.status !== 0) {
  console.log('No Git repository yet. Run git init, then npm run hooks:install.');
} else {
  chmodSync('.githooks/pre-commit', 0o755);
  const result = spawnSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
