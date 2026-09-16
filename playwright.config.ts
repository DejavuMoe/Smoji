import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad (gen 7)'],
        // The iPad descriptor defaults to WebKit; tablet layout coverage must run on an engine
        // that actually launches locally and in CI. WebKit stays covered by its own project.
        browserName: 'chromium',
        viewport: { width: 834, height: 1194 },
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 393, height: 852 },
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 14'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    // Always rebuild: testing a stale dist is how a regression can pass unnoticed.
    command: 'pnpm build:workbench && pnpm exec vite preview --config apps/workbench/vite.config.ts --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: false,
    timeout: 240_000,
  },
})
