import { defineConfig } from '@playwright/test';
import { webgpuLaunchArgs } from './scripts/webgpu-launch-options.mjs';

const port = Number(process.env.TOGAI_TEST_PORT ?? 5187);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('TOGAI_TEST_PORT must be an integer from 1 to 65535');
const baseURL = `http://127.0.0.1:${port}`;

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
    baseURL,
    viewport: { width: 1440, height: 950 },
    headless: true,
    channel:
      process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'darwin' ? 'chrome' : undefined),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: webgpuLaunchArgs(process.platform),
    },
  },
  webServer: {
    command: 'node src/server/start.js',
    env: { PORT: String(port) },
    url: baseURL,
    reuseExistingServer: false,
  },
});
