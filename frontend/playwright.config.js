import { defineConfig } from "@playwright/test";

// Attachment / file-send browser regression checks.
// Run with the backend + frontend dev servers up:
//   $env:VYNTRA_TEST_JWT="<jwt cookie>"; $env:VYNTRA_BASE="http://localhost:5174"
//   npx playwright test --config=playwright.config.js
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["line"]],
  use: {
    baseURL: process.env.VYNTRA_BASE || "http://localhost:5174",
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
});
