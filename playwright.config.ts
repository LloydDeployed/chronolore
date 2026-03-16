import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @chronolore/server dev",
      url: "http://localhost:4001/api/health",
      reuseExistingServer: !process.env.CI,
      cwd: ".",
      env: {
        DATABASE_URL: "postgresql://chronolore:chronolore@127.0.0.1:5436/chronolore",
        JWT_SECRET: "chronolore-dev-secret-change-in-production",
        PORT: "4001",
      },
    },
    {
      command: "pnpm --filter @chronolore/web dev",
      url: "http://localhost:4000",
      reuseExistingServer: !process.env.CI,
      cwd: ".",
    },
  ],
});
