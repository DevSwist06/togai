import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const script = new URL('../../scripts/pre-commit.mjs', import.meta.url);
for (const failure of [false, true])
  test(`pre-commit ${failure ? 'blocks failure' : 'checks staged snapshot'} without changing unstaged edits`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'togai-hook-test-'));
    try {
      const run = (args) => {
        const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
        assert.equal(r.status, 0, r.stderr);
      };
      run(['init', '--quiet']);
      mkdirSync(join(dir, 'scripts'));
      cpSync(script, join(dir, 'scripts/pre-commit.mjs'));
      writeFileSync(join(dir, 'sample.txt'), 'staged');
      run(['add', '.']);
      writeFileSync(join(dir, 'sample.txt'), 'unstaged');
      const bin = join(dir, 'bin');
      mkdirSync(bin);
      // Replace only npm to test hook orchestration, staging semantics and exit propagation.
      writeFileSync(
        join(bin, 'npm'),
        `#!/bin/sh\n[ "$(cat sample.txt)" = staged ] || exit 42\n[ "$1" != run ] || exit ${failure ? 7 : 0}\n`,
        { mode: 0o755 },
      );
      const result = spawnSync(process.execPath, ['scripts/pre-commit.mjs'], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, PATH: bin + ':' + process.env.PATH },
      });
      assert.equal(result.status, failure ? 1 : 0, result.stderr);
      assert.equal(readFileSync(join(dir, 'sample.txt'), 'utf8'), 'unstaged');
      assert.equal(
        spawnSync('git', ['show', ':sample.txt'], { cwd: dir, encoding: 'utf8' }).stdout,
        'staged',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
