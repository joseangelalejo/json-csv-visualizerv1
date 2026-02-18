import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30 * 1000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'node scripts/create-test-sqlite.js && npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
})
