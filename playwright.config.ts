import { defineConfig, devices } from '@playwright/test'

// Tests de bout en bout sur le build de production (`vite preview`) : `npm run test:e2e`.
// Sous Windows, on utilise le Google Chrome déjà installé (`channel: 'chrome'`) : pas de navigateur à
// télécharger. Ailleurs (Linux, CI) : `npx playwright install chromium`.

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        ...(process.platform === 'win32' ? { channel: 'chrome' } : {}),
      },
    },
  ],
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
