import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

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

test('GitHub Actions builds and deploys Pages without running the WebGPU quality suite', async () => {
  const workflow = await readFile('.github/workflows/deploy-pages.yml', 'utf8');
  const workflows = await readdir('.github/workflows');

  assert.match(workflow, /branches:\s*\[main\]/u);
  assert.match(workflow, /run: npm run build/u);
  assert.match(workflow, /path: dist/u);
  assert.match(workflow, /actions\/deploy-pages@/u);
  assert.equal(workflows.includes('quality.yml'), false);
});
