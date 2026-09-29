import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#error')).toBeHidden();
}
async function start(page) {
  await ready(page);
  await page.locator('#start').click();
  await expect(page.locator('#countdown')).toHaveText('3');
  await expect(page.locator('#countdown')).toBeHidden({ timeout: 12_000 });
}

test('real WebGPU boots without console errors and renders nonempty scene and map', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await ready(page);
  await expect(page.locator('#engine-status')).toContainText('ENGINE READY');
  await expect(page.locator('#performance')).toContainText('FPS');
  const image = await page.locator('#game').screenshot();
  expect(image.length).toBeGreaterThan(10_000);
  await page.screenshot({ path: test.info().outputPath('desktop.png') });
  const visible = await page.locator('#preview-map').evaluate((canvas) =>
    canvas
      .getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height)
      .data.some((value) => value !== 0),
  );
  expect(visible).toBe(true);
  await page.setViewportSize({ width: 800, height: 600 });
  await expect(page.locator('#start')).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath('compact.png') });
  expect(errors).toEqual([]);
});

test('keyboard acceleration, steering, handbrake, brake, HUD and restart', async ({ page }) => {
  await start(page);
  await page.keyboard.down('w');
  await expect
    .poll(async () => Number(await page.locator('#speed').textContent()))
    .toBeGreaterThan(45);
  await page.keyboard.down('d');
  await page.keyboard.down('Space');
  await expect(page.locator('#drift')).toContainText('DRIFTING');
  await page.screenshot({ path: test.info().outputPath('drift.png') });
  await page.keyboard.up('Space');
  await page.keyboard.up('d');
  await page.keyboard.up('w');
  await page.keyboard.down('s');
  await expect.poll(async () => Number(await page.locator('#speed').textContent())).toBeLessThan(8);
  await page.keyboard.up('s');
  await expect(page.locator('#timer')).not.toHaveText('00:00.000');
  await page.keyboard.press('r');
  await expect(page.locator('#timer')).toHaveText('00:00.000');
  await expect(page.locator('#speed')).toHaveText('0');
  await expect(page.locator('#percent')).toHaveText('0%');
});

test('countdown/race pause, resume, focus loss and audio toggle', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-panel')).toBeVisible();
  await expect(page.locator('#timer')).toHaveText('00:00.000');
  await page.locator('#resume').click();
  await expect(page.locator('#countdown')).toBeHidden({ timeout: 12_000 });
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toContainText('SOUND ON');
  await page.keyboard.press('m');
  await expect(page.locator('#sound')).toContainText('SOUND OFF');
  await page.keyboard.press('Escape');
  const time = await page.locator('#timer').textContent();
  await page.waitForTimeout(200);
  await expect(page.locator('#timer')).toHaveText(time);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-panel')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#pause-panel')).toBeVisible();
});

test('real WASM full race reaches results, garage and replay', async ({ page }) => {
  // Browser-side test driver replaces only input and clock speed. No production test API.
  // Node tests separately exercise the untouched lifecycle with real WASM.
  await page.route('**/game.js', async (route) => {
    const response = await route.fetch();
    let source = await response.text();
    source = "import { atDistance as testPoint } from './track.js';\n" + source;
    source = source.replace(
      'race.tick(readInput(keys));',
      `const target = testPoint(s[8] + 13 + s[6] * 0.63); const desired = Math.atan2(target.x - s[0], -(target.y - s[1])); const delta = Math.atan2(Math.sin(desired - s[2]), Math.cos(desired - s[2])); race.tick({throttle:1, steer:Math.max(-1, Math.min(1, delta * 2.7)), brake:0, handbrake:0});`,
    );
    source = source.replace('accumulator += dt;', 'accumulator += 1;');
    await route.fulfill({ response, body: source });
  });
  await ready(page);
  await page.locator('#start').click();
  await expect(page.locator('#results')).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('#result-title')).toContainText('OVERTAKE');
  await expect(page.locator('#final-time')).toHaveText(/\d{2}:\d{2}\.\d{3}/);
  await expect(page.locator('#final-drift')).toHaveText(/\d+\.\ds/);
  await page.locator('#again').click();
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#results')).toBeVisible({ timeout: 25_000 });
  await page.locator('#back').click();
  await expect(page.locator('#intro')).toBeVisible();
  await expect(page.locator('#hud')).toBeHidden();
});

test('roadside crash presents the explosion loss result', async ({ page }) => {
  await page.route('**/game.js', async (route) => {
    const response = await route.fetch();
    const source = (await response.text()).replace(
      'race.tick(readInput(keys));',
      's[9] = 1; race.tick(readInput(keys));',
    );
    await route.fulfill({ response, body: source });
  });
  await ready(page);
  await page.locator('#start').click();
  await expect(page.locator('#results')).toBeVisible({ timeout: 12_000 });
  await expect(page.locator('#result-title')).toContainText('CRASHED');
  await expect(page.locator('#result-copy')).toContainText('roadside');
  await expect(page.locator('#final-time')).toHaveText('CRASHED');
});

test('unsupported WebGPU presents recovery instructions', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/');
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error-message')).toContainText('WebGPU');
  await expect(page.locator('#retry')).toBeVisible();
});

test('missing physics and unavailable graphics adapter fail visibly', async ({ page }) => {
  await page.route('**/physics.wasm', (route) => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto('/');
  await expect(page.locator('#error-message')).toContainText('Physics module is missing');
  await page.unroute('**/physics.wasm');
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'gpu', { value: { requestAdapter: async () => null } }),
  );
  await page.goto('/');
  await expect(page.locator('#error-message')).toContainText('No WebGPU adapter');
});

test('CSP blocks injected inline script execution', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'document.body.dataset.injected="yes"';
    document.body.append(script);
    return document.body.dataset.injected;
  });
  expect(result).toBeUndefined();
});

test('audio graph responds to driving and mutes when paused', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.AudioContext;
    window.__audioValues = [];
    window.AudioContext = class extends NativeAudio {
      createGain() {
        const gain = super.createGain();
        const original = gain.gain.setTargetAtTime.bind(gain.gain);
        gain.gain.setTargetAtTime = (value, ...args) => {
          window.__audioValues.push(value);
          return original(value, ...args);
        };
        return gain;
      }
    };
  });
  await start(page);
  await page.locator('#sound').click();
  await expect.poll(() => page.evaluate(() => window.__audioValues.at(-1))).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__audioValues.at(-1))).toBe(0);
});

test('graphics device loss presents recovery instructions', async ({ page }) => {
  await page.addInitScript(() => {
    const original = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function (...args) {
      const device = await original.apply(this, args);
      window.__testDevice = device;
      return device;
    };
  });
  await ready(page);
  await page.evaluate(() => window.__testDevice.destroy());
  await expect(page.locator('#error-message')).toContainText('graphics device was lost');
});
