import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// Trong môi trường có sẵn Chromium (CI/cloud) thì dùng luôn, không tải thêm.
const local = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const executablePath = process.env.PW_CHROMIUM || local;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5198',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: [
    {
      command: 'npm --prefix ../.. run start -w @lhdk/server',
      port: 2567,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm --prefix ../.. run dev -w @lhdk/campus',
      url: 'http://localhost:5198',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
