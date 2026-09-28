import { cp, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await cp(new URL('../public/', import.meta.url), new URL('../dist/', import.meta.url), {
  recursive: true,
});
await cp(new URL('../src/client/', import.meta.url), new URL('../dist/', import.meta.url), {
  recursive: true,
});
const result = spawnSync(
  process.execPath,
  [
    'node_modules/assemblyscript/bin/asc.js',
    'src/physics/physics.ts',
    '--outFile',
    'dist/physics.wasm',
    '--optimize',
    '--runtime',
    'stub',
  ],
  { cwd: root, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
