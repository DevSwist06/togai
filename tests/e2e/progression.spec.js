import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
}
async function briefing(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#start').click();
  await expect(page.locator('#rival-dialogue')).toBeVisible();
  await page.locator('#dialogue-next').click();
  await page.locator('#dialogue-next').click();
  await expect(page.locator('#rival-dialogue')).not.toBeVisible();
}
async function controlledFinish(page) {
  // Exercise persistence/UI at exact result boundaries without adding a production test API.
  await page.route('**/game.js', async (route) => {
    const response = await route.fetch();
    const source = (await response.text())
      .replace(
        'race.tick(readInput(keys, headingAlignedInput(joystickState, joystickHeading)));',
        `race.tick(readInput(keys, headingAlignedInput(joystickState, joystickHeading)));
      if (race.phase === 'race') {
        race.overtakeTime = window.__winningTime ?? null;
        race.crashReason = window.__winningTime ? null : 'roadside';
        race.phase = 'finished';
      }`,
      )
      .replace('accumulator += dt;', 'accumulator += 1;');
    await route.fulfill({ response, body: source });
  });
}

test('main menu leaderboard persists best wins, ignores losses, and skips Ren on return', async ({
  page,
}) => {
  await controlledFinish(page);
  await ready(page);
  await expect(page.locator('#leaderboard')).toBeVisible();
  await expect(page.locator('#leaderboard-rows')).toContainText('No winning run yet');
  expect(
    await page.locator('.brief-bottom').evaluate((element) => element.nextElementSibling.id),
  ).toBe('leaderboard');
  await page.evaluate(() => {
    window.__winningTime = 25;
  });
  await briefing(page);
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#leaderboard')).toBeHidden();
  await page.locator('#back').click();
  await expect(page.locator('#leaderboard-rows')).toContainText('00:25.000');
  for (const time of [30, null, 20]) {
    await page.evaluate((time) => {
      window.__winningTime = time;
    }, time);
    await page.locator('#start').click();
    await expect(page.locator('#rival-dialogue')).not.toBeVisible();
    await expect(page.locator('#results')).toBeVisible();
    await page.locator('#back').click();
    await expect(page.locator('#leaderboard-rows')).toContainText(
      time === 20 ? '00:20.000' : '00:25.000',
    );
  }
  await ready(page);
  await expect(page.locator('#leaderboard-rows')).toContainText('00:20.000');
  await page.screenshot({ path: test.info().outputPath('leaderboard-desktop.png') });
  await page.setViewportSize({ width: 800, height: 600 });
  await expect(page.locator('#leaderboard')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: test.info().outputPath('leaderboard-compact.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#leaderboard')).toBeInViewport();
  await expect(page.locator('#start')).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath('leaderboard-phone.png') });
  await page.keyboard.press('Enter');
  await expect(page.locator('#rival-dialogue')).not.toBeVisible();
  await expect(page.locator('#results')).toBeVisible();
});

test('blocked cookies keep intro and best scores for this visit and report unsaved progress', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(document, 'cookie', {
      get() {
        throw new Error('Cookies blocked');
      },
      set() {
        throw new Error('Cookies blocked');
      },
    }),
  );
  await controlledFinish(page);
  await ready(page);
  await page.evaluate(() => {
    window.__winningTime = 20;
  });
  await briefing(page);
  await expect(page.locator('#results')).toBeVisible();
  await page.locator('#back').click();
  await expect(page.locator('#progress-note')).toContainText('Cookies unavailable');
  await expect(page.locator('#leaderboard-rows')).toContainText('00:20.000');
  await page.locator('#start').click();
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#rival-dialogue')).not.toBeVisible();
});

test('malformed cookie cannot inject leaderboard markup or suppress the first briefing', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: 'togai_progress', value: '%invalid<img>', url: 'http://127.0.0.1:5187' },
  ]);
  await ready(page);
  await expect(page.locator('#leaderboard-rows')).toContainText('KASUMI PASSNo winning run yet');
  await expect(page.locator('#leaderboard-rows tr')).toHaveCount(2);
  await expect(page.locator('#leaderboard img')).toHaveCount(0);
  await briefing(page);
});

test.describe('phone menu leaderboard', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  test('landscape phone keeps personal records beside the start button', async ({ page }) => {
    await ready(page);
    await expect(page.locator('#leaderboard')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#start')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: test.info().outputPath('leaderboard-landscape.png') });
  });
});

test.describe('compact landscape phone leaderboard', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 390 } });
  test('weather, records and start control remain visible together', async ({ page }) => {
    await ready(page);
    await expect(page.locator('#course-weather')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#leaderboard')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#start')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: test.info().outputPath('leaderboard-compact-landscape.png') });
  });
});
