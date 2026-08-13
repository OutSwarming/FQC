import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("uses the registered same-origin web.app Google OAuth handler", () => {
  const source = readFileSync(new URL("../firebase-client.js", import.meta.url), "utf8");

  expect(source).toContain('authDomain: "florida-quantum-computing.web.app"');
  expect(source).not.toContain('authDomain: "florida-quantum-computing.firebaseapp.com"');
});

test("uses one canonical workbook for events, treasury, locations, and leadership", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const functionsSource = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
  const canonicalWorkbookId = "1xB4q--RsY7girF9JumjbUKKRu9lFQ8XHRlkCHttbgd0";

  expect(appSource).toContain(`const EVENT_SHEET_ID = "${canonicalWorkbookId}"`);
  expect(functionsSource).toContain(`const officerRosterSpreadsheetId = "${canonicalWorkbookId}"`);
  expect(appSource).toContain('const EVENTS_SHEET_NAME = "Events"');
  expect(appSource).toContain('const TREASURER_SHEET_NAME = "Treasurer Breakdown"');
  expect(appSource).toContain('const UF_LOCATIONS_SHEET_NAME = "UF Locations"');
  expect(functionsSource).toContain('const officerRosterSheetName = "Current Leadership"');
});
