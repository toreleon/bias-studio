import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://localhost:8081",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH,
      args: process.env.CI ? ["--no-sandbox"] : [],
    },
  },
  webServer: {
    command: "npx expo start --web --port 8081",
    url: "http://localhost:8081",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
