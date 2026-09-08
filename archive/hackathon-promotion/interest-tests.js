// Archived UI tests; restore to tests/app.spec.js when the interest form returns.
test("existing members can RSVP, withdraw, and keep interest separate between accounts", async ({ page }) => {
  const signIn = uid => page.evaluate(uid => window.__FQC_AUTH_TEST_API__.signInAs({ uid, email: `${uid}@ufl.edu`, displayName: uid, role: "member" }), uid);
  await navButton(page, "About").click();
  await signIn("interested-member");
  await page.locator("[data-hackathon-rsvp]").first().click();
  await expect(page.getByText("Your interest is saved to your FQC account.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => window.__FQC_AUTH_TEST_API__.getHackathonInterest("interested-member"))).toBe(true);
  await navButton(page, "Events").click();
  await navButton(page, "About").click();
  await expect(page.locator("[data-hackathon-rsvp]").first()).toBeDisabled();
  await signIn("other-member");
  await expect(page.locator("[data-hackathon-rsvp]").first()).toBeEnabled();
  await signIn("interested-member");
  await page.getByRole("button", { name: "Remove my interest" }).click();
  await expect(page.locator("[data-hackathon-rsvp]").first()).toBeEnabled();
  expect(await page.evaluate(() => window.__FQC_AUTH_TEST_API__.getHackathonInterest("interested-member"))).toBe(false);
});

test("hackathon RSVP resumes after existing-account login", async ({ page }) => {
  await navButton(page, "Hackathon").click();
  await page.locator("[data-hackathon-rsvp]").first().click();
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(navButton(page, "Hackathon")).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-hackathon-rsvp]").first()).toContainText("Interest registered");
});

test("hackathon RSVP creates an account and saves interest automatically", async ({ page }) => {
  await navButton(page, "Hackathon").click();
  await page.locator("[data-hackathon-rsvp]").first().click();
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await page.getByLabel("UF email", { exact: true }).fill("hackathon.gator@ufl.edu");
  await page.locator("#signup-password").fill("quantum-safe-password");
  await page.locator("#signup-password-confirm").fill("quantum-safe-password");
  await page.getByRole("dialog", { name: "Create your FQC account" }).getByRole("button", { name: "Create account", exact: true }).click();
  await expect(navButton(page, "Hackathon")).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-hackathon-rsvp]").first()).toContainText("Interest registered");
});

test("failed hackathon RSVP shows retry and never falsely confirms", async ({ page }) => {
  await navButton(page, "Hackathon").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "retry-member", email: "retry@ufl.edu", role: "member" });
    window.__FQC_AUTH_TEST_API__.setInterestFailure(true);
  });
  await page.locator("[data-hackathon-rsvp]").first().click();
  await expect(page.locator(".hack-interest-error")).toContainText("wasn’t saved");
  await expect(page.locator("[data-hackathon-rsvp]").first()).toBeEnabled();
  expect(await page.evaluate(() => window.__FQC_AUTH_TEST_API__.getHackathonInterest("retry-member"))).toBe(false);
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.setInterestFailure(false));
  await page.locator("[data-hackathon-rsvp]").first().click();
  await expect(page.locator("[data-hackathon-rsvp]").first()).toContainText("Interest registered");
});

