import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({
  ...base,
  testMatch: '**/app.spec.js',
  grep: /trackpad reversals/,
  projects: [
    { name: 'desktop-chrome-map', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'desktop-safari-map', use: { ...devices['Desktop Safari'], viewport: { width: 1366, height: 900 } } }
  ]
});
