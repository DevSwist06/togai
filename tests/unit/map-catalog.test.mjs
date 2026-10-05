import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeMapCatalog } from '../../scripts/map-catalog.mjs';

test('adding a config folder discovers a new map without a manual registry change', async () => {
  const root = await mkdtemp(join(tmpdir(), 'togai-maps-'));
  try {
    const directory = pathToFileURL(`${root}/`);
    await writeFile(join(root, 'package.json'), '{"type":"module"}');
    await assert.rejects(writeMapCatalog(directory), /No map configurations/);
    await mkdir(join(root, 'new-pass'));
    await mkdir(join(root, 'assets'));
    await writeFile(
      join(root, 'new-pass', 'config.js'),
      "export default {id:'new-pass',name:'New Pass'};\n",
    );
    assert.deepEqual(await writeMapCatalog(directory), ['new-pass']);
    const { default: maps } = await import(new URL('catalog.js', directory));
    assert.deepEqual(maps, [{ id: 'new-pass', name: 'New Pass' }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
