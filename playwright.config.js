import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  },
  projects: [
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 }
      }
    },
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 900, height: 900 }
      }
    },
    {
      name: "compact-desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1366, height: 552 }
      }
    }
  ]
});
