import { expect, test } from "@playwright/test";

const navButton = (page, name) => page.locator(".bottom-nav").getByRole("button", { name, exact: true });
const finishMemberSetup = async (page, ufid = "00000000") => {
  await expect(page.getByRole("heading", { name: "Enter your UFID" })).toBeVisible();
  await page.getByLabel("Eight-digit UFID").fill(ufid);
  await page.getByRole("button", { name: "Finish Account Setup" }).click();
};
const eventsCsv = `"Event Name","Event Date","Start Time","Location","Room","Event Description","Published","Event ID","Source URL"
"IonQ Quantum Networking Speaker Session","2026-03-03","3:30 PM","Reitz Student Union","2340","Daniel Pompa of IonQ presented on current industry progress in quantum networking; Palm & Pine catering was provided.","Yes","fqc-2026-03-03-ionq","https://www.linkedin.com/company/florida-quantum-computing-society"
"GBM 2","2026-03-10","6:00 PM","Malachowsky Hall","1142","A community meeting to connect students interested in quantum computing, share semester progress, and explain ways to get involved. Pizza was served.","Yes","fqc-2026-03-10-gbm-2","https://www.linkedin.com/company/florida-quantum-computing-society"
"Workshop 3: Quirk Circuit Simulator","2026-03-24","6:00 PM","Larsen Hall","234","A hands-on introduction to Quirk, an interactive quantum circuit simulator. Pizza was provided.","Yes","fqc-2026-03-24-quirk","https://www.linkedin.com/company/florida-quantum-computing-society"
"Workshop 4: Quantum Bomb Testing","2026-03-31","6:00 PM","Malachowsky Hall","1142","A workshop exploring the Quantum Bomb Testing algorithm. Sandwiches were provided.","Yes","fqc-2026-03-31-bomb-testing","https://www.linkedin.com/company/florida-quantum-computing-society"
"Speaker Session: Dr. Laura Kim","2026-04-07","5:30 PM","Malachowsky Hall","G168","FQC speaker session featuring UF Assistant Professor Dr. Laura Kim. Food began at 5:30 PM and the presentation began at 6:00 PM.","Yes","fqc-2026-04-07-laura-kim","https://www.linkedin.com/company/florida-quantum-computing-society"
"GBM 3: Quantum Technology Today","2026-04-14","6:00 PM","Larsen Hall","234","A general body meeting on the present-day impact of quantum technology. Piesanos was provided.","Yes","fqc-2026-04-14-gbm-3","https://www.linkedin.com/company/florida-quantum-computing-society"
"End of Year Social","2026-04-21","6:00 PM","Malachowsky Hall","G186","A semester-closing social for the FQC community, open to all majors. Huey Magoo's was served.","Yes","fqc-2026-04-21-social","https://www.linkedin.com/company/florida-quantum-computing-society"`;
const locationsCsv = `"Location","Address","Lat","Long","Historical Event Count","Priority Rank","Source URL"
"Malachowsky Hall","1889 Museum Road, Gainesville, FL 32611","29.644482","-82.34805","4","1","https://campusmap.ufl.edu/#/index/1024"
"Larsen Hall","968 Center Drive, Gainesville, FL 32611","29.64311","-82.34738","2","2","https://campusmap.ufl.edu/#/index/0722"
"Reitz Student Union","655 Reitz Union Drive, Gainesville, FL 32611","29.64631","-82.34788","1","3","https://campusmap.ufl.edu/#/index/0686"
"Marston Science Library","444 Newell Drive, Gainesville, FL 32611","29.64794","-82.34394","0","4","https://campusmap.ufl.edu/#/index/0043"
"Newell Hall","1700 Stadium Road, Gainesville, FL 32611","29.64909","-82.34508","0","5","https://campusmap.ufl.edu/#/index/0013"
"Pugh Hall","296 Buckman Drive, Gainesville, FL 32611","29.64941","-82.34553","0","6","https://campusmap.ufl.edu/#/index/0072"
"Turlington Hall","330 Newell Drive, Gainesville, FL 32611","29.64921","-82.34407","0","7","https://campusmap.ufl.edu/#/index/0267"
"Little Hall","1400 Stadium Road, Gainesville, FL 32611","29.64885","-82.34073","0","8","https://campusmap.ufl.edu/#/index/0655"
"Weil Hall","1949 Stadium Road, Gainesville, FL 32611","29.64835","-82.34843","0","9","https://campusmap.ufl.edu/#/index/0024"
"Smathers Library","1508 Union Road, Gainesville, FL 32611","29.65092","-82.34181","0","10","https://campusmap.ufl.edu/#/index/0005"`;
const logisticsEventsCsv = `"Date","Time","Type","Location","Backup Room","Attendance","GatorConnect","SGF Request","Permit (y/n)","Permit Number"
"7/9/2026","6:00:00 PM","Intro Event","Reitz G325","","40","","Pending registration","Confirmed (Reitz G325)","058982-GP"
"8/27/2026","6:00:00 PM","GBM 1 - LinuxCL Workshop","Reitz G320","","70","","","Pending (Reitz G320)","059100-GP"
"9/3/2026","5:30:00 PM","GBM 2 - Siddharth Speaker","Reitz 2350 (Capacity: 16)","Larsen 234","","","","Confirmed (Reitz 2350)","059118-GP"
"9/17/2026","6:00:00 PM","GBM 3 - CUDAQ Workshop","Campus"
"10/1/2026","5:30:00 PM","GBM 4 - Industry Speaker"`;
const logisticsLocationsCsv = `${locationsCsv}
"University of Florida","Gainesville, FL 32611","29.643632","-82.35493","0","11","https://campusmap.ufl.edu/"`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__FQC_AUTH_TEST__ = true;
  });
  await page.route("https://*.tile.openstreetmap.org/**", async (route) => {
    const transparentPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await route.fulfill({ status: 200, contentType: "image/png", body: transparentPixel });
  });
  await page.route("https://docs.google.com/spreadsheets/**", async (route) => {
    const sheetName = new URL(route.request().url()).searchParams.get("sheet");
    await route.fulfill({
      status: 200,
      contentType: "text/csv; charset=utf-8",
      body: sheetName === "UF Locations" ? locationsCsv : eventsCsv
    });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("renders the unified event explorer and simplified navigation", async ({ page }) => {
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /user-scalable=no/);
  await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await expect(page.locator("#event-intro").getByRole("heading", { name: "IonQ Quantum Networking Speaker Session", level: 2 })).toBeVisible();
  await expect(page.getByRole("region", { name: "FQC events and locations" })).toBeVisible();
  await expect(page.locator("#event-map")).toBeVisible();
  await expect(page.locator(".event-map-pin")).toHaveCount(7);
  await expect(page.getByText("Google Sheet connected")).toBeVisible();
  await expect(page.locator(".event-map-campus")).toHaveCount(0);

  const navLabels = ["Home", "Check In", "Profile"];
  for (const label of navLabels) await expect(navButton(page, label)).toBeVisible();
  await expect(navButton(page, "Calendar")).toHaveCount(0);
  await expect(navButton(page, "Map")).toHaveCount(0);
});

test("loads the 2026 logistics workbook schema and maps abbreviated UF rooms", async ({ page }) => {
  await page.unroute("https://docs.google.com/spreadsheets/**");
  await page.route("https://docs.google.com/spreadsheets/**", async (route) => {
    const sheetName = new URL(route.request().url()).searchParams.get("sheet");
    await route.fulfill({
      status: 200,
      contentType: "text/csv; charset=utf-8",
      body: sheetName === "UF Locations" ? logisticsLocationsCsv : logisticsEventsCsv
    });
  });
  await page.evaluate(() => {
    localStorage.removeItem("fqc:event-data");
    localStorage.setItem("fqc:calendar-month", "2026-03");
  });
  await page.reload();

  await expect(page.locator("#event-intro")).toContainText("Intro Event");
  await expect(page.locator("#event-intro")).toContainText("Reitz Student Union");
  await expect(page.locator("#event-intro")).toContainText("Room G325");
  await expect(page.locator(".event-map-pin")).toHaveCount(5);

  await page.getByRole("tab", { name: "Calendar", exact: true }).click();
  await expect(page.locator(".calendar-heading")).toContainText("July 2026");
});

test("rejects cached locations outside the UF Gainesville campus", async ({ page }) => {
  await page.unroute("https://docs.google.com/spreadsheets/**");
  await page.route("https://docs.google.com/spreadsheets/**", (route) => route.abort());
  await page.evaluate(() => {
    localStorage.setItem("fqc:event-data", JSON.stringify({
      updatedAt: new Date().toISOString(),
      events: [{
        id: "ucf-event",
        date: "2026-03-03",
        title: "Wrong campus event",
        time: "6:00 PM",
        locationId: "ucf-student-union",
        room: "Room 101",
        description: "This must never appear."
      }],
      locations: {
        "ucf-student-union": {
          id: "ucf-student-union",
          name: "UCF Student Union",
          address: "Orlando, Florida",
          lat: 28.6024,
          lng: -81.2001
        }
      }
    }));
  });

  await page.reload();
  await expect(page.getByText("Wrong campus event")).toHaveCount(0);
  await expect(page.getByText("UCF Student Union")).toHaveCount(0);
  await expect(page.locator("#event-intro")).toContainText("Reitz Student Union");
  await expect(page.locator(".event-map-campus")).toHaveCount(0);
});

test("rejects an unsafe saved schedule and replaces it with live Sheet data", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("fqc:event-data", JSON.stringify({
      events: [{
        id: '\"><img src=x onerror=alert(1)>',
        date: "2026-03-03",
        title: "Unsafe event",
        time: "3:30 PM",
        locationId: "malachowsky-hall",
        room: "1142",
        description: "Should never render"
      }],
      locations: {
        "malachowsky-hall": {
          id: "malachowsky-hall",
          name: "Malachowsky Hall",
          address: "1889 Museum Road",
          lat: 29.6440385,
          lng: -82.3477921
        }
      }
    }));
  });

  await page.reload();
  await expect(page.getByText("Unsafe event")).toHaveCount(0);
  await expect(page.getByText("Google Sheet connected")).toBeVisible();
  await expect(page.locator(".event-map-pin")).toHaveCount(7);
});

test("keeps fixed navigation clear of event details in a short desktop window", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "compact-desktop", "Compact desktop regression check");

  await page.locator('.event-list [data-select-event="fqc-2026-03-24-quirk"]').click();
  const layout = await page.evaluate(() => {
    const nav = document.querySelector(".bottom-nav").getBoundingClientRect();
    const details = document.querySelector(".event-detail-card").getBoundingClientRect();
    const header = document.querySelector(".topbar").getBoundingClientRect();
    const explorer = document.querySelector(".event-explorer").getBoundingClientRect();
    const overlaps = !(
      nav.right <= details.left ||
      nav.left >= details.right ||
      nav.bottom <= details.top ||
      nav.top >= details.bottom
    );
    return {
      overlaps,
      pageScroll: window.scrollY,
      headerBottom: Math.round(header.bottom),
      explorerTop: Math.round(explorer.top)
    };
  });

  expect(layout.overlaps).toBe(false);
  expect(layout.pageScroll).toBe(0);
  expect(layout.headerBottom).toBeLessThanOrEqual(layout.explorerTop);
});

test("selecting a list event synchronizes the detail card and map marker", async ({ page }, testInfo) => {
  await page.locator('.event-list [data-select-event="fqc-2026-03-24-quirk"]').click();

  await expect(page.locator('[data-event-card="fqc-2026-03-24-quirk"]')).toHaveClass(/selected/);
  await expect(page.locator("#event-intro").getByRole("heading", { name: "Workshop 3: Quirk Circuit Simulator" })).toBeVisible();
  await expect(page.locator("#event-intro")).toContainText("Tuesday, March 24 · 6:00 PM");
  await expect(page.locator("#event-intro")).toContainText("Larsen Hall · Room 234");
  if (testInfo.project.name !== "mobile") {
    await expect(page.locator("#event-details").getByRole("heading", { name: "Workshop 3: Quirk Circuit Simulator" })).toBeVisible();
    await expect(page.locator("#event-details").getByText("Larsen Hall")).toBeVisible();
  }
  await expect(page.locator(".event-map-pin.active")).toHaveText("24");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fqc:selected-event"))).toBe("fqc-2026-03-24-quirk");

  await page.locator('.event-map-pin[data-event-id="fqc-2026-04-21-social"]').click();
  await expect(page.locator("#event-intro").getByRole("heading", { name: "End of Year Social" })).toBeVisible();
  if (testInfo.project.name !== "mobile") {
    await expect(page.locator("#event-details").getByRole("heading", { name: "End of Year Social" })).toBeVisible();
  }
  await expect(page.locator('[data-event-card="fqc-2026-04-21-social"]')).toHaveClass(/selected/);
});

test("mobile event sheet expands, collapses, and reveals pin selections with swipe shortcuts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile bottom-sheet interaction");

  const planner = page.locator("#event-planner");
  const handle = page.locator("#event-sheet-handle");
  const intro = page.locator("#event-intro");
  await expect(handle).toBeVisible();
  await expect(planner).toHaveAttribute("data-sheet-mode", "medium");
  await expect(page.locator("body")).toHaveCSS("position", "fixed");
  expect(await page.evaluate(() => {
    window.scrollTo(0, 120);
    return window.scrollY;
  })).toBe(0);

  const initialTop = await planner.evaluate((element) => element.getBoundingClientRect().top);
  await planner.dispatchEvent("wheel", { deltaY: 160 });
  await expect(planner).toHaveAttribute("data-sheet-mode", "high");
  await page.waitForTimeout(350);
  const expandedTop = await planner.evaluate((element) => element.getBoundingClientRect().top);
  expect(expandedTop).toBeLessThan(initialTop - 80);

  const visibleEvent = page.locator(".event-card-select").first();
  await planner.evaluate((element) => { element.scrollTop = 90; });
  await visibleEvent.dispatchEvent("pointerdown", { button: 0, pointerId: 7, pointerType: "touch", clientY: 300 });
  await visibleEvent.dispatchEvent("pointermove", { button: 0, pointerId: 7, pointerType: "touch", clientY: 500 });
  await visibleEvent.dispatchEvent("pointerup", { button: 0, pointerId: 7, pointerType: "touch", clientY: 500 });
  await expect(planner).toHaveAttribute("data-sheet-mode", "medium");
  await expect.poll(() => planner.evaluate((element) => element.scrollTop)).toBe(0);

  const headerTop = await page.locator(".topbar").evaluate((element) => Math.round(element.getBoundingClientRect().top));
  await visibleEvent.dispatchEvent("pointerdown", { button: 0, pointerId: 8, pointerType: "touch", clientY: 730 });
  await visibleEvent.dispatchEvent("pointermove", { button: 0, pointerId: 8, pointerType: "touch", clientY: 500 });
  await visibleEvent.dispatchEvent("pointerup", { button: 0, pointerId: 8, pointerType: "touch", clientY: 500 });
  await expect(planner).toHaveAttribute("data-sheet-mode", "high");
  await expect.poll(() => page.locator(".topbar").evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(headerTop);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await planner.evaluate((element) => { element.scrollTop = 0; });
  await visibleEvent.dispatchEvent("pointerdown", { button: 0, pointerId: 9, pointerType: "touch", clientY: 650 });
  await page.waitForTimeout(24);
  await visibleEvent.dispatchEvent("pointermove", { button: 0, pointerId: 9, pointerType: "touch", clientY: 500 });
  await visibleEvent.dispatchEvent("pointerup", { button: 0, pointerId: 9, pointerType: "touch", clientY: 500 });
  const scrollAtRelease = await planner.evaluate((element) => element.scrollTop);
  await page.waitForTimeout(100);
  const scrollAfterCoast = await planner.evaluate((element) => element.scrollTop);
  expect(scrollAfterCoast).toBeGreaterThan(scrollAtRelease + 5);

  await visibleEvent.dispatchEvent("pointerdown", { button: 0, pointerId: 10, pointerType: "touch", clientY: 300 });
  await visibleEvent.dispatchEvent("pointerup", { button: 0, pointerId: 10, pointerType: "touch", clientY: 300 });
  await planner.evaluate((element) => { element.scrollTop = 0; });
  await visibleEvent.dispatchEvent("pointerdown", { button: 0, pointerId: 11, pointerType: "touch", clientY: 160 });
  await visibleEvent.dispatchEvent("pointermove", { button: 0, pointerId: 11, pointerType: "touch", clientY: 760 });
  await visibleEvent.dispatchEvent("pointerup", { button: 0, pointerId: 11, pointerType: "touch", clientY: 760 });
  await expect(planner).toHaveAttribute("data-sheet-mode", "low");
  await page.locator('.event-map-pin[data-event-id="fqc-2026-04-21-social"]').click();
  await expect(planner).toHaveAttribute("data-sheet-mode", "medium");
  await expect(intro.getByRole("heading", { name: "End of Year Social" })).toBeVisible();

  await page.locator("#event-map").click({ position: { x: 190, y: 180 } });
  await expect(planner).toHaveAttribute("data-sheet-mode", "closed");
  await expect(planner).toHaveCSS("height", "0px");
  await page.locator('.event-map-pin[data-event-id="fqc-2026-04-14-gbm-3"]').click();
  await expect(planner).toHaveAttribute("data-sheet-mode", "medium");
  await expect(intro.getByRole("heading", { name: "GBM 3: Quantum Technology Today" })).toBeVisible();
});

test("calendar tab selects an event and preserves it across reloads", async ({ page }, testInfo) => {
  await page.getByRole("tab", { name: "Calendar" }).click();
  await expect(page.getByRole("tab", { name: "Calendar" })).toHaveAttribute("aria-selected", "true");

  await expect(page.locator(".calendar-day")).toHaveCount(42);
  await expect(page.locator(".calendar-day.outside").first()).toBeVisible();
  await expect(page.locator(".calendar-day-label")).toHaveCount(4);
  await expect(page.locator(".calendar-agenda-event")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Previous month" })).toBeDisabled();
  if (testInfo.project.name === "mobile") {
    await expect(page.locator("#event-planner")).toHaveAttribute("data-sheet-mode", "high");
    await page.getByRole("tab", { name: "List" }).click();
    await expect(page.getByRole("tab", { name: "List" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#event-planner")).toHaveAttribute("data-sheet-mode", "high");
    await page.getByRole("tab", { name: "Calendar" }).click();
    await expect(page.locator("#event-planner")).toHaveAttribute("data-sheet-mode", "high");
  }

  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByText("April 2026")).toBeVisible();
  await expect(page.locator(".calendar-agenda-event")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();
  await page.locator('.calendar-day[data-select-event="fqc-2026-04-21-social"]').click();
  await expect(page.locator("#event-intro").getByRole("heading", { name: "End of Year Social" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("tab", { name: "Calendar" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("April 2026")).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await expect(page.locator("#event-intro").getByRole("heading", { name: "End of Year Social" })).toBeVisible();
  } else {
    await expect(page.locator("#event-details").getByRole("heading", { name: "End of Year Social" })).toBeVisible();
  }
});

test("saves an RSVP from the unified home", async ({ page }) => {
  const speakerCard = page.locator('[data-event-card="fqc-2026-03-03-ionq"]');
  await speakerCard.locator("[data-rsvp]").click();
  await expect(speakerCard.locator("[data-rsvp]")).toHaveText("Going");
  await expect(page.locator("#event-details [data-rsvp]")).toHaveText("Going");

  await page.reload();
  await expect(page.locator('[data-event-card="fqc-2026-03-03-ionq"] [data-rsvp]')).toHaveText("Going");
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

test("settings hides device reset under Advanced and shows version history", async ({ page }) => {
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByRole("heading", { name: "Version History" })).toBeVisible();
  await expect(page.getByText("v2.0.1 · Current")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuke & Reload" })).toHaveCount(0);
  await page.getByText("Advanced settings", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Nuke & Reload" })).toBeVisible();
});

test("an officer login exposes officer controls in Profile", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({ uid: "officer-1", displayName: "Morgan", email: "morgan@ufl.edu", role: "officer" }));

  await expect(page.getByRole("heading", { name: "Officer Command Center" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Officer Recommendations" })).toBeVisible();
  await expect(page.locator(".profile-role-line").getByText("Officer", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Officer metrics").getByText("$1,840")).toBeVisible();

  await page.getByLabel("Area").selectOption("Permits");
  await page.getByLabel("Note").fill("Confirm room permit owner");
  await page.getByRole("button", { name: "Add Note" }).click();
  await expect(page.getByText("Confirm room permit owner")).toBeVisible();

  await page.getByLabel("Active event").selectOption("fqc-2026-04-14-gbm-3");
  await page.getByRole("button", { name: "Update Active Event" }).click();
  await navButton(page, "Check In").click();
  await expect(page.getByRole("heading", { name: "GBM 3: Quantum Technology Today" })).toBeVisible();
});

test("member login enables event check-in and shows a member profile", async ({ page }) => {
  await navButton(page, "Check In").click();
  await expect(page.getByRole("heading", { name: "Sign in to check in" })).toBeVisible();
  await page.getByRole("button", { name: "Open Profile Login" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await finishMemberSetup(page);
  await expect(page.getByText("Member", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Officer Command Center" })).toHaveCount(0);

  await navButton(page, "Check In").click();
  await page.getByRole("button", { name: "Check In Now" }).click();
  await expect(page.getByRole("button", { name: "Checked In" })).toBeDisabled();
  await expect(page.getByText("Attendance recorded for Google Member.")).toBeVisible();

  await navButton(page, "Profile").click();
  await page.getByLabel("Display name").fill("Alex Q");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { name: "Alex Q", level: 2 })).toBeVisible();
  await expect(page.locator("#profile-initial")).toHaveText("A");
});

test("login and account creation are separate and creation includes UFID", async ({ page }) => {
  await navButton(page, "Profile").click();
  await expect(page.getByRole("tab", { name: "Log In" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByText(/officer code/i)).toHaveCount(0);

  await page.getByRole("tab", { name: "Create Account" }).click();
  await expect(page.getByRole("tab", { name: "Create Account" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByLabel("UFID", { exact: true })).toBeVisible();
  await page.getByLabel("Name").fill("New Gator");
  await page.getByLabel("Email").fill("new.gator@ufl.edu");
  await page.getByLabel("Password").fill("quantum-safe-password");
  await page.getByLabel("UFID", { exact: true }).fill("00000000");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "New Gator" })).toBeVisible();
  await expect(page.getByText("Member", { exact: true })).toBeVisible();
});

test("forgot password requires an email then sends a reset", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByText("Enter your email first, then choose Forgot password.")).toBeVisible();
  await page.getByLabel("Email").fill("member@ufl.edu");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByText("Password reset email sent to member@ufl.edu.")).toBeVisible();
});

test("a current officer can recommend a member but cannot directly change roles", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "officer-1", displayName: "Morgan", email: "morgan@ufl.edu", role: "officer", officerTitle: "Secretary" },
      { uid: "member-1", displayName: "Jordan", email: "jordan@ufl.edu", role: "member" }
    ]);
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "officer-1", displayName: "Morgan", email: "morgan@ufl.edu", role: "officer", officerTitle: "Secretary" });
  });

  await expect(page.getByRole("heading", { name: "Officer Recommendations" })).toBeVisible();
  const row = page.locator('[data-member-id="member-1"]');
  await expect(row.locator("select")).toHaveCount(0);
  await row.getByRole("button", { name: "Recommend officer" }).click();
  await expect(row.getByRole("button", { name: "Recommended" })).toBeDisabled();
});

test("the Treasurer can add and remove ordinary officers while leadership stays protected", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "president-1", displayName: "Alex", email: "alex@ufl.edu", role: "officer", leadership: "president", officerTitle: "President" },
      { uid: "vp-1", displayName: "Taylor", email: "taylor@ufl.edu", role: "officer", leadership: "vice_president", officerTitle: "Vice President" },
      { uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true },
      { uid: "member-1", displayName: "Jordan", email: "jordan@ufl.edu", role: "member" }
    ]);
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true });
  });

  await expect(page.getByRole("heading", { name: "Officer Management" })).toBeVisible();
  const president = page.locator('[data-member-id="president-1"]');
  await expect(president.locator("select")).toBeDisabled();
  await expect(president.getByRole("button", { name: "Save role" })).toBeDisabled();
  const vicePresident = page.locator('[data-member-id="vp-1"]');
  await expect(vicePresident.locator("select")).toBeDisabled();
  await expect(vicePresident.getByRole("button", { name: "Save role" })).toBeDisabled();
  const row = page.locator('[data-member-id="member-1"]');
  await row.locator("select").selectOption("officer");
  await row.getByRole("button", { name: "Save role" }).click();
  await expect(row.locator("select")).toHaveValue("officer");
});

test("a matching UFID assigns the spreadsheet officer title during account creation", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.setUfidDirectory({
    "12345678": { officerTitle: "President" }
  }));
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await finishMemberSetup(page, "12345678");
  await expect(page.getByText("President", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Officer Management" })).toBeVisible();
});

test("a signed-in member can add a device passkey", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await finishMemberSetup(page);
  await expect(page.getByText("0 passkeys")).toBeVisible();
  await page.getByRole("button", { name: "Set Up Face ID / Touch ID" }).click();
  await expect(page.getByText("1 passkey", { exact: true })).toBeVisible();
  await expect(page.getByText(/Passkey added/)).toBeVisible();
});

test("nukes local app data and reloads a fresh events home", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await finishMemberSetup(page);
  await expect(page.getByRole("heading", { name: "Google Member", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByText("Advanced settings", { exact: true }).click();
  const reload = page.waitForEvent("framenavigated");
  await page.getByRole("button", { name: "Nuke & Reload" }).click();
  await reload;

  await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await expect(page.locator("#profile-initial")).toHaveText("F");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fqc:name"))).toBeNull();
});
