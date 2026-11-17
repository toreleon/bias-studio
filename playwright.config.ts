import { defineConfig } from "@playwright/test";
const port = Number(process.env.E2E_PORT || 8081);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("E2E_PORT must be a valid TCP port.");
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { open: "never" }],
        ["junit", { outputFile: "test-results/e2e.xml" }],
      ]
    : "list",
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH,
      args: process.env.CI ? ["--no-sandbox"] : [],
    },
  },
  webServer: {
    command: `npx expo start --web --port ${port}`,
    env: { EXPO_PUBLIC_BETA_URL: "http://localhost:8787", EXPO_PUBLIC_GENERATION_URL: "http://localhost:8787" },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
