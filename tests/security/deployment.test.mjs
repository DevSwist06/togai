import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser assets use paths that work from a GitHub Pages project subpath', async () => {
  const html = await readFile('public/index.html', 'utf8');
  const game = await readFile('src/client/game.js', 'utf8');

  assert.match(html, /href="\.\/style\.css"/u);
  assert.match(html, /href="\.\/"/u);
  assert.match(html, /src="\.\/game\.js"/u);
  assert.match(game, /new URL\('\.\/physics\.wasm', import\.meta\.url\)/u);
  assert.doesNotMatch(html, /(?:href|src)="\/(?:style\.css|game\.js|physics\.wasm)"/u);
  assert.doesNotMatch(game, /fetch\('\/(?:physics\.wasm)'\)/u);
});
