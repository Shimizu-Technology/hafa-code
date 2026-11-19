import { defineConfig, devices } from '@playwright/test'

// Override when another session already owns the defaults, e.g. E2E_WEB_PORT=4522 E2E_API_PORT=4523.
const webPort = process.env.E2E_WEB_PORT || '5190'
const apiPort = process.env.E2E_API_PORT || '3014'
// A production build with a fake Clerk key, for the deferred sign-in tests (stubbed Clerk, real Rails).
const clerkWebPort = process.env.E2E_CLERK_WEB_PORT || '5192'
const rustWebPort = process.env.E2E_RUST_WEB_PORT || '5193'
const webUrl = `http://127.0.0.1:${webPort}`
const clerkWebUrl = `http://127.0.0.1:${clerkWebPort}`
const apiUrl = `http://127.0.0.1:${apiPort}`
const databaseUrl = process.env.E2E_DATABASE_URL || 'postgresql:///hafa_code_e2e'
const userHome = process.env.HOME
const toolchainPath = [
  userHome && `${userHome}/.nodenv/shims`,
  userHome && `${userHome}/.rbenv/shims`,
  process.env.PATH,
].filter(Boolean).join(':')

const browserName = process.env.E2E_BROWSER === 'webkit' ? 'webkit' : 'chromium'
const desktop = browserName === 'webkit' ? devices['Desktop Safari'] : { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chromium' }

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
      name: browserName,
      testIgnore: browserName === 'webkit' ? /(?:deferred-sign-in|rust-lab)\.spec\.ts/ : /deferred-sign-in\.spec\.ts/,
      use: { ...desktop },
    },
    {
      name: `${browserName}-clerk-build`,
      testMatch: /deferred-sign-in\.spec\.ts/,
      use: { ...desktop, baseURL: clerkWebUrl },
    },
    ...(browserName === 'webkit' ? [{
      name: 'webkit-rust-build',
      testMatch: /rust-lab\.spec\.ts/,
      use: { ...desktop, baseURL: `http://127.0.0.1:${rustWebPort}` },
    }] : []),
  ],
  webServer: [
    ...(browserName === 'webkit' ? [{
      name: 'Rust Lab production build',
      command: `vite build --mode e2e --outDir dist-rust-e2e && vite build --config vite.lab.config.ts --mode e2e --outDir dist-rust-e2e && node scripts/serve-e2e-build.mjs dist-rust-e2e ${rustWebPort}`,
      env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_E2E_AUTH: 'true', VITE_API_URL: apiUrl, PATH: toolchainPath },
      url: `http://127.0.0.1:${rustWebPort}/labs/rust/`,
      reuseExistingServer: false,
      timeout: 180_000,
      gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 5_000 },
    }] : []),
    {
      name: 'Rails E2E API',
      command: `bundle exec rails db:prepare e2e:reset && bundle exec rails server --binding 127.0.0.1 --port ${apiPort}`,
      cwd: '../api',
      env: {
        ...process.env,
        RAILS_ENV: 'test',
        DATABASE_URL: databaseUrl,
        FRONTEND_URL: webUrl,
        ALLOWED_ORIGINS: clerkWebUrl,
        PATH: toolchainPath,
      },
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      name: 'Vite E2E web',
      command: `npm run dev -- --mode e2e --host 127.0.0.1 --port ${webPort} --strictPort`,
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
    {
      name: 'Vite build with deferred Clerk',
      command: `vite build --mode clerk-e2e --outDir dist-clerk-e2e && vite preview --mode clerk-e2e --outDir dist-clerk-e2e --host 127.0.0.1 --port ${clerkWebPort} --strictPort`,
      env: {
        ...process.env,
        VITE_API_URL: apiUrl,
        // Not a real instance: the spec serves a stub Clerk script for this host.
        VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_aGFmYS1lMmUuY2xlcmsuYWNjb3VudHMuZGV2JA',
        VITE_E2E_AUTH: 'false',
        PATH: `${process.cwd()}/node_modules/.bin:${toolchainPath}`,
      },
      url: clerkWebUrl,
      reuseExistingServer: false,
      timeout: 180_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
  ],
})
