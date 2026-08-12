import { expect, test } from "@playwright/test";

const navButton = (page, name) => page.locator(".bottom-nav").getByRole("button", { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.route("https://*.tile.openstreetmap.org/**", async (route) => {
    const transparentPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await route.fulfill({ status: 200, contentType: "image/png", body: transparentPixel });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("renders the unified event explorer and simplified navigation", async ({ page }) => {
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /user-scalable=no/);
  await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What’s happening", level: 2 })).toBeVisible();
  await expect(page.getByRole("region", { name: "FQC events and locations" })).toBeVisible();
  await expect(page.locator("#event-map")).toBeVisible();
  await expect(page.locator(".event-map-pin")).toHaveCount(4);

  const navLabels = ["Home", "Officers", "Profile"];
  for (const label of navLabels) await expect(navButton(page, label)).toBeVisible();
  await expect(navButton(page, "Calendar")).toHaveCount(0);
  await expect(navButton(page, "Map")).toHaveCount(0);
});

test("selecting a list event synchronizes the detail card and map marker", async ({ page }) => {
  await page.locator('.event-list [data-select-event="workshop"]').click();

  await expect(page.locator('[data-event-card="workshop"]')).toHaveClass(/selected/);
  await expect(page.locator("#event-details").getByRole("heading", { name: "Beginner Circuit Workshop" })).toBeVisible();
  await expect(page.locator("#event-details").getByText("Library Makerspace")).toBeVisible();
  await expect(page.locator(".event-map-pin.active")).toHaveText("5");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fqc:selected-event"))).toBe("workshop");

  await page.locator('.event-map-pin[data-event-id="social"]').click();
  await expect(page.locator("#event-details").getByRole("heading", { name: "Quantum Games Social" })).toBeVisible();
  await expect(page.locator('[data-event-card="social"]')).toHaveClass(/selected/);
});

test("calendar tab selects an event and preserves it across reloads", async ({ page }) => {
  await page.getByRole("tab", { name: "Calendar" }).click();
  await expect(page.getByRole("tab", { name: "Calendar" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByText("September 2026")).toBeVisible();
  await page.locator('.calendar-day[data-select-event="social"]').click();
  await expect(page.locator("#event-details").getByRole("heading", { name: "Quantum Games Social" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("tab", { name: "Calendar" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("September 2026")).toBeVisible();
  await expect(page.locator("#event-details").getByRole("heading", { name: "Quantum Games Social" })).toBeVisible();
});

test("saves an RSVP from the unified home", async ({ page }) => {
  const kickoffCard = page.locator('[data-event-card="kickoff"]');
  await kickoffCard.locator("[data-rsvp]").click();
  await expect(kickoffCard.locator("[data-rsvp]")).toHaveText("Going");
  await expect(page.locator("#event-details [data-rsvp]")).toHaveText("Going");

  await page.reload();
  await expect(page.locator('[data-event-card="kickoff"] [data-rsvp]')).toHaveText("Going");
});

test("switches between light and dark themes and remembers the choice", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Use light theme" })).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Use light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("unlocks officer portal and adds a note", async ({ page }) => {
  await navButton(page, "Officers").click();
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
  await navButton(page, "Profile").click();
  await page.getByLabel("Display name").fill("Alex");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { name: "Alex", level: 2 })).toBeVisible();
  await expect(page.locator("#profile-initial")).toHaveText("A");
});

test("nukes local app data and reloads a fresh events home", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.getByLabel("Display name").fill("Alex");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Alex", level: 2 })).toBeVisible();

  const reload = page.waitForEvent("framenavigated");
  await page.getByRole("button", { name: "Nuke and Reload" }).click();
  await reload;

  await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await expect(page.locator("#profile-initial")).toHaveText("F");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fqc:name"))).toBeNull();
});
