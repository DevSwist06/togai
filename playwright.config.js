import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5187',
    viewport: { width: 1440, height: 950 },
    headless: true,
    channel:
      process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'darwin' ? 'chrome' : undefined),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args:
        process.platform === 'darwin'
          ? ['--enable-unsafe-webgpu']
          : ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-features=Vulkan'],
    },
  },
  webServer: {
    command: 'node src/server/start.js',
    env: { PORT: '5187' },
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
  },
});
