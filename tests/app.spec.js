import { expect, test } from "@playwright/test";

const navButton = (page, name) => page.locator(".bottom-nav").getByRole("button", { name, exact: true });
const createThreeStepAccount = async (page, { email = "new.gator@ufl.edu", username = "newgator", method = "passkey" } = {}) => {
  await page.getByRole("tab", { name: "Create Account" }).click();
  await page.getByLabel("UF email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Next: choose a username" }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByRole("button", { name: "Check username" }).click();
  if (method === "password") {
    await page.getByRole("radio", { name: /Private password/ }).check();
    await page.locator("#signup-password").fill("quantum-safe-password");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Create with passkey" }).click();
  }
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
const budgetCsv = `"Event ID","Event","Date","Item","Quantity","Unit","Unit Cost","Planned Cost","Actual Cost","Funding Source","Status","Notes","Budget Summary","Amount"
"fqc-2026-03-03-ionq","IonQ Quantum Networking Speaker Session","3/3/2026","Speaker catering","1","order","80","80","","Operational Funding","Estimate","Planning estimate","Base Funding","1050"
"","","","","","","","","","","","","Operational Funding","2490"
"","","","","","","","","","","","","Total Approved","3540"
"","","","","","","","","","","","","Planned Spend","80"
"","","","","","","","","","","","","Actual Spend","0"
"","","","","","","","","","","","","Available After Actual","3540"
"","","","","","","","","","","","","Uncommitted After Plan","3460"`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__FQC_AUTH_TEST__ = true;
    const NativeDate = Date;
    const fixedNow = new NativeDate("2026-03-01T12:00:00-05:00").getTime();
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedNow]));
      }
      static now() { return fixedNow; }
    }
    window.Date = FixedDate;
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
      body: sheetName === "UF Locations" ? locationsCsv : sheetName === "Treasurer Breakdown" ? budgetCsv : eventsCsv
    });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("renders the unified event explorer and simplified navigation", async ({ page }) => {
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /user-scalable=no/);
  await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await expect(page.getByRole("img", { name: "Florida Quantum Computing logo" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Florida Quantum Computing logo" })).toHaveAttribute("src", /fqc-app-icon-192\.png/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /fqc-app-icon-192\.png/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /fqc-app-icon-180\.png/);

  // Installed-app behaviour: standalone hides the address bar and browser buttons.
  const manifest = await page.evaluate(() => fetch(document.querySelector('link[rel="manifest"]').href).then((response) => response.json()));
  expect(manifest.display).toBe("standalone");
  expect(manifest.scope).toBe("/");
  expect(manifest.start_url).toBe("/");
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(["192x192", "512x512", "1024x1024", "512x512"]);
  expect(manifest.icons.every((icon) => icon.src.includes("fqc-app-icon"))).toBe(true);
  expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute("content", "yes");

  // Every declared icon must actually resolve.
  const iconStatuses = await page.evaluate((sources) => Promise.all(
    sources.map((src) => fetch(src).then((response) => response.status))
  ), ["/assets/fqc-app-icon-180.png", ...(manifest.icons.map((icon) => icon.src))]);
  expect(iconStatuses.every((status) => status === 200)).toBe(true);
  await expect(page.locator("#event-intro").getByRole("heading", { name: "IonQ Quantum Networking Speaker Session", level: 2 })).toBeVisible();
  await expect(page.getByRole("region", { name: "FQC events and locations" })).toBeVisible();
  await expect(page.locator("#event-map")).toBeVisible();
  // One pin per location, labelled with how many events happen there.
  await expect(page.locator(".event-map-pin")).toHaveCount(3);
  await expect(page.locator('.event-map-pin[data-location-id="malachowsky-hall"]')).toHaveText("4");
  await expect(page.locator('.event-map-pin[data-location-id="larsen-hall"]')).toHaveText("2");
  await expect(page.locator('.event-map-pin[data-location-id="reitz-student-union"]')).toHaveText("1");
  await expect(page.getByRole("tab", { name: /Past 0/ })).toBeVisible();
  await expect(page.getByText("Google Sheet connected")).toBeVisible();
  await expect(page.locator(".event-map-campus")).toHaveCount(0);

  const navLabels = ["Home", "Check In", "Profile"];
  for (const label of navLabels) await expect(navButton(page, label)).toBeVisible();
  await expect(navButton(page, "Calendar")).toHaveCount(0);
  await expect(navButton(page, "Map")).toHaveCount(0);
});

test("moves events into Past 24 hours after their scheduled start", async ({ page }) => {
  const archiveEventsCsv = `"Event Name","Event Date","Start Time","Location","Room","Event Description","Published","Event ID"
"Archived Workshop","2026-02-27","6:00 PM","Larsen Hall","234","This event is more than 24 hours old.","Yes","fqc-2026-02-27-archived"
"Grace Period GBM","2026-02-28","6:00 PM","Reitz Student Union","2340","This event remains current until 24 hours pass.","Yes","fqc-2026-02-28-grace"
"Upcoming Workshop","2026-03-03","6:00 PM","Malachowsky Hall","1142","Future event.","Yes","fqc-2026-03-03-upcoming"`;
  await page.unroute("https://docs.google.com/spreadsheets/**");
  await page.route("https://docs.google.com/spreadsheets/**", async (route) => {
    const sheetName = new URL(route.request().url()).searchParams.get("sheet");
    await route.fulfill({
      status: 200,
      contentType: "text/csv; charset=utf-8",
      body: sheetName === "UF Locations" ? locationsCsv : sheetName === "Treasurer Breakdown" ? budgetCsv : archiveEventsCsv
    });
  });
  await page.evaluate(() => {
    localStorage.removeItem("fqc:event-data");
    localStorage.setItem("fqc:event-mode", "list");
    localStorage.setItem("fqc:selected-event", "fqc-2026-03-03-upcoming");
  });
  await page.reload();

  await expect(page.locator('[data-event-panel="list"] .event-card')).toHaveCount(2);
  await expect(page.locator('[data-event-card="fqc-2026-02-27-archived"]')).toBeHidden();
  await page.getByRole("tab", { name: /Past 1/ }).click();
  await expect(page.locator('[data-event-panel="past"] .event-card')).toHaveCount(1);
  await expect(page.locator('[data-event-card="fqc-2026-02-27-archived"]')).toBeVisible();
  await expect(page.locator('[data-event-card="fqc-2026-02-28-grace"]')).toBeHidden();
  await page.locator('[data-event-card="fqc-2026-02-27-archived"] [data-select-event]').click();
  await expect(page.locator("#event-details").getByText("Past event", { exact: true })).toHaveCount(1);
  await expect(page.locator("#event-details").getByRole("button", { name: "RSVP" })).toHaveCount(0);
});

test("loads the 2026 logistics workbook schema and maps abbreviated UF rooms", async ({ page }) => {
  await page.unroute("https://docs.google.com/spreadsheets/**");
  await page.route("https://docs.google.com/spreadsheets/**", async (route) => {
    const sheetName = new URL(route.request().url()).searchParams.get("sheet");
    await route.fulfill({
      status: 200,
      contentType: "text/csv; charset=utf-8",
      body: sheetName === "UF Locations" ? logisticsLocationsCsv : sheetName === "Treasurer Breakdown" ? budgetCsv : logisticsEventsCsv
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
  await expect(page.locator('.event-map-pin[data-location-id="reitz-student-union"]')).toHaveText("3");

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
  await expect(page.locator(".event-map-pin")).toHaveCount(3);
});

test("event tabs stay pinned to the top while the list scrolls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Mobile uses the drag sheet, covered separately");
  const tabs = page.locator(".event-tabs-sticky");
  const planner = page.locator(".event-planner");
  await expect(tabs).toHaveCSS("position", "sticky");

  const plannerTop = await planner.evaluate((element) => element.getBoundingClientRect().top);
  await planner.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.waitForTimeout(150);

  // The fixture must actually overflow or this proves nothing.
  expect(await planner.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);

  const tabsTop = await tabs.evaluate((element) => element.getBoundingClientRect().top);
  expect(tabsTop).toBeGreaterThanOrEqual(plannerTop - 2);
  expect(tabsTop).toBeLessThan(plannerTop + 60);
  await expect(page.getByRole("tab", { name: /Past/ })).toBeInViewport();
});

test("the map only pins events for the tab in view", async ({ page }) => {
  const archiveEventsCsv = `"Event Name","Event Date","Start Time","Location","Room","Event Description","Published","Event ID"
"Archived Workshop","2026-02-27","6:00 PM","Larsen Hall","234","More than 24 hours old.","Yes","fqc-2026-02-27-archived"
"Upcoming Workshop","2026-03-03","6:00 PM","Malachowsky Hall","1142","Future event.","Yes","fqc-2026-03-03-upcoming"`;
  await page.unroute("https://docs.google.com/spreadsheets/**");
  await page.route("https://docs.google.com/spreadsheets/**", async (route) => {
    const sheetName = new URL(route.request().url()).searchParams.get("sheet");
    await route.fulfill({
      status: 200,
      contentType: "text/csv; charset=utf-8",
      body: sheetName === "UF Locations" ? locationsCsv : sheetName === "Treasurer Breakdown" ? budgetCsv : archiveEventsCsv
    });
  });
  await page.evaluate(() => {
    localStorage.removeItem("fqc:event-data");
    localStorage.setItem("fqc:event-mode", "list");
    localStorage.setItem("fqc:selected-event", "fqc-2026-03-03-upcoming");
  });
  await page.reload();

  // Upcoming tab pins only the upcoming location.
  await expect(page.locator(".event-map-pin")).toHaveCount(1);
  await expect(page.locator('.event-map-pin[data-location-id="malachowsky-hall"]')).toBeVisible();
  await expect(page.locator('.event-map-pin[data-location-id="larsen-hall"]')).toHaveCount(0);

  // Past tab swaps the pins over to the archived location.
  await page.getByRole("tab", { name: /Past 1/ }).click();
  await expect(page.locator('.event-map-pin[data-location-id="larsen-hall"]')).toBeVisible();
  await expect(page.locator(".event-map-pin")).toHaveCount(1);
});

test("a background refresh leaves the map where the reader put it", async ({ page }) => {
  const view = () => page.evaluate(() => {
    const map = window.__FQC_MAP__;
    return { lat: map.getCenter().lat, lng: map.getCenter().lng, zoom: map.getZoom() };
  });
  await page.waitForFunction(() => Boolean(window.__FQC_MAP__));
  await page.evaluate(() => window.__FQC_MAP__.setView([29.6436, -82.3549], 17, { animate: false }));
  const before = await view();

  // Re-render the home view the way a five-minute Sheet sync would.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(600);

  const after = await view();
  expect(Math.abs(after.lat - before.lat)).toBeLessThan(0.002);
  expect(Math.abs(after.lng - before.lng)).toBeLessThan(0.002);
  expect(after.zoom).toBe(before.zoom);
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
  // Quirk is at Larsen Hall, which hosts two events, so its pin reads "2".
  await expect(page.locator(".event-map-pin.active")).toHaveText("2");
  await expect(page.locator('.event-map-pin.active')).toHaveAttribute("data-location-id", "larsen-hall");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fqc:selected-event"))).toBe("fqc-2026-03-24-quirk");

  // A location pin opens the soonest event held there.
  await page.locator('.event-map-pin[data-location-id="malachowsky-hall"]').click();
  await expect(page.locator("#event-intro").getByRole("heading", { name: "GBM 2" })).toBeVisible();
  if (testInfo.project.name !== "mobile") {
    await expect(page.locator("#event-details").getByRole("heading", { name: "GBM 2" })).toBeVisible();
  }
  await expect(page.locator('[data-event-card="fqc-2026-03-10-gbm-2"]')).toHaveClass(/selected/);
  await expect(page.locator(".event-map-pin.active")).toHaveAttribute("data-location-id", "malachowsky-hall");
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
  await page.locator('.event-map-pin[data-location-id="malachowsky-hall"]').click();
  await expect(planner).toHaveAttribute("data-sheet-mode", "medium");
  await expect(intro.getByRole("heading", { name: "GBM 2" })).toBeVisible();

  await page.locator("#event-map").click({ position: { x: 190, y: 180 } });
  await expect(planner).toHaveAttribute("data-sheet-mode", "closed");
  await expect(planner).toHaveCSS("height", "0px");
  await page.locator('.event-map-pin[data-location-id="larsen-hall"]').click();
  await expect(planner).toHaveAttribute("data-sheet-mode", "medium");
  await expect(intro.getByRole("heading", { name: "Workshop 3: Quirk Circuit Simulator" })).toBeVisible();
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

test("asks signed-out visitors to log in or create an account before RSVP", async ({ page }) => {
  const speakerCard = page.locator('[data-event-card="fqc-2026-03-03-ionq"]');
  await speakerCard.locator("[data-rsvp]").click();
  await expect(page.getByRole("heading", { name: /RSVP to IonQ Quantum Networking/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log In", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Account", exact: true })).toBeVisible();
  await expect(speakerCard.locator("[data-rsvp]")).toHaveText("RSVP");

  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your FQC account" })).toBeVisible();
});

test("returns from login and automatically finishes the pending RSVP", async ({ page }) => {
  const speakerCard = page.locator('[data-event-card="fqc-2026-03-03-ionq"]');
  await speakerCard.locator("[data-rsvp]").click();
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await expect(page.locator('[data-event-card="fqc-2026-03-03-ionq"] [data-rsvp]')).toHaveText("Going");
  await expect(page.locator("#action-feedback")).toContainText("RSVP confirmed");
});

test("saves a signed-in RSVP from the unified home", async ({ page }) => {
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({ uid: "rsvp-member", displayName: "Riley", username: "riley", email: "riley@ufl.edu", role: "member" }));
  const speakerCard = page.locator('[data-event-card="fqc-2026-03-03-ionq"]');
  await speakerCard.locator("[data-rsvp]").click();
  await expect(speakerCard.locator("[data-rsvp]")).toHaveText("Going");
  await expect(page.locator("#action-feedback")).toContainText("RSVP confirmed");

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

test("display name takes any characters within the limit but not one already in use", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "member-1", displayName: "Alex Q", email: "alex@ufl.edu", role: "member" },
      { uid: "member-2", displayName: "Jordan", email: "jordan@ufl.edu", role: "member" }
    ]);
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "member-2", displayName: "Jordan", email: "jordan@ufl.edu", role: "member" });
  });
  await page.getByRole("button", { name: "Open settings" }).click();

  const nameField = page.getByLabel("Display name");
  await expect(nameField).toHaveAttribute("maxlength", "80");

  // Punctuation, spaces and emoji are all fine.
  await nameField.fill("Jordan “JJ” Vega-Ruiz 🐊");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Profile saved.");

  // A name another member holds is refused.
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByLabel("Display name").fill("alex q");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Another member is already using that display name.");

  // Too short is still refused, and names the limit.
  await page.getByLabel("Display name").fill("J");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Use 2 to 80 characters for your display name.")).toBeVisible();
});

test("account management and updates are both collapsible", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({ uid: "member-1", displayName: "Jordan", email: "jordan@ufl.edu", role: "member" }));
  await page.getByRole("button", { name: "Open settings" }).click();

  const account = page.locator(".settings-account-summary");
  const updates = page.locator(".settings-group").filter({ hasText: "Updates" }).first();
  await expect(account).toHaveAttribute("open", "");
  await expect(page.getByLabel("Display name")).toBeVisible();
  await account.getByText("Account management", { exact: true }).click();
  await expect(page.getByLabel("Display name")).toBeHidden();

  await expect(updates).not.toHaveAttribute("open", "");
  await updates.getByText("Updates", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Check for Updates" })).toBeVisible();
});

test("settings offers a home-screen install so the app runs without browser chrome", async ({ page }) => {
  await page.getByRole("button", { name: "Open settings" }).click();
  const installCard = page.locator(".install-card");
  await expect(installCard.getByRole("heading", { name: "Install FQC" })).toBeVisible();
  // Without a browser install event there is still a manual route.
  await expect(installCard.locator(".install-steps")).toBeVisible();
  await expect(installCard).toContainText("no address bar, search field, or browser buttons");

  // A browser that offers installation gets a one-tap button instead.
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    event.prompt = () => { window.__promptShown = true; };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  const installButton = page.getByRole("button", { name: "Install FQC" });
  await expect(installButton).toBeVisible();
  await installButton.click();
  await expect.poll(() => page.evaluate(() => window.__promptShown === true)).toBe(true);
  await expect(page.locator("#action-feedback")).toContainText("FQC is installing to your home screen.");
});

test("settings hides device reset under Advanced and shows version history", async ({ page }) => {
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByRole("heading", { name: "Version History" })).toBeVisible();
  await page.getByRole("heading", { name: "Version History" }).click();
  await expect(page.getByText("v2.13.0 · Current")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuke & Reload" })).toHaveCount(0);
  await page.getByText("Advanced settings", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Nuke & Reload" })).toBeVisible();
});

test("an officer login exposes officer controls in Profile", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({ uid: "officer-1", displayName: "Morgan", email: "morgan@ufl.edu", role: "officer" }));

  await expect(page.getByRole("heading", { name: "Events", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Officer Toolkit" })).toBeVisible();
  await expect(page.getByRole("link", { name: /General Onboarding/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /2026 Event Logistics/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Officer Recommendations" })).toHaveCount(0);
  await expect(page.locator(".profile-role-line").getByText("Officer", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Club budget overview").getByText("$3,540.00")).toBeVisible();
  await page.getByRole("button", { name: /available now/i }).click();
  await expect(page.getByRole("heading", { name: "Funding breakdown" })).toBeVisible();
  await expect(page.getByText("$1,050.00")).toBeVisible();
  await expect(page.getByText("$2,490.00")).toBeVisible();
  await page.getByRole("button", { name: "Close budget breakdown" }).click();

  const firstEvent = page.locator('[data-officer-event="fqc-2026-03-03-ionq"]');
  await firstEvent.getByText("Budget & purchases", { exact: true }).click();
  await expect(firstEvent.getByText("Speaker catering")).toBeVisible();
  await firstEvent.getByText("Event details & notes", { exact: true }).click();
  await firstEvent.getByLabel("Officer notes for this event").fill("Confirm room permit owner");
  await firstEvent.getByRole("button", { name: "Save Event Details" }).click();
  const savedFirstEvent = page.locator('[data-officer-event="fqc-2026-03-03-ionq"]');
  await savedFirstEvent.getByText("Event details & notes", { exact: true }).click();
  await expect(savedFirstEvent.getByLabel("Officer notes for this event")).toHaveValue("Confirm room permit owner");

  const secondEvent = page.locator('[data-officer-event="fqc-2026-04-14-gbm-3"]');
  await secondEvent.locator("summary").first().click();
  await secondEvent.getByRole("button", { name: "Start Event Check-In" }).click();
  await navButton(page, "Check In").click();
  await expect(page.getByRole("heading", { name: "GBM 3: Quantum Technology Today" })).toBeVisible();

  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.locator(".officer-settings-group")).toBeVisible();
});

test("keeps the officer profile minimal with four current events and a completed archive", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    const current = Array.from({ length: 6 }, (_, index) => ({
      id: `current-${index + 1}`,
      row: index + 2,
      date: `2026-03-0${index + 2}`,
      time: "6:00 PM",
      title: `Current Event ${index + 1}`,
      location: "Reitz G320",
      eventStatus: "Planned",
      plannedBudget: 20,
      actualSpend: 0,
      remainingBudget: 20,
      rsvps: [],
      officerRsvps: []
    }));
    window.__FQC_AUTH_TEST_API__.setOfficerEventOperations({
      events: [...current, {
        id: "completed-1",
        row: 8,
        date: "2026-02-20",
        time: "6:00 PM",
        title: "Completed Workshop",
        location: "Larsen 234",
        eventStatus: "Completed",
        plannedBudget: 40,
        actualSpend: 35,
        remainingBudget: 5,
        rsvps: [],
        officerRsvps: []
      }],
      budgetItems: [],
      totals: { baseFunding: 1050, operationalFunding: 2490, totalApproved: 3540, plannedSpend: 120, actualSpend: 35, availableAfterActual: 3505, uncommittedAfterPlan: 3420 },
      locations: ["Reitz G320", "Larsen 234"],
      updatedAt: new Date().toISOString()
    });
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "minimal-officer", displayName: "Morgan", email: "morgan@ufl.edu", role: "officer" });
  });

  const currentEvents = page.getByLabel("Current officer events");
  await expect(currentEvents.locator(".officer-event-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Show all 6 events" }).click();
  await expect(page.getByLabel("Current officer events").locator(".officer-event-card")).toHaveCount(6);

  const completedGroup = page.locator(".completed-events-group");
  await expect(completedGroup.getByText("Completed Workshop")).toBeHidden();
  await completedGroup.getByText("Completed Events", { exact: true }).click();
  await expect(completedGroup.getByText("Completed Workshop")).toBeVisible();

  const footer = page.locator(".officer-event-footer");
  await expect(footer.getByText("Add Event", { exact: true })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Open Google Sheet" })).toBeVisible();
  await expect(page.locator(".officer-operations + .officer-budget-card")).toBeVisible();
  await expect(page.locator(".officer-resource-copy p")).toHaveCount(0);
});

test("officers control the club-wide two-mile check-in setting", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({
    uid: "location-officer",
    displayName: "Morgan",
    email: "morgan@ufl.edu",
    role: "officer"
  }));

  await page.getByRole("button", { name: "Open settings" }).click();
  const officerGroup = page.locator(".officer-settings-group");
  await expect(officerGroup).not.toHaveAttribute("open", "");
  await officerGroup.getByText("Officer controls", { exact: true }).click();
  const locationSwitch = page.getByRole("switch", { name: /Require members to be within 2 miles/ });
  await expect(locationSwitch).not.toBeChecked();
  await locationSwitch.check();
  await expect(locationSwitch).toBeChecked();
  await expect(page.locator("#action-feedback")).toContainText("Two-mile check-in verification is on for the whole club.");
});

test("prioritizes the logged-in officer's Drive resources and expands the complete library", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({
    uid: "treasurer-resources",
    displayName: "Carter",
    email: "carter@ufl.edu",
    role: "officer",
    leadership: "treasurer",
    officerTitle: "Treasurer"
  }));

  await expect(page.getByRole("heading", { name: "Your Treasurer Toolkit" })).toBeVisible();
  const featuredResources = page.locator(".officer-resource-featured .officer-resource-card");
  await expect(featuredResources.first()).toContainText("Treasurer Guide");
  await expect(featuredResources.first()).toHaveAttribute("href", /^https:\/\/drive\.google\.com\/open\?id=/);

  await page.getByText("All Officer Documents", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Role Guides" })).toBeVisible();
  await expect(page.getByRole("link", { name: /President Guide/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Treasurer Guide/ }).last()).toBeVisible();
});

test("keeps event money, notes, RSVPs, creation, and check-in inside each officer event", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({ uid: "officer-ops", displayName: "Morgan", email: "morgan@ufl.edu", role: "officer" }));

  await expect(page.getByRole("heading", { name: "Events", exact: true })).toBeVisible();
  await expect(page.getByText("Member Activity", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Display name")).toHaveCount(0);
  await expect(page.getByText("Passkeys & Face ID", { exact: true })).toHaveCount(0);

  const eventCard = page.locator('[data-officer-event="fqc-2026-03-03-ionq"]');
  await expect(eventCard).toContainText("1 going");
  await eventCard.getByText("Budget & purchases", { exact: true }).click();
  const budgetForm = eventCard.locator('[data-budget-item-form="2"]');
  await budgetForm.getByLabel("Actual cost").fill("62.50");
  await budgetForm.getByRole("button", { name: "Save Money Changes" }).click();
  await expect(eventCard).toContainText("$62.50");

  const addEvent = page.locator(".officer-add-event");
  await addEvent.getByText("Add Event", { exact: true }).click();
  await addEvent.getByLabel("Event name").fill("Quantum Career Night");
  await addEvent.getByLabel("Date").fill("2026-11-12");
  await addEvent.getByLabel("Time").fill("6:00 PM");
  await addEvent.getByLabel("Location / room").fill("Reitz G320");
  await addEvent.getByRole("button", { name: "Create Event" }).click();
  await expect(page.locator(".officer-event-card").filter({ hasText: "Quantum Career Night" })).toBeVisible();

  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByText("Passkeys & Face ID", { exact: true })).toBeVisible();
  await expect(page.getByText("UFID & role verification", { exact: true })).toHaveCount(0);
});

test("saving money shows the planned total up front and keeps the officer in place", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({ uid: "officer-money", displayName: "Morgan", email: "morgan@ufl.edu", role: "officer" }));

  const eventCard = page.locator('[data-officer-event="fqc-2026-03-03-ionq"]');
  const cardMoney = eventCard.locator("summary .officer-event-money");
  await expect(cardMoney).toBeVisible();
  await expect(cardMoney).toContainText("$80.00");

  const budgetSection = eventCard.locator(".officer-event-subsection").filter({ hasText: "Budget & purchases" });
  await expect(budgetSection).toContainText("$80.00 planned");
  await budgetSection.getByText("Budget & purchases", { exact: true }).click();
  await expect(budgetSection).toHaveAttribute("open", "");

  const budgetForm = eventCard.locator('[data-budget-item-form="2"]');
  await budgetForm.getByLabel("Actual cost").fill("62.50");
  await budgetForm.getByRole("button", { name: "Save Money Changes" }).click();
  await expect(eventCard).toContainText("$62.50");

  await expect(eventCard).toHaveAttribute("open", "");
  await expect(budgetSection).toHaveAttribute("open", "");
  await expect(budgetForm.getByLabel("Actual cost")).toBeVisible();
});

test("treasurer budget lines use dropdowns and can be added or removed", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({ uid: "officer-budget", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true }));

  const eventCard = page.locator('[data-officer-event="fqc-2026-03-03-ionq"]');
  await eventCard.getByText("Budget & purchases", { exact: true }).click();
  const savedLine = eventCard.locator('[data-budget-item-form="2"]');

  // Funding source is a fixed three-way dropdown, not free text.
  const funding = savedLine.getByLabel("Funding source");
  await expect(funding).toHaveJSProperty("tagName", "SELECT");
  await expect(funding.locator("option")).toContainText([
    "Operational Funding",
    "Advertising Operation",
    "Food Operation",
    "Base Funds"
  ]);
  await funding.selectOption("Food Operation");
  await expect(savedLine.getByLabel("Unit", { exact: true })).toHaveJSProperty("tagName", "SELECT");
  await expect(savedLine.getByLabel("Budget status")).toHaveJSProperty("tagName", "SELECT");

  // Add a second line.
  const addLine = eventCard.locator(".budget-add-line");
  await addLine.getByText("Add another line", { exact: true }).click();
  await addLine.getByLabel("Item").fill("Poster printing");
  await addLine.getByLabel("Quantity").fill("2");
  await addLine.getByLabel("Unit cost").fill("15");
  await addLine.getByLabel("Funding source").selectOption("Advertising Operation");
  await addLine.getByRole("button", { name: "Add Budget Item" }).click();
  await expect(eventCard.getByText("Poster printing")).toBeVisible();
  await expect(eventCard.locator(".event-budget-item-form")).toHaveCount(3);

  // Remove it again, with a confirmation in between.
  const addedLine = eventCard.locator(".event-budget-item-form").filter({ hasText: "Poster printing" });
  await addedLine.getByRole("button", { name: "Remove Line" }).click();
  await page.locator(".confirm-modal").getByRole("button", { name: "Cancel" }).click();
  await expect(eventCard.getByText("Poster printing")).toBeVisible();

  await addedLine.getByRole("button", { name: "Remove Line" }).click();
  await page.locator(".confirm-modal").getByRole("button", { name: "Remove Line" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Budget line removed");
  await expect(eventCard.getByText("Poster printing")).toHaveCount(0);
});

test("member login enables event check-in and shows a member profile", async ({ page }) => {
  await navButton(page, "Check In").click();
  await expect(page.getByRole("heading", { name: "Sign in to check in" })).toBeVisible();
  await page.getByRole("button", { name: "Open Profile Login" }).click();
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page.getByText("Member", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Officer Command Center" })).toHaveCount(0);
  await expect(page.getByText("All Officer Documents", { exact: true })).toHaveCount(0);

  await navButton(page, "Check In").click();
  await page.getByRole("button", { name: "I’m Here" }).click();
  await expect(page.getByRole("button", { name: "Checked In" })).toBeDisabled();
  await expect(page.getByText("Attendance recorded for Passkey Member.")).toBeVisible();

  await navButton(page, "Profile").click();
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByLabel("Display name").fill("Alex Q");
  await page.getByRole("button", { name: "Save" }).click();

  await navButton(page, "Profile").click();
  await expect(page.getByRole("heading", { name: "Alex Q", level: 2 })).toBeVisible();
  await expect(page.locator("#profile-initial")).toHaveText("A");
});

test("leaderboard uses one cached read and awards one point per unique event", async ({ page }) => {
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setLeaderboard({
      entries: [
        { uid: "ranger-1", displayName: "Jordan", points: 3, role: "member" },
        { uid: "ranger-2", displayName: "Taylor", points: 2, role: "officer" },
        { uid: "member-1", displayName: "Alex", points: 99, role: "member" }
      ]
    });
    window.__FQC_AUTH_TEST_API__.resetLeaderboardReads();
    window.__FQC_AUTH_TEST_API__.signInAs({
      uid: "member-1",
      displayName: "Alex",
      email: "alex@ufl.edu",
      role: "member",
      checkedInEvents: ["past-event", "past-event"]
    });
  });

  await navButton(page, "Profile").click();
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByText("3 participants · verified event check-ins")).toBeVisible();
  await expect(page.locator(".leader-row").first()).toContainText("Jordan");
  await expect(page.locator(".leader-row.current-user")).toContainText("You");
  // A real ranked list, not medals.
  await expect(page.locator(".leader-row").first().locator(".leader-rank")).toHaveText("1");
  await expect(page.locator(".leader-card")).toHaveCount(0);
  await expect(page.getByText("1 point from verified event check-ins")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__FQC_AUTH_TEST_API__.getLeaderboardReads())).toBe(1);

  await navButton(page, "Home").click();
  await navButton(page, "Profile").click();
  await expect.poll(() => page.evaluate(() => window.__FQC_AUTH_TEST_API__.getLeaderboardReads())).toBe(1);

  await navButton(page, "Check In").click();
  await page.getByRole("button", { name: "I’m Here" }).click();
  await navButton(page, "Profile").click();
  await expect(page.getByText("2 points from verified event check-ins")).toBeVisible();
  await expect(page.locator(".leader-row.current-user")).toContainText("2 PTS");
});

test("a long leaderboard previews ten and opens the rest in a scrollable popup", async ({ page }) => {
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setLeaderboard({
      entries: Array.from({ length: 24 }, (_, index) => ({
        uid: `ranked-${index + 1}`,
        displayName: `Member ${String(index + 1).padStart(2, "0")}`,
        points: 30 - index,
        role: "member"
      }))
    });
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "ranked-24", displayName: "Member 24", email: "m24@ufl.edu", role: "member" });
  });
  await navButton(page, "Profile").click();

  const section = page.locator(".leaderboard-section");
  await expect(section.locator(".leader-row")).toHaveCount(10);
  await expect(section).toContainText("Member 10");
  await expect(section).not.toContainText("Member 11");

  await page.getByRole("button", { name: /Show all \d+ members/ }).click();
  const modal = page.locator(".leaderboard-modal");
  await expect(modal.getByRole("heading", { name: "Full Leaderboard" })).toBeVisible();
  await expect(modal.locator(".leader-row")).toHaveCount(24);
  await expect(modal).toContainText("Member 23");
  await expect(modal.locator(".leader-row").last()).toHaveClass(/current-user/);

  // Ranks continue past the preview instead of restarting.
  await expect(modal.locator(".leader-row").nth(10).locator(".leader-rank")).toHaveText("11");

  // The list scrolls inside the popup rather than growing the page.
  const scroller = page.locator(".leaderboard-scroll");
  await expect(scroller).toHaveCSS("overflow-y", "auto");
  const scrolled = await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return { top: element.scrollTop, overflows: element.scrollHeight > element.clientHeight };
  });
  expect(scrolled.overflows).toBe(true);
  expect(scrolled.top).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Close full leaderboard" }).click();
  await expect(modal).toHaveCount(0);
  await expect(section.locator(".leader-row")).toHaveCount(10);
});

test("account creation is an inviting three-step UF email, username, and security flow", async ({ page }) => {
  await navButton(page, "Profile").click();
  await expect(page.getByRole("tab", { name: "Log In" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Username or UF email")).toBeVisible();
  await expect(page.getByLabel("Private password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with Apple" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in with a passkey" })).toBeVisible();
  await expect(page.getByText(/officer code/i)).toHaveCount(0);

  await page.getByRole("tab", { name: "Create Account" }).click();
  await expect(page.getByRole("dialog", { name: "Create your FQC account" })).toBeVisible();
  await page.getByRole("button", { name: "Close account creation" }).click();
  await expect(page.getByRole("dialog", { name: "Create your FQC account" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Create Account" }).click();
  await page.locator("#signup-modal-backdrop").click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole("dialog", { name: "Create your FQC account" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Create Account" }).click();
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await page.getByLabel("UF email", { exact: true }).fill("new.gator@ufl.edu");
  await page.getByRole("button", { name: "Next: choose a username" }).click();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.setUsernameDirectory({ taken: "taken@ufl.edu" }));
  await page.getByLabel("Username", { exact: true }).fill("taken");
  await page.getByRole("button", { name: "Check username" }).click();
  await expect(page.getByText("That username is already taken. Try another.")).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill("newgator");
  await page.getByRole("button", { name: "Check username" }).click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await expect(page.getByText("@newgator · reserved")).toBeVisible();
  await expect(page.locator("#action-feedback")).toContainText("Username reserved for 10 minutes");
  await expect(page.getByRole("radio", { name: /Passkey/ })).toBeChecked();
  await expect(page.getByLabel("UFID verification")).toHaveCount(0);
  await page.getByRole("radio", { name: /Private password/ }).check();
  await page.locator("#signup-password").fill("quantum-safe-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Create your FQC account" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "newgator" })).toBeVisible();
  await expect(page.getByText("Member", { exact: true })).toBeVisible();
});

test("forgot password accepts a username or UF email", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByText("Enter your username or UF email first, then choose Forgot password.")).toBeVisible();
  await page.getByLabel("Username or UF email").fill("member@ufl.edu");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByText("If an FQC account matches that, a link to set a password is on its way to the UF inbox.")).toBeVisible();

  // The same wording comes back for an identifier with no account, so the form
  // cannot be used to find out who has one.
  await page.getByLabel("Username or UF email").fill("nobody.here@ufl.edu");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByText("If an FQC account matches that, a link to set a password is on its way to the UF inbox.")).toBeVisible();
});

test("any officer can make a member an officer but cannot demote or remove one", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "officer-1", displayName: "Morgan", email: "morgan@ufl.edu", role: "officer", officerTitle: "Secretary" },
      { uid: "member-1", displayName: "Jordan", email: "jordan@ufl.edu", role: "member" }
    ]);
    window.__FQC_AUTH_TEST_API__.setLeaderboard({
      entries: [
        { uid: "member-1", displayName: "Jordan", points: 4, role: "member" },
        { uid: "officer-1", displayName: "Morgan", points: 2, role: "officer" }
      ]
    });
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "officer-1", displayName: "Morgan", email: "morgan@ufl.edu", role: "officer", officerTitle: "Secretary" });
  });

  // Members are no longer managed from Settings at all.
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByRole("heading", { name: "Officer Recommendations" })).toHaveCount(0);
  await expect(page.locator('[data-member-id]')).toHaveCount(0);
  await page.getByRole("button", { name: "Back" }).click();

  await page.getByRole("button", { name: /Open Jordan/ }).click();
  const profile = page.locator(".member-profile-modal");
  await expect(profile.getByRole("heading", { name: "Jordan" })).toBeVisible();
  // A plain officer promotes, but cannot demote or remove.
  await expect(profile.getByRole("button", { name: "Remove Member" })).toHaveCount(0);
  await expect(profile.locator('option[value="member"]')).toHaveAttribute("disabled", "");
  await profile.locator("select").selectOption("officer");
  await profile.getByRole("button", { name: "Save role" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Member role updated.");
  await profile.getByRole("button", { name: "Close member profile" }).click();

  // Their own row offers nothing to change.
  await page.getByRole("button", { name: /Open Morgan/ }).click();
  await expect(profile.locator("select")).toBeDisabled();
  await expect(profile.getByRole("button", { name: "Save role" })).toBeDisabled();
  await expect(profile).toContainText("You cannot change your own role.");
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
    window.__FQC_AUTH_TEST_API__.setLeaderboard({
      entries: [
        { uid: "member-1", displayName: "Jordan", points: 6, role: "member" },
        { uid: "president-1", displayName: "Alex", points: 4, role: "officer" },
        { uid: "vp-1", displayName: "Taylor", points: 3, role: "officer" },
        { uid: "treasurer-1", displayName: "Carter", points: 1, role: "officer" }
      ]
    });
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true });
  });

  const profile = page.locator(".member-profile-modal");

  await page.getByRole("button", { name: /Open Alex/ }).click();
  await expect(profile.locator("select")).toBeDisabled();
  await expect(profile.getByRole("button", { name: "Save role" })).toBeDisabled();
  await expect(profile.getByRole("button", { name: "Remove Member" })).toBeDisabled();
  await expect(profile).toContainText("President, Vice President, and Treasurer accounts are protected.");
  await profile.getByRole("button", { name: "Close member profile" }).click();

  await page.getByRole("button", { name: /Open Taylor/ }).click();
  await expect(profile.locator("select")).toBeDisabled();
  await expect(profile.getByRole("button", { name: "Remove Member" })).toBeDisabled();
  await profile.getByRole("button", { name: "Close member profile" }).click();

  await page.getByRole("button", { name: /Open Jordan/ }).click();
  await profile.locator("select").selectOption("officer");
  await profile.getByRole("button", { name: "Save role" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Member role updated.");
});

test("removing a member needs a confirmation and then clears the standings", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true },
      { uid: "member-1", displayName: "Jordan", email: "jordan@ufl.edu", role: "member" }
    ]);
    window.__FQC_AUTH_TEST_API__.setLeaderboard({
      entries: [
        { uid: "member-1", displayName: "Jordan", points: 5, role: "member" },
        { uid: "treasurer-1", displayName: "Carter", points: 1, role: "officer" }
      ]
    });
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true });
  });

  const profile = page.locator(".member-profile-modal");
  await page.getByRole("button", { name: /Open Jordan/ }).click();
  await profile.getByRole("button", { name: "Remove Member" }).click();

  // Backing out of the confirmation must leave the member alone.
  const confirmDialog = page.locator(".confirm-modal");
  await expect(confirmDialog).toContainText("permanently deletes");
  await confirmDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmDialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open Jordan/ })).toBeVisible();

  await profile.getByRole("button", { name: "Remove Member" }).click();
  await page.locator(".confirm-modal").getByRole("button", { name: "Remove Member" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Jordan was removed from FQC.");
  await expect(profile).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open Jordan/ })).toHaveCount(0);
  await expect(page.locator(".leader-row")).toHaveCount(1);
});

test("the Treasurer can link a pending Sheet leadership row to a member account", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true },
      { uid: "sidney-1", displayName: "Sidney Brann", email: "sidney@ufl.edu", role: "member" }
    ]);
    window.__FQC_AUTH_TEST_API__.setLeadershipSlots([
      { row: 3, name: "Sidney Brann", title: "Vice President" }
    ]);
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true });
  });

  await page.getByRole("button", { name: "Open settings" }).click();
  // Officer-only settings stay collapsed until an officer opens them.
  const officerGroup = page.locator(".officer-settings-group");
  await expect(officerGroup).not.toHaveAttribute("open", "");
  await expect(page.locator('[data-leadership-row="3"]')).toBeHidden();
  await officerGroup.getByText("Officer controls", { exact: true }).click();
  const slot = page.locator('[data-leadership-row="3"]');
  await expect(slot.getByText("Vice President", { exact: false })).toBeVisible();
  await slot.locator("select").selectOption("sidney-1");
  await slot.getByRole("button", { name: "Link role" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Leadership role linked to that account.");
  // The seat stays on the roster once linked — it just stops being pending.
  await expect(page.locator('[data-leadership-row="3"]')).toHaveCount(1);
  await expect(slot.getByRole("button", { name: "Link role" })).toHaveCount(0);
  await expect(slot.locator(".leadership-seat-status")).toHaveText("Active");
});

test("the Treasurer can open a filled leadership seat and put it back on the roster", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true },
      { uid: "vp-1", displayName: "Taylor", email: "taylor@ufl.edu", role: "officer", leadership: "vice_president", officerTitle: "Vice President" }
    ]);
    window.__FQC_AUTH_TEST_API__.setLeadershipRoster([
      { row: 3, name: "Taylor", title: "Vice President", active: true, linked: true, pending: false }
    ]);
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true });
  });

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.locator(".officer-settings-group").getByText("Officer controls", { exact: true }).click();
  const seat = page.locator('[data-leadership-row="3"]');
  await expect(seat.locator(".leadership-seat-status")).toHaveText("Active");

  await seat.getByRole("button", { name: "Open seat" }).click();
  await expect(page.locator(".confirm-modal")).toContainText("stays a plain officer");
  await page.locator(".confirm-modal").getByRole("button", { name: "Open seat" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Leadership seat opened.");

  // The seat is back on the roster and can be linked to somebody else.
  await expect(seat.getByRole("button", { name: "Link role" })).toBeVisible();
  await expect(seat).toContainText("Waiting for an account");
});

test("a seat held by two matching accounts makes the Treasurer pick which one to open", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true },
      { uid: "treasurer-dupe", displayName: "carter.swarm1", email: "carter.swarm1@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true }
    ]);
    window.__FQC_AUTH_TEST_API__.setLeadershipRoster([
      { row: 4, name: "Carter Swarm", title: "Treasurer", active: true, linked: true, pending: false }
    ]);
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true });
  });

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.locator(".officer-settings-group").getByText("Officer controls", { exact: true }).click();
  const seat = page.locator('[data-leadership-row="4"]');

  // Two accounts claim the same leadership value, so the seat asks which one.
  const picker = seat.locator("[data-leadership-holder]");
  await expect(picker).toBeVisible();
  await expect(picker.locator("option")).toHaveCount(2);
  await picker.selectOption("treasurer-dupe");
  await seat.getByRole("button", { name: "Open seat" }).click();
  await page.locator(".confirm-modal").getByRole("button", { name: "Open seat" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Leadership seat opened.");
});

test("a seat with one obvious holder opens without asking", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true },
      { uid: "prez-1", displayName: "Alex", email: "alex@ufl.edu", role: "officer", leadership: "president", officerTitle: "President" }
    ]);
    window.__FQC_AUTH_TEST_API__.setLeadershipRoster([
      { row: 2, name: "Alex Heard", title: "President", active: true, linked: true, pending: false }
    ]);
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true });
  });

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.locator(".officer-settings-group").getByText("Officer controls", { exact: true }).click();
  const seat = page.locator('[data-leadership-row="2"]');
  await expect(seat.locator("[data-leadership-holder]")).toHaveCount(0);
  await expect(seat.getByRole("button", { name: "Open seat" })).toHaveAttribute("data-holder-uid", "prez-1");
});

test("an existing officer can be moved into a pending leadership seat", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true },
      { uid: "secretary-1", displayName: "Jay", email: "jay@ufl.edu", role: "officer", officerTitle: "Secretary" },
      { uid: "member-1", displayName: "Jordan", email: "jordan@ufl.edu", role: "member" }
    ]);
    window.__FQC_AUTH_TEST_API__.setLeadershipSlots([{ row: 3, name: "Sidney Brann", title: "Vice President" }]);
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true });
  });

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.locator(".officer-settings-group").getByText("Officer controls", { exact: true }).click();
  const slot = page.locator('[data-leadership-row="3"]');
  const picker = slot.locator("[data-leadership-member]");

  // A sitting officer can move up; someone holding a different seat is excluded.
  await expect(picker.locator("option")).toHaveCount(3);
  await expect(picker.locator('option[value="secretary-1"]')).toHaveCount(1);
  await expect(picker.locator('option[value="member-1"]')).toHaveCount(1);
  await expect(picker.locator('option[value="treasurer-1"]')).toHaveCount(0);

  await picker.selectOption("secretary-1");
  await slot.getByRole("button", { name: "Link role" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Leadership role linked to that account.");
});

test("a seat that drifted open can be re-linked to the officer who already holds the role", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "prez-1", displayName: "Alex", email: "alex@ufl.edu", role: "officer", leadership: "president", officerTitle: "President", canManageOfficers: true },
      { uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true }
    ]);
    window.__FQC_AUTH_TEST_API__.setLeadershipSlots([{ row: 4, name: "Carter Swarm", title: "Treasurer" }]);
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "prez-1", displayName: "Alex", email: "alex@ufl.edu", role: "officer", leadership: "president", officerTitle: "President", canManageOfficers: true });
  });

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.locator(".officer-settings-group").getByText("Officer controls", { exact: true }).click();
  const slot = page.locator('[data-leadership-row="4"]');
  const picker = slot.locator("[data-leadership-member]");

  // The sitting Treasurer is offered for the Treasurer seat, but the President is not.
  await expect(picker.locator('option[value="treasurer-1"]')).toHaveCount(1);
  await expect(picker.locator('option[value="prez-1"]')).toHaveCount(0);

  await picker.selectOption("treasurer-1");
  await slot.getByRole("button", { name: "Link role" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Leadership role linked to that account.");
});

test("a plain officer is never offered the leadership seat controls", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "officer-1", displayName: "Morgan", email: "morgan@ufl.edu", role: "officer", officerTitle: "Secretary" }
    ]);
    window.__FQC_AUTH_TEST_API__.setLeadershipRoster([
      { row: 2, name: "Alex", title: "President", active: true, linked: true, pending: false },
      { row: 3, name: "Sidney", title: "Program Officer", active: false, linked: false, pending: true }
    ]);
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "officer-1", displayName: "Morgan", email: "morgan@ufl.edu", role: "officer", officerTitle: "Secretary" });
  });

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.locator(".officer-settings-group").getByText("Officer controls", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Open seat" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Link role" })).toHaveCount(0);
});

test("officer controls list every leadership seat, linked and pending alike", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => {
    window.__FQC_AUTH_TEST_API__.setMembers([
      { uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true }
    ]);
    window.__FQC_AUTH_TEST_API__.setLeadershipRoster([
      { row: 2, name: "Alexander Heard", title: "President", active: true, linked: true, pending: false },
      { row: 3, name: "Sidney Brann", title: "Program Officer", active: false, linked: false, pending: true },
      { row: 4, name: "Carter Swarm", title: "Treasurer", active: true, linked: true, pending: false },
      { row: 5, name: "Daniel Takshi", title: "Workshop Lead", active: false, linked: false, pending: true },
      { row: 6, name: "Jay", title: "Secretary", active: true, linked: true, pending: false },
      { row: 7, name: "Ayo", title: "Undergrad Outreach", active: false, linked: false, pending: true },
      { row: 8, name: "Jake", title: "Social Media", active: false, linked: false, pending: true }
    ]);
    window.__FQC_AUTH_TEST_API__.signInAs({ uid: "treasurer-1", displayName: "Carter", email: "carter@ufl.edu", role: "officer", leadership: "treasurer", officerTitle: "Treasurer", canManageOfficers: true });
  });

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.locator(".officer-settings-group").getByText("Officer controls", { exact: true }).click();

  const roster = page.locator(".leadership-slot-roster");
  await expect(roster.locator(".leadership-seat")).toHaveCount(7);
  await expect(roster).toContainText("Alexander Heard");
  await expect(roster).toContainText("Jay");
  await expect(roster).toContainText("4 seats are still waiting on an account");
  await expect(roster.locator(".leadership-seat-status.active")).toHaveCount(3);
  // Only unmatched seats offer the link control.
  await expect(roster.getByRole("button", { name: "Link role" })).toHaveCount(4);
});

test("a brand new account is always a plain member with no officer controls", async ({ page }) => {
  await navButton(page, "Profile").click();
  await createThreeStepAccount(page, { email: "hopeful@ufl.edu", username: "hopeful" });
  await expect(page.locator(".profile-role-line").getByText("Member", { exact: true })).toBeVisible();
  await expect(page.locator(".officer-settings-group")).toHaveCount(0);
  await page.getByRole("button", { name: "Open settings" }).click();
  // Signing up cannot hand anyone officer access, whatever they type on the way in.
  await expect(page.locator(".officer-settings-group")).toHaveCount(0);
});

test("a passkey member can email themselves a link to set a backup password", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({ uid: "passkey-only", displayName: "Robin", username: "robin", email: "robin@ufl.edu", role: "member", passkeyCount: 1 }));
  await page.getByRole("button", { name: "Open settings" }).click();

  await page.getByText("Password", { exact: true }).click();
  await expect(page.getByText(/A password is how you get back in on a device that has no passkey/)).toBeVisible();
  await page.getByRole("button", { name: "Email Me a Password Link" }).click();
  await expect(page.locator("#action-feedback")).toContainText("Password link sent to robin@ufl.edu");
});

test("the login screen tells a member with no passkey on this device how to get in", async ({ page }) => {
  await navButton(page, "Profile").click();
  await expect(page.getByText(/No passkey on this device, or never set a password/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with a passkey" })).toBeVisible();
});

test("a signed-in member can add a device passkey", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({ uid: "member-passkey", displayName: "Member", username: "member", email: "member@ufl.edu", role: "member", passkeyCount: 0 }));
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByText("0 passkeys")).toBeVisible();
  await page.getByText("Passkeys & Face ID", { exact: true }).click();
  await page.getByRole("button", { name: "Set Up Face ID / Touch ID" }).click();
  await expect(page.getByText("1 passkey", { exact: true })).toBeVisible();
  await expect(page.getByText(/Passkey added/)).toBeVisible();
});

test("nukes local app data and reloads a fresh events home", async ({ page }) => {
  await navButton(page, "Profile").click();
  await page.evaluate(() => window.__FQC_AUTH_TEST_API__.signInAs({ uid: "member-nuke", displayName: "Nuke Member", username: "nukemember", email: "nuke@ufl.edu", role: "member" }));
  await expect(page.getByRole("heading", { name: "Nuke Member", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByText("Advanced settings", { exact: true }).click();
  const reload = page.waitForEvent("framenavigated");
  await page.getByRole("button", { name: "Nuke & Reload" }).click();
  await reload;

  await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  await expect(page.locator("#profile-initial")).toHaveText("F");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fqc:name"))).toBeNull();
});
