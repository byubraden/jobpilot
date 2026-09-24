import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const databaseDirectory = mkdtempSync(join(tmpdir(), "jobpilot-e2e-"));
const baseURL = "http://127.0.0.1:3109";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: { ...devices["Desktop Chrome"], baseURL, trace: "on-first-retry" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3109",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      AI_PROVIDER: "mock",
      DATABASE_PATH: join(databaseDirectory, "jobpilot.sqlite"),
    },
  },
});
