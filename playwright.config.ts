import { defineConfig } from '@playwright/test'

// Browser checks with the API mocked (no OpenAI credit used). Run: npm run e2e
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5173', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
})
