import { test, expect } from '@playwright/test';

for (const course of ['kasumi', 'beaufort'])
  for (const viewport of [
    { width: 1440, height: 950 },
    { width: 800, height: 600 },
    { width: 390, height: 844 },
  ]) {
    test(`${course} start and finish roads stay clear through the screen edge at ${viewport.width}px`, async ({
      page,
    }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      // Expose endpoint views only in the test response; scenery and WebGPU stay real.
      await page.route('**/game.js', async (route) => {
        const response = await route.fetch();
        const source = (await response.text()).replace(
          'race = new Race(wasm, s);',
          `race = new Race(wasm, s);
          window.__roadEndpoint = (endpoint) => {
            const start = endpoint === 'start';
            const p = atDistance(start ? 0 : length - 14);
            wasm.reset(p.x, p.y, p.a);
            camera = start ? {x:p.x,y:p.y+32,zoom:75} :
              {x:p.x+Math.sin(p.a)*42,y:p.y-Math.cos(p.a)*42,zoom:78};
            race.phase = 'paused';
            document.body.classList.add('playing');
            for (const id of ['intro','hud','countdown','pause-panel','results']) $(id).hidden = true;
            document.querySelector('header').hidden = true;
            return {camera:{...camera}, point:{...(start ? track[0] : track.at(-1))}, direction:start ? -1 : 1};
          };`,
        );
        await route.fulfill({ response, body: source });
      });
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('#start')).toBeEnabled();
      if (course === 'beaufort') {
        await page.locator('#course-next').click();
        await expect(page.locator('#course-name')).toHaveText('BEAUFORT MOUNTAIN');
        await expect(page.locator('#start')).toBeEnabled();
      }
      for (const endpoint of ['start', 'finish']) {
        const view = await page.evaluate((endpoint) => window.__roadEndpoint(endpoint), endpoint);
        await expect(page.locator('.grain')).toHaveCSS('opacity', '0');
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const screenshot = await page.locator('#game').screenshot({
          path: test.info().outputPath(`${course}-${endpoint}-${viewport.width}.png`),
        });
        const samples = await page.evaluate(
          async ({ base64, view, snow }) => {
            const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
            const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            const scale = image.height / (view.camera.zoom * 2),
              asphalt = snow ? [86, 102, 116] : [65, 73, 69];
            let checked = 0,
              clear = 0,
              farthest = 0;
            for (let distance = 15; distance < 220; distance += 3)
              for (const offset of [-5, 5]) {
                const x =
                    view.point.x +
                    Math.sin(view.point.a) * distance * view.direction +
                    Math.cos(view.point.a) * offset,
                  y =
                    view.point.y -
                    Math.cos(view.point.a) * distance * view.direction +
                    Math.sin(view.point.a) * offset,
                  px = Math.round(image.width / 2 + (x - view.camera.x) * scale),
                  py = Math.round(image.height / 2 + (y - view.camera.y) * scale);
                if (px < 4 || py < 4 || px >= image.width - 4 || py >= image.height - 4) continue;
                checked++;
                farthest = Math.max(farthest, distance);
                const pixel = ctx.getImageData(px, py, 1, 1).data;
                if (asphalt.every((value, i) => Math.abs(value - pixel[i]) <= 1)) clear++;
              }
            image.close();
            return { checked, clear, farthest };
          },
          { base64: screenshot.toString('base64'), view, snow: course === 'beaufort' },
        );
        expect(samples.farthest).toBeGreaterThan(90);
        expect(samples.checked).toBeGreaterThan(40);
        expect(samples.clear).toBe(samples.checked);
      }
      await expect(page.locator('#error')).toBeHidden();
      expect(errors).toEqual([]);
    });
  }
