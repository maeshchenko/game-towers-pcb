import { defineConfig, devices } from '@playwright/test'

// Smoke-only e2e: boots the PRODUCTION bundle (vite preview of dist/) and checks the game reaches
// an interactive state without console errors. Not a gameplay suite — that's the deterministic
// vitest sim coverage. Run: npm run build && npm run e2e.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
  // Serve the built bundle exactly as it ships. reuseExistingServer speeds local runs.
  webServer: {
    command: 'npm run build && npx vite preview --port 4173',
    url: 'http://localhost:4173',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
})
