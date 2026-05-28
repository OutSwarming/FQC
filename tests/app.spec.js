import { expect, test } from "@playwright/test";

const navButton = (page, name) => page.locator(".bottom-nav").getByRole("button", { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("renders the home app shell with bottom navigation", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  await expect(page.getByAltText("Florida Quantum Computing logo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Florida Quantum Computing", level: 2 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();

  const navLabels = ["Home", "Calendar", "Map", "Officers", "Profile"];
  for (const label of navLabels) {
    await expect(navButton(page, label)).toBeVisible();
  }
});

test("navigates through member calendar and saves an RSVP", async ({ page }) => {
  await navButton(page, "Calendar").click({ force: true });
  await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();

  await page.getByRole("button", { name: /^RSVP$/ }).first().click();
  await expect(page.getByRole("button", { name: "Going" }).first()).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Calendar" }).click();
  await expect(page.getByRole("button", { name: "Going" }).first()).toBeVisible();
});

test("shows locations and food planning details", async ({ page }) => {
  await navButton(page, "Map").click({ force: true });
  await expect(page.getByRole("heading", { name: "Locations and Food" })).toBeVisible();
  await expect(page.getByText("Innovation Lab 204")).toBeVisible();
  await expect(page.getByText("Pizza, boxed lunches, or snack trays", { exact: false })).toBeVisible();
});

test("unlocks officer portal and adds a note", async ({ page }) => {
  await navButton(page, "Officers").click({ force: true });
  await page.getByLabel("Officer code").fill("officer");
  await page.getByRole("button", { name: "Unlock Portal" }).click();

  await expect(page.getByRole("heading", { name: "Officer Command Center" })).toBeVisible();
  await expect(page.getByLabel("Officer metrics").getByText("$1,840")).toBeVisible();

  await page.getByLabel("Area").selectOption("Permits");
  await page.getByLabel("Note").fill("Confirm room permit owner");
  await page.getByRole("button", { name: "Add Note" }).click();
  await expect(page.getByText("Confirm room permit owner")).toBeVisible();
});

test("updates the member profile name", async ({ page }) => {
  await navButton(page, "Profile").click({ force: true });
  await page.getByLabel("Display name").fill("Alex");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { name: "Alex", level: 2 })).toBeVisible();
  await expect(page.locator("#profile-initial")).toHaveText("A");
});
