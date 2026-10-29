import { defineConfig } from '@playwright/test';
const origin = `https://localhost:${process.env.E2E_HTTPS_PORT || '3443'}`;
export default defineConfig({
  testDir: './tests/e2e', testMatch: '**/*.spec.ts', workers: 1, timeout: 60000,
  expect: { timeout: 15000 },
  use: { baseURL: origin, viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce', ignoreHTTPSErrors: true, headless: true, channel: process.env.E2E_BROWSER_CHANNEL || undefined, screenshot: 'only-on-failure' },
  webServer: { command: 'node tests/e2e/start-stack.cjs', url: `${origin}/login`, ignoreHTTPSErrors: true, reuseExistingServer: false, timeout: 90000, gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 } },
});
