import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// Trong môi trường có sẵn Chromium (CI/cloud) thì dùng luôn, không tải thêm.
// `/opt/pw-browsers/chromium` là symlink ổn định của môi trường cloud; đường cũ giữ làm dự phòng.
const local = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const executablePath = process.env.PW_CHROMIUM || local;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
