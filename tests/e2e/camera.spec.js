import { test, expect } from '@playwright/test';

for (const scenario of [
  { course: 'kasumi', distance: 65, width: 1440, height: 950 },
  { course: 'beaufort', distance: 300, width: 800, height: 600 },
  { course: 'beaufort', distance: 300, width: 390, height: 844 },
]) {
  test(`camera tracks real driving through ${scenario.course} corners at ${scenario.width}px`, async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    // Only the test response exposes snapshots and a bend fixture. Rendering,
    // camera updates, fixed physics steps and lifecycle remain the real modules.
    await page.route('**/game.js', async (route) => {
      const response = await route.fetch();
      const source = (await response.text())
        .replace(
          'race = new Race(wasm, s);',
          `race = new Race(wasm, s);
          window.__cameraFrames = [];
          window.__cameraSnapshot = () => ({ camera: {...camera}, state: Array.from(s), phase: race.phase });
          window.__cameraDriveFrom = (d) => {
            const p = atDistance(d);
            wasm.reset(p.x, p.y, p.a);
            s[3] = Math.sin(p.a) * 40; s[4] = -Math.cos(p.a) * 40; s[6] = 40; s[8] = d;
            camera = {x:p.x, y:p.y-12, zoom:75};
            race.phase = 'race'; $('countdown').hidden = true;
            window.__cameraFrames.length = 0;
          };`,
        )
        .replace(
          'race.tick(readInput(keys, mobileInput));',
          `const target = atDistance(s[8] + 13 + s[6] * 0.63);
          const desired = Math.atan2(target.x - s[0], -(target.y - s[1]));
          const delta = Math.atan2(Math.sin(desired - s[2]), Math.cos(desired - s[2]));
          race.tick({throttle:s[6] < 40 ? 1 : 0, steer:Math.max(-1, Math.min(1,delta*2.7)), brake:s[6] > 43 ? 0.3 : 0, handbrake:0});`,
        )
        .replace(
          'screenBoundary = brakeBoundary',
          `if (race.phase === 'race' && window.__cameraFrames.length < 1500)
            window.__cameraFrames.push({x:camera.x,y:camera.y,zoom:camera.zoom,dt,sx:s[0],sy:s[1]});
          screenBoundary = brakeBoundary`,
        );
      await route.fulfill({ response, body: source });
    });
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto('/');
    await expect(page.locator('#start')).toBeEnabled();
    await page.locator('#skin-switch').click();
    await page.locator('#mode-clock').click();
    if (scenario.course === 'beaufort') {
      await page.locator('#course-next').click();
      await expect(page.locator('#start')).toBeEnabled();
    }
    await page.locator('#start').click();
    await page.evaluate((d) => window.__cameraDriveFrom(d), scenario.distance);
    await expect
      .poll(() => page.evaluate(() => window.__cameraSnapshot().state[8]))
      .toBeGreaterThan(scenario.distance + 100);
    await page.keyboard.press('Escape');
    await expect(page.locator('#pause-panel')).toBeVisible();
    const snapshot = await page.evaluate(() => window.__cameraSnapshot());
    expect(snapshot.phase).toBe('paused');
    expect(snapshot.camera.zoom).toBeGreaterThan(65);
    expect(snapshot.camera.zoom).toBeLessThan(73);
    const frames = await page.evaluate(() => window.__cameraFrames);
    expect(frames.length).toBeGreaterThan(20);
    for (let i = 1; i < frames.length; i++) {
      const current = frames[i],
        previous = frames[i - 1];
      expect(Math.abs(current.zoom - previous.zoom)).toBeLessThan(0.5);
      expect(Math.hypot(current.x - previous.x, current.y - previous.y)).toBeLessThan(4);
      expect(
        Math.abs(current.sx - current.x) / ((current.zoom * scenario.width) / scenario.height),
      ).toBeLessThan(0.65);
      expect(Math.abs(current.sy - current.y) / current.zoom).toBeLessThan(0.65);
    }
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__cameraSnapshot())).toEqual(snapshot);
    await page.locator('#pause-panel').evaluate((panel) => {
      panel.hidden = true;
    });
    const screenshot = await page.screenshot({
      path: test.info().outputPath(`camera-${scenario.course}-${scenario.width}.png`),
    });
    const carPixels = await page.evaluate(
      async ({ base64, snapshot }) => {
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const scale = image.height / (snapshot.camera.zoom * 2);
        const x = image.width / 2 + (snapshot.state[0] - snapshot.camera.x) * scale;
        const y = image.height / 2 + (snapshot.state[1] - snapshot.camera.y) * scale;
        const radius = Math.ceil(scale * 5);
        const pixels = ctx.getImageData(
          Math.floor(x) - radius,
          Math.floor(y) - radius,
          radius * 2,
          radius * 2,
        ).data;
        let red = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] === 217 && pixels[i + 1] === 45 && pixels[i + 2] === 56) red++;
        image.close();
        return red;
      },
      { base64: screenshot.toString('base64'), snapshot },
    );
    expect(carPixels).toBeGreaterThan(15);
    await page.locator('#pause-panel').evaluate((panel) => {
      panel.hidden = false;
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('#pause-panel')).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => window.__cameraSnapshot().state[8]))
      .toBeGreaterThan(snapshot.state[8] + 4);
    await page.keyboard.press('r');
    await expect(page.locator('#countdown')).toBeVisible();
    const restarted = await page.evaluate(() => window.__cameraSnapshot());
    expect(restarted.phase).toBe('countdown');
    expect(restarted.state[8]).toBe(0);
    expect(Math.abs(restarted.camera.x)).toBeLessThan(1);
    expect(restarted.camera.zoom).toBeLessThanOrEqual(75);
    expect(errors).toEqual([]);
  });
}
