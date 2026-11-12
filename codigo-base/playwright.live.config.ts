import { defineConfig, devices } from '@playwright/test'
import { localSupabase } from './tests/live/local-supabase'

const backend = localSupabase()
export default defineConfig({
  testDir: './tests/live',
  testMatch: '**/*.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  forbidOnly: true,
  reporter: [['list']],
  outputDir: 'test-results/live',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4175',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // Credenciais de ensaio transitam pelo login: sem captura de rede/trace.
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4175',
    url: 'http://127.0.0.1:4175',
    env: { VITE_SUPABASE_URL: backend.url, VITE_SUPABASE_ANON_KEY: backend.anonKey },
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
