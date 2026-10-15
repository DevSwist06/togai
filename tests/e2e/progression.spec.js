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
        'race.tick(readInput(keys, mobileInput));',
        `race.tick(readInput(keys, mobileInput));
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

test('best time stays on one line and course arrows fit at desktop and compact widths', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    {
      name: 'togai_progress',
      value: encodeURIComponent(
        JSON.stringify({ version: 1, introSeen: false, best: { kasumi: 49150 } }),
      ),
      url: baseURL,
    },
  ]);
  await ready(page);
  await expect(page.locator('.brief table')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'YOUR LEADERBOARD' })).toBeVisible();
  await expect(page.locator('#best-time > span')).toHaveCSS('color', 'rgb(248, 132, 86)');
  await expect(page.locator('#best-time > span')).toHaveCSS('font-size', '10px');
  await expect(page.locator('#best-time > span')).toHaveCSS('font-family', 'monospace');
  for (const mode of ['takeover', 'clock']) {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.locator(`#mode-${mode}`).click();
    await expect(page.locator('#progress-note')).toHaveText(
      'Personal records · saved on this browser.',
    );
    for (const [width, height] of [
      [1440, 950],
      [800, 600],
      [700, 600],
      [390, 844],
      [390, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await expect(page.locator('#progress-note')).toBeVisible();
      const layout = await page.locator('#best-time').evaluate((line) => {
        const title = line.querySelector('h3').getBoundingClientRect();
        const label = line.querySelector('span').getBoundingClientRect();
        const value = line.querySelector('strong');
        const score = value.getBoundingClientRect();
        const note = line.querySelector('p').getBoundingClientRect();
        const arrows = document.querySelector('.course-navigation').getBoundingClientRect();
        const card = line.parentElement.getBoundingClientRect();
        return {
          titleAboveScore: title.bottom <= Math.min(label.top, score.top),
          sameLine: label.bottom > score.top && score.bottom > label.top,
          scoreFits: score.right <= line.getBoundingClientRect().right,
          scoreReadable: !/^\d/.test(value.textContent) || value.scrollWidth <= value.clientWidth,
          arrowsFit: arrows.left >= card.left && arrows.right <= card.right,
          noteBelowScore: note.top >= Math.max(label.bottom, score.bottom),
          noteFits:
            note.left >= card.left && note.right <= card.right && note.bottom <= card.bottom,
        };
      });
      expect(layout, `${mode} at ${width}x${height}`).toEqual({
        titleAboveScore: true,
        sameLine: true,
        scoreFits: true,
        scoreReadable: true,
        arrowsFit: true,
        noteBelowScore: true,
        noteFits: true,
      });
    }
  }
});

test('home best time follows the selected course, persists wins, ignores losses, and skips Ren on return', async ({
  page,
}) => {
  await controlledFinish(page);
  await ready(page);
  await expect(page.locator('#best-time')).toBeVisible();
  await expect(page.locator('#best-time-score')).toHaveText('No winning run yet');
  expect(
    await page.locator('.brief-bottom').evaluate((element) => element.nextElementSibling.id),
  ).toBe('best-time');
  await page.evaluate(() => {
    window.__winningTime = 25;
  });
  await briefing(page);
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#best-time')).toBeHidden();
  await page.locator('#back').click();
  await expect(page.locator('#best-time-score')).toHaveText('00:25.000');
  await page.locator('#course-next').click();
  await expect(page.locator('#best-time-score')).toHaveText('No winning run yet');
  await page.locator('#course-previous').click();
  await expect(page.locator('#best-time-score')).toHaveText('00:25.000');
  for (const time of [30, null, 20]) {
    await page.evaluate((time) => {
      window.__winningTime = time;
    }, time);
    await page.locator('#start').click();
    await expect(page.locator('#rival-dialogue')).not.toBeVisible();
    await expect(page.locator('#results')).toBeVisible();
    await page.locator('#back').click();
    await expect(page.locator('#best-time-score')).toHaveText(
      time === 20 ? '00:20.000' : '00:25.000',
    );
  }
  await ready(page);
  await expect(page.locator('#best-time-score')).toHaveText('00:20.000');
  await page.screenshot({ path: test.info().outputPath('best-time-desktop.png') });
  await page.setViewportSize({ width: 800, height: 600 });
  await expect(page.locator('#best-time')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: test.info().outputPath('best-time-compact.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#best-time')).toBeInViewport();
  await expect(page.locator('#start')).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath('best-time-phone.png') });
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
  await expect(page.locator('#progress-note')).toBeVisible();
  await expect(page.locator('#progress-note')).not.toContainText('saved on this browser');
  await expect(page.locator('#best-time-score')).toHaveText('00:20.000');
  await page.locator('#start').click();
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#rival-dialogue')).not.toBeVisible();
});

test('malformed cookie cannot inject best-time markup or suppress the first briefing', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: 'togai_progress', value: '%invalid<img>', url: baseURL }]);
  await ready(page);
  await expect(page.locator('#best-time')).toContainText('BEST TIMENo winning run yet');
  await expect(page.locator('#best-time table')).toHaveCount(0);
  await expect(page.locator('#best-time img')).toHaveCount(0);
  await briefing(page);
});

test.describe('phone menu best time', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  test('landscape phone keeps personal records beside the start button', async ({ page }) => {
    await ready(page);
    await expect(page.locator('#best-time')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#start')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: test.info().outputPath('best-time-landscape.png') });
  });
});

test.describe('compact landscape phone best time', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 390 } });
  test('weather, records and start control remain visible together', async ({ page }) => {
    await ready(page);
    await expect(page.locator('#course-weather')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#best-time')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#start')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: test.info().outputPath('best-time-compact-landscape.png') });
  });
});
