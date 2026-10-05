import { readdir, access, writeFile } from 'node:fs/promises';

// A folder with config.js is a map. Generate imports for both source tests and the browser build.
export async function writeMapCatalog(directory) {
  const folders = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^[a-z][a-z0-9-]*$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const maps = [];
  for (const folder of folders) {
    try {
      await access(new URL(`${folder}/config.js`, directory));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    maps.push(folder);
  }
  if (!maps.length) throw new Error('No map configurations found');
  const source =
    maps.map((folder, i) => `import map${i} from './${folder}/config.js';`).join('\n') +
    `\nexport default [${maps.map((_, i) => `map${i}`).join(', ')}];\n`;
  await writeFile(new URL('catalog.js', directory), source);
  return maps;
}
