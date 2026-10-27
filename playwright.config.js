import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['unit/**'],
  // CI runners (2 vCPU) are far slower than the local M1 with the hi-res scans.
  timeout: 300_000,
  retries: 0,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4374', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4374 --strictPort',
    url: 'http://127.0.0.1:4374',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  outputDir: 'tmp/test-results',
});
