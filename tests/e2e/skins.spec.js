import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
}

async function redBodyPixels(page) {
  const screenshot = await page.locator('#game').screenshot();
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] === 217 && pixels[i + 1] === 45 && pixels[i + 2] === 56) red++;
    image.close();
    return red;
  }, screenshot.toString('base64'));
}

test('garage selection previews, persists and renders the Peugeot through courses and retries', async ({
  page,
  context,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await ready(page);
  await expect(page.locator('#skin-name')).toHaveText('Original coupe');
  const original = await page.locator('#skin-preview').screenshot();
  await page.locator('#skin-switch').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#skin-name')).toHaveText('Peugeot 206 CC');
  await expect(page.locator('#rival-dialogue')).not.toBeVisible();
  expect(original.equals(await page.locator('#skin-preview').screenshot())).toBe(false);
  expect((await context.cookies()).find((cookie) => cookie.name === 'togai_skin').value).toBe(
    'peugeot-206-cc',
  );
  await ready(page);
  await expect(page.locator('#skin-name')).toHaveText('Peugeot 206 CC');
  for (const viewport of [
    { width: 1440, height: 950 },
    { width: 800, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('#skin-switch')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#start')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: test.info().outputPath(`skins-${viewport.width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.locator('#start').click();
  await expect(page.locator('#rival-dialogue')).toBeVisible();
  await expect.poll(() => redBodyPixels(page)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#skin-name')).toHaveText('Peugeot 206 CC');
  await page.locator('#course-switch').click();
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#start').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-panel')).toBeVisible();
  await expect.poll(() => redBodyPixels(page)).toBeGreaterThan(0);
  await expect(page.locator('.map-legend i').first()).toHaveCSS(
    'background-color',
    'rgb(217, 45, 56)',
  );
  await expect
    .poll(() =>
      page.locator('#minimap').evaluate((canvas) => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] === 217 && pixels[i + 1] === 45 && pixels[i + 2] === 56) return true;
        return false;
      }),
    )
    .toBe(true);
  await page.screenshot({ path: test.info().outputPath('peugeot-race.png') });
  await page.keyboard.press('r');
  await expect(page.locator('#countdown')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => redBodyPixels(page)).toBeGreaterThan(0);
  await ready(page);
  await page.locator('#skin-switch').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#skin-name')).toHaveText('Original coupe');
  await page.locator('#start').click();
  await expect(page.locator('#rival-dialogue')).toBeVisible();
  expect(await redBodyPixels(page)).toBe(0);
  expect(errors).toEqual([]);
});

test('malformed skin cookie falls back and blocked storage keeps the selected skin playable', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: 'togai_skin', value: '%invalid<img>', url: 'http://127.0.0.1:5187' },
  ]);
  await ready(page);
  await expect(page.locator('#skin-name')).toHaveText('Original coupe');
  await expect(page.locator('#skin-switch img')).toHaveCount(0);
  await page.addInitScript(() =>
    Object.defineProperty(document, 'cookie', {
      get() {
        throw new Error('blocked');
      },
      set() {
        throw new Error('blocked');
      },
    }),
  );
  await ready(page);
  await page.locator('#skin-switch').click();
  await expect(page.locator('#skin-name')).toHaveText('Peugeot 206 CC');
  await expect(page.locator('#skin-storage')).toBeVisible();
  await page.locator('#start').click();
  await expect(page.locator('#rival-dialogue')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#skin-name')).toHaveText('Peugeot 206 CC');
  await ready(page);
  await expect(page.locator('#skin-name')).toHaveText('Original coupe');
});

test.describe('touch skin selector', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 390, height: 390 },
  ]) {
    test(`skin choice stays reachable at ${viewport.width} by ${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await ready(page);
      await page.locator('#skin-switch').tap();
      await expect(page.locator('#skin-name')).toHaveText('Peugeot 206 CC');
      await expect(page.locator('#skin-switch')).toBeInViewport({ ratio: 1 });
      expect(
        await page
          .locator('#intro')
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      await page.screenshot({ path: test.info().outputPath('skins-touch.png') });
      await page.locator('#start').tap();
      await expect(page.locator('#rival-dialogue')).toBeVisible();
    });
  }
});
