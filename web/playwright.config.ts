import { defineConfig, devices } from '@playwright/test'

const webUrl = 'http://127.0.0.1:5190'
const apiUrl = 'http://127.0.0.1:3014'
const databaseUrl = process.env.E2E_DATABASE_URL || 'postgresql:///hafa_code_e2e'
const userHome = process.env.HOME
const toolchainPath = [
  userHome && `${userHome}/.nodenv/shims`,
  userHome && `${userHome}/.rbenv/shims`,
  process.env.PATH,
].filter(Boolean).join(':')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      name: 'Rails E2E API',
      command: 'bundle exec rails db:prepare e2e:reset && bundle exec rails server --binding 127.0.0.1 --port 3014',
      cwd: '../api',
      env: {
        ...process.env,
        RAILS_ENV: 'test',
        DATABASE_URL: databaseUrl,
        FRONTEND_URL: webUrl,
        PATH: toolchainPath,
      },
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      name: 'Vite E2E web',
      command: 'npm run dev -- --mode e2e --host 127.0.0.1 --port 5190 --strictPort',
      env: {
        ...process.env,
        VITE_API_URL: apiUrl,
        VITE_E2E_AUTH: 'true',
        PATH: toolchainPath,
      },
      url: webUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
  ],
})
