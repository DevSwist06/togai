import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#error')).toBeHidden();
}
async function finishBriefing(page) {
  for (let rule = 1; rule <= 3; rule++) {
    await expect(page.locator('#dialogue-page')).toHaveText(`RULE ${rule} / 3`);
    const next = page.locator('#dialogue-next');
    if ((await next.textContent()).includes('SHOW TEXT')) await next.click();
    await next.click();
  }
  await expect(page.locator('#rival-dialogue')).not.toBeVisible();
}
async function start(page) {
  await ready(page);
  await page.locator('#start').click();
  await finishBriefing(page);
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
  await expect(page.getByText('ENGINE READY')).toHaveCount(0);
  await expect(page.locator('#drift')).toHaveCount(0);
  await expect(page.locator('#performance')).toContainText('FPS');
  await expect(page.locator('.intro-bottom > div:not(.touch-hint)').first()).toBeVisible();
  await expect(page.locator('.intro-bottom > div:not(.touch-hint)').nth(1)).toBeVisible();
  await expect(page.locator('.touch-hint')).toBeHidden();
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

test('clear pass shows five-second confirmation progress and resets when the race restarts', async ({
  page,
}) => {
  await page.route('**/game.js', async (route) => {
    const response = await route.fetch();
    const source = (await response.text()).replace(
      'race.tick(readInput(keys, headingAlignedInput(joystickState, joystickHeading)));',
      "race.tick(readInput(keys, headingAlignedInput(joystickState, joystickHeading))); if (race.phase === 'race') race.overtakeDuration = 2.5;",
    );
    await route.fulfill({ response, body: source });
  });
  await start(page);
  const progress = page.locator('#pass-confirmation');
  await expect(progress).toBeVisible();
  await expect(page.locator('#pass-time')).toHaveText('2.5 S');
  await expect(page.locator('#pass-progress')).toHaveJSProperty('value', 2.5);
  await page.screenshot({ path: test.info().outputPath('pass-confirmation.png') });
  await page.keyboard.press('r');
  await expect(progress).toBeHidden();
});

test.describe('phone controls', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('start screen fits a landscape phone', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await ready(page);
    await expect(page.locator('#start')).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath('phone-intro-landscape.png') });
  });

  test('joystick drives, brakes, and releases on cancel, pause, and rotation', async ({ page }) => {
    await ready(page);
    await expect(page.locator('.touch-hint')).toBeVisible();
    await expect(page.locator('.intro-bottom > div:not(.touch-hint)').first()).toBeHidden();
    await expect(page.locator('.intro-bottom > div:not(.touch-hint)').nth(1)).toBeHidden();
    await expect(page.locator('#start .start-emoji')).toBeVisible();
    await expect(page.locator('#start .start-arrow')).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.body).userSelect)).toBe('none');
    expect(
      await page.evaluate(() => {
        const selection = new Event('selectstart', { bubbles: true, cancelable: true });
        document.querySelector('#start').dispatchEvent(selection);
        return selection.defaultPrevented;
      }),
    ).toBe(true);
    await page.locator('#start').click();
    await finishBriefing(page);
    await expect(page.locator('#countdown')).toBeHidden({ timeout: 12_000 });
    const joystick = page.getByRole('button', { name: /^Driving joystick/ });
    await expect(page.locator('#position')).toHaveText('2/ 2');
    await expect(joystick).toBeInViewport();
    await expect(page.locator('[data-drive], #touch-controls')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('phone-portrait.png') });
    const session = await page.context().newCDPSession(page);
    const box = await joystick.boundingBox();
    const center = {
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
      id: 1,
    };
    const move = async (x, y) => {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...center, x: center.x + x, y: center.y + y }],
      });
    };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [center] });
    await move(0, -40);
    await expect
      .poll(async () => Number(await page.locator('#speed').textContent()))
      .toBeGreaterThan(20);
    await expect(joystick).toHaveClass(/active/);
    const initialGuideHeading = await joystick.evaluate((element) =>
      element.style.getPropertyValue('--joystick-heading'),
    );
    await move(38, -38);
    await expect
      .poll(() => page.locator('#joystick-knob').evaluate((knob) => knob.style.transform))
      .toContain('translate(');
    await expect
      .poll(() =>
        joystick.evaluate((element) => element.style.getPropertyValue('--joystick-heading')),
      )
      .not.toBe(initialGuideHeading);
    await move(0, 40);
    await expect
      .poll(async () => Number(await page.locator('#speed').textContent()))
      .toBeLessThan(8);
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(joystick).not.toHaveClass(/active/);
    await expect
      .poll(() => page.locator('#joystick-knob').evaluate((knob) => knob.style.transform))
      .toBe('');
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [center] });
    await move(0, -40);
    await page.locator('#pause').click();
    await expect(joystick).not.toHaveClass(/active/);
    await expect(page.locator('#pause-panel')).toBeVisible();
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.locator('#resume').click();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(joystick).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath('phone-landscape.png') });
  });
});

test('countdown/race pause, resume, focus loss and audio toggle', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('Enter');
  await finishBriefing(page);
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
      'race.tick(readInput(keys, headingAlignedInput(joystickState, joystickHeading)));',
      `const target = testPoint(s[8] + 13 + s[6] * 0.63); const desired = Math.atan2(target.x - s[0], -(target.y - s[1])); const delta = Math.atan2(Math.sin(desired - s[2]), Math.cos(desired - s[2])); race.tick({throttle:1, steer:Math.max(-1, Math.min(1, delta * 2.7)), brake:0, handbrake:0});`,
    );
    source = source.replace('accumulator += dt;', 'accumulator += 1;');
    await route.fulfill({ response, body: source });
  });
  await ready(page);
  await page.locator('#start').click();
  await finishBriefing(page);
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
      'race.tick(readInput(keys, headingAlignedInput(joystickState, joystickHeading)));',
      's[9] = 1; race.tick(readInput(keys, joystickState));',
    );
    await route.fulfill({ response, body: source });
  });
  await ready(page);
  await page.locator('#start').click();
  await finishBriefing(page);
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

test('rival briefing highlights rules, holds the race, supports mute, cancel and keyboard', async ({
  page,
}) => {
  await page.route('**/game.js', async (route) => {
    const response = await route.fetch();
    const source = (await response.text()).replace(
      'race = new Race(wasm, s);',
      'race = new Race(wasm, s); window.__briefingSnapshot = () => ({ phase: race.phase, count: race.count, state: Array.from(s), camera: { ...camera } });',
    );
    await route.fulfill({ response, body: source });
  });
  await ready(page);
  await page.locator('#start').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#countdown')).toBeHidden();
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.locator('#intro')).toBeHidden();
  await expect(page.locator('body')).toHaveClass('playing');
  await expect(page.locator('#dialogue-copy')).not.toBeEmpty();
  expect(
    await page
      .locator('#rival-dialogue')
      .evaluate((dialog) => getComputedStyle(dialog, '::backdrop').backgroundColor),
  ).toBe('rgba(0, 0, 0, 0)');
  const courseBefore = await page.evaluate(() => window.__briefingSnapshot());
  expect(courseBefore.phase).toBe('briefing');
  expect(courseBefore.camera).toEqual({
    x: courseBefore.state[0],
    y: courseBefore.state[1] + 32,
    zoom: 83,
  });
  await page.keyboard.press('w');
  await page.keyboard.press('r');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__briefingSnapshot())).toEqual(courseBefore);
  await expect(page.locator('#timer')).toHaveText('00:00.000');
  await page.keyboard.press('Space');
  await expect(page.locator('#dialogue-copy strong')).toHaveText('don’t touch the road borders.');
  await expect(page.locator('#dialogue-copy strong')).toHaveCSS('font-weight', '800');
  await expect(page.locator('#dialogue-copy strong')).toHaveCSS('color', 'rgb(179, 60, 35)');
  await expect(page.locator('#dialogue-copy')).toContainText('First run, rookie?');
  const bubble = await page.locator('.dialogue-box').boundingBox();
  const portrait = await page.locator('.rival-portrait').boundingBox();
  expect(portrait.x).toBeGreaterThan(bubble.x + bubble.width / 2);
  expect(portrait.y).toBeLessThan(bubble.y);
  await page.screenshot({ path: test.info().outputPath('rival-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#dialogue-next')).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath('rival-phone.png') });
  await page.locator('#dialogue-voice').click();
  await expect(page.locator('#dialogue-voice')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#dialogue-next').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('#dialogue-copy strong')).toHaveText('don’t hit my car.');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(page.locator('#dialogue-copy')).toContainText(
    'fully ahead and stay clear for 5 seconds.',
  );
  await expect(page.locator('#dialogue-copy')).toContainText('before I reach the finish.');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#dialogue-next')).toBeInViewport();
  await expect(page.locator('.rival-portrait')).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath('rival-landscape.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#intro')).toBeVisible();
  await page.locator('#start').click();
  await finishBriefing(page);
  await expect(page.locator('#countdown')).toHaveText('3');
});

test('briefing works with reduced motion and unavailable audio', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.AudioContext = class {
      constructor() {
        throw new Error('Audio unavailable');
      }
    };
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await page.locator('#start').click();
  await expect(page.locator('#dialogue-next')).toHaveText('NEXT ▸');
  await expect(page.locator('#dialogue-copy')).toContainText('One scrape and your run is over.');
  await finishBriefing(page);
  await expect(page.locator('#countdown')).toHaveText('3');
  expect(errors).toEqual([]);
});

test('rival speech follows text and stops when muted or the dialogue closes', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.AudioContext;
    window.__voicePitches = [];
    window.__voiceLevel = 0;
    window.AudioContext = class extends NativeAudio {
      createOscillator() {
        const oscillator = super.createOscillator();
        const original = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
        oscillator.frequency.setValueAtTime = (value, ...args) => {
          window.__voicePitches.push(value);
          return original(value, ...args);
        };
        return oscillator;
      }
      createGain() {
        const gain = super.createGain();
        const original = gain.gain.setValueAtTime.bind(gain.gain);
        gain.gain.setValueAtTime = (value, ...args) => {
          window.__voiceLevel = value;
          return original(value, ...args);
        };
        return gain;
      }
    };
  });
  await ready(page);
  await page.locator('#start').click();
  await expect
    .poll(() => page.evaluate(() => new Set(window.__voicePitches).size))
    .toBeGreaterThan(1);
  await page.locator('#dialogue-voice').click();
  const count = await page.evaluate(() => window.__voicePitches.length);
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.__voicePitches.length)).toBe(count);
  expect(await page.evaluate(() => window.__voiceLevel)).toBe(0);
  await page.locator('#dialogue-voice').click();
  await expect.poll(() => page.evaluate(() => window.__voicePitches.length)).toBeGreaterThan(count);
  await page.keyboard.press('Escape');
  const stopped = await page.evaluate(() => window.__voicePitches.length);
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.__voicePitches.length)).toBe(stopped);
  expect(await page.evaluate(() => window.__voiceLevel)).toBe(0);
});
