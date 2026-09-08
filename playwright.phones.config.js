import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:4183" },
  webServer: { ...base.webServer, command: "npx vite --host 127.0.0.1 --port 4183", url: "http://127.0.0.1:4183" },
  testMatch: '**/phone-ui.spec.js', testIgnore: [],
  projects: [
    { name: 'iphone-se', use: { ...devices['iPhone SE'], browserName: 'webkit' } },
    { name: 'iphone-13', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'iphone-large', use: { ...devices['iPhone 15 Pro Max'], browserName: 'webkit' } },
    { name: 'iphone-landscape', use: { ...devices['iPhone 13 landscape'], browserName: 'webkit' } },
    { name: 'android-pixel', use: { ...devices['Pixel 7'], browserName: 'chromium' } }
  ]
});
