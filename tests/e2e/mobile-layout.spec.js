import { test, expect } from '@playwright/test';

async function exposeCamera(page) {
  // Observe the real camera and lifecycle without changing driving or rendering.
  await page.route('**/game.js', async (route) => {
    const response = await route.fetch();
    const source = (await response.text()).replace(
      'race = new Race(wasm, s);',
      `race = new Race(wasm, s);
      window.__layoutCamera = () => ({ zoom: camera.zoom, phase: race.phase });`,
    );
    await route.fulfill({ response, body: source });
  });
}

test.describe('mobile framing and speedometer', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  for (const course of ['kasumi', 'beaufort'])
    for (const mode of ['screen', 'joystick']) {
      test(`${course} keeps the ${mode} speedometer at the bottom through phone rotation`, async ({
        page,
      }) => {
        await exposeCamera(page);
        await page.goto('/');
        await expect(page.locator('#start')).toBeEnabled();
        await page.locator('#mode-clock').click();
        await page.locator(`#mode-${mode}`).click();
        if (course === 'beaufort') {
          await page.locator('#course-next').click();
          await expect(page.locator('#start')).toBeEnabled();
        }
        await page.locator('#start').click();
        await expect
          .poll(() => page.evaluate(() => window.__layoutCamera().zoom))
          .toBeCloseTo(71.3, 1);
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => window.__layoutCamera().zoom)).toBeCloseTo(71.3, 1);
        await page.locator('#pause').click();
        await expect(page.locator('#pause-panel')).toBeVisible();
        await page.locator('#pause-panel').evaluate((panel) => {
          panel.hidden = true;
        });
        for (const viewport of [
          { width: 390, height: 844 },
          { width: 320, height: 740 },
          { width: 844, height: 390 },
          { width: 820, height: 1180 },
        ]) {
          await page.setViewportSize(viewport);
          const layout = await page.evaluate(() => {
            // Measure three digits in the same frame, before the HUD can refresh.
            document.querySelector('#speed').textContent = '288';
            const bounds = (selector) =>
              document.querySelector(selector).getBoundingClientRect().toJSON();
            return {
              counter: bounds('.speed'),
              digits: bounds('#speed'),
              unit: bounds('.speed span'),
              footer: bounds('footer'),
              joystick: bounds('#joystick'),
              height: innerHeight,
              width: innerWidth,
            };
          });
          expect(layout.height - layout.counter.bottom).toBeCloseTo(44, 0);
          expect(layout.counter.bottom).toBeLessThan(layout.footer.top);
          expect(layout.digits.left).toBeGreaterThanOrEqual(16);
          expect(layout.digits.right).toBeLessThan(layout.width);
          expect(layout.unit.bottom).toBeLessThanOrEqual(layout.counter.bottom);
          if (mode === 'joystick') {
            await expect(page.locator('#joystick')).toBeInViewport();
            expect(Math.max(layout.counter.right, layout.digits.right)).toBeLessThan(
              layout.joystick.left,
            );
          } else await expect(page.locator('#joystick')).toBeHidden();
          await expect(page.locator('#pause')).toBeInViewport();
          await expect(page.locator('#error')).toBeHidden();
          await page.screenshot({
            path: test.info().outputPath(`${course}-${mode}-${viewport.width}.png`),
          });
        }
      });
    }
});

test('mouse layouts retain their camera scale and speedometer position at desktop and compact widths', async ({
  page,
}) => {
  await exposeCamera(page);
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#mode-clock').click();
  await page.locator('#start').click();
  await expect.poll(() => page.evaluate(() => window.__layoutCamera().zoom)).toBeCloseTo(62, 1);
  await page.locator('#pause').click();
  await expect(page.locator('#pause-panel')).toBeVisible();
  await page.locator('#pause-panel').evaluate((panel) => {
    panel.hidden = true;
  });
  for (const viewport of [
    { width: 1440, height: 950, bottom: 100 },
    { width: 800, height: 600, bottom: 105 },
    { width: 390, height: 844, bottom: 105 },
  ]) {
    await page.setViewportSize(viewport);
    const bottom = await page
      .locator('.speed')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).bottom));
    expect(bottom).toBe(viewport.bottom);
    expect(await page.evaluate(() => window.__layoutCamera().zoom)).toBeCloseTo(62, 1);
    await page.screenshot({ path: test.info().outputPath(`mouse-layout-${viewport.width}.png`) });
  }
});
