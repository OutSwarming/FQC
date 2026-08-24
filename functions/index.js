import { createHash, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { GoogleAuth } from "google-auth-library";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const region = "us-central1";
const rpName = "Florida Quantum Computing";
const challengeLifetimeMs = 5 * 60 * 1000;
const maxLeaderboardEntries = 100;
const officerRosterSpreadsheetId = "1xB4q--RsY7girF9JumjbUKKRu9lFQ8XHRlkCHttbgd0";
const officerRosterSheetName = "Current Leadership";
const eventSheetName = "Events";
const treasurySheetName = "Treasurer Breakdown";
const locationSheetName = "UF Locations";
const masterMembersSheetName = "Master Members";
const masterMembersBaseColumns = 5;
const masterMembersColumnCount = 260;
const maxCheckInDistanceMiles = 2;
const sheetsAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const eventStatuses = Object.freeze(["Planning", "Planned", "Room pending", "Confirmed", "In progress", "Completed", "Cancelled"]);
const safeEventIdPattern = /^[a-z0-9][a-z0-9-]{2,80}$/i;
const maxDisplayNameLength = 80;
const driveResourceUrl = (fileId) => `https://drive.google.com/open?id=${fileId}`;
export const officerResourceCatalog = Object.freeze([
  { id: "general-onboarding", title: "General Onboarding", kind: "Google Doc", category: "Getting Started", roles: ["general"], featured: ["all"], summary: "Start here for the club-wide officer onboarding process.", url: driveResourceUrl("1QTB_FgUUzLY6x3gb9Qy4VXjBkdCuMak9Qd8OhEhA-DM") },
  { id: "president-guide", title: "President Guide", kind: "Google Doc", category: "Role Guides", roles: ["president"], featured: ["president"], summary: "President responsibilities, recurring work, and handoff information.", url: driveResourceUrl("1silsTsr5IC1zf7H6yfAdn_v5K4sgjEkdTYVG84wsUf0") },
  { id: "vice-president-guide", title: "Vice President Guide", kind: "Google Doc", category: "Role Guides", roles: ["vice-president"], featured: ["vice-president"], summary: "Vice President responsibilities and operational support workflow.", url: driveResourceUrl("1mZlod9xpK3mlm45EpFelwG8IpUBPJKnUtAeGl5AfbDg") },
  { id: "secretary-guide", title: "Secretary Guide", kind: "Google Doc", category: "Role Guides", roles: ["secretary"], featured: ["secretary"], summary: "Secretary responsibilities, records, and communication workflow.", url: driveResourceUrl("1BiCnuETsABgXeEUtzw4pPYfooQx1ZDU-sokSfwFMQ-E") },
  { id: "treasurer-guide", title: "Treasurer Guide", kind: "Google Doc", category: "Role Guides", roles: ["treasurer"], featured: ["treasurer"], summary: "Treasurer responsibilities, funding, purchasing, and reimbursement workflow.", url: driveResourceUrl("1cadNMOdQ36Go2Tz_TbxJUI1fAMEjQlbZQvrDu-ydVDQ") },
  { id: "workshop-guide", title: "Workshop Guide", kind: "Google Doc", category: "Role Guides", roles: ["workshop"], featured: ["workshop"], summary: "Workshop planning, preparation, and delivery guidance.", url: driveResourceUrl("1RdvqcjEFb7kMy5VgtGw1u7nsYH6pq0IYbBXSmeCCB_4") },
  { id: "outreach-guide", title: "Outreach Guide", kind: "Google Doc", category: "Role Guides", roles: ["outreach"], featured: ["outreach"], summary: "Outreach responsibilities, contacts, and external communication workflow.", url: driveResourceUrl("1lIWEsySDSyN4TAsNUiofA2x1rZSDbYbO9M46a4z3q4k") },
  { id: "social-media-guide", title: "Social Media Guide", kind: "Google Doc", category: "Role Guides", roles: ["social-media"], featured: ["social-media"], summary: "Social posting, event promotion, and account workflow.", url: driveResourceUrl("1n4lHL-JLqZhsClDR0VrzXjwNDG7FgR0APNBodGqKxXY") },
  { id: "merch-guide", title: "Merch Guide", kind: "Google Doc", category: "Role Guides", roles: ["merch"], featured: ["merch"], summary: "Merchandise planning, vendor, inventory, and fulfillment guidance.", url: driveResourceUrl("1jlLvlk3nhB7AymKY3cSrIXuuWrDE5QiVbEmztRLkOgg") },
  { id: "event-logistics", title: "2026 Event Logistics", kind: "Google Sheet", category: "Planning & Operations", roles: ["all"], featured: ["all"], summary: "Live events, member attendance, per-event budgets, treasury details, UF locations, and leadership.", url: driveResourceUrl("1xB4q--RsY7girF9JumjbUKKRu9lFQ8XHRlkCHttbgd0") },
  { id: "annual-calendar", title: "Annual Calendar", kind: "Google Sheet", category: "Planning & Operations", roles: ["all"], featured: ["president", "vice-president", "secretary", "workshop", "social-media"], summary: "Year-round schedule and planning reference.", url: driveResourceUrl("1Q8nTp6xPnwZEITDgHKybljW5ikGW40E_oalAeH-MKmA") },
  { id: "officer-tasks", title: "FQC To Do List", kind: "Google Sheet", category: "Planning & Operations", roles: ["all"], featured: ["president", "vice-president", "secretary"], summary: "Shared current action list for the officer team.", url: driveResourceUrl("14FCA-rZteURTS9DXcUBgHKHpcv_5UaWscCtDN_Nri1o") },
  { id: "deadlines", title: "Deadlines Tracker", kind: "Google Sheet", category: "Planning & Operations", roles: ["all"], featured: ["president", "vice-president", "treasurer", "secretary"], summary: "Important organization, event, funding, and submission deadlines.", url: driveResourceUrl("1geo4p1mRyla8kuXV_u2PBxEh2xDBU4F3kAcNeqbxyk4") },
  { id: "contacts", title: "Contacts", kind: "Google Sheet", category: "Communication & Forms", roles: ["all"], featured: ["president", "vice-president", "secretary", "outreach", "merch"], summary: "Shared FQC contacts and relationship reference.", url: driveResourceUrl("1OKSz-F8wqID_OE1-AhfrcHpqc4iVhmYOew5TJofSFQg") },
  { id: "reimbursement", title: "Reimbursement Form", kind: "Google Form", category: "Communication & Forms", roles: ["all"], featured: ["treasurer"], summary: "Submit and track an officer reimbursement request.", url: driveResourceUrl("1ngiD2teRShlXaGy49Dp7lmQiy_dbhYP2E9M4XDzNgxo") },
  { id: "incident-report", title: "Incident Report Form", kind: "Google Form", category: "Communication & Forms", roles: ["all"], featured: ["president", "vice-president", "secretary"], summary: "Record an incident consistently for officer follow-up.", url: driveResourceUrl("1IXeS19ZqLjsNOiDBdufpgdEhJf4vAeNQ0B-5VtRvKLY") },
  { id: "signature-template", title: "FQC Signature Template", kind: "Google Doc", category: "Communication & Forms", roles: ["all"], featured: ["outreach", "social-media"], summary: "Official FQC email signature and branding reference.", url: driveResourceUrl("1F0DybYt2KsGTlDC0J8lG4WCWZkxcuFRVFrd72lvQbnk") },
  { id: "constitution", title: "Constitution 2026–27", kind: "Google Doc", category: "Governance & Continuity", roles: ["all"], featured: ["president", "vice-president"], summary: "Current governing constitution for the 2026–27 organization year.", url: driveResourceUrl("1fhKyCr1jd3T95VY9YZ2CPIi8ASFTnzp7RF8yM0xn46k") },
  { id: "bylaws", title: "Bylaws", kind: "Google Doc", category: "Governance & Continuity", roles: ["all"], featured: ["president", "vice-president"], summary: "Current officer and organization operating rules.", url: driveResourceUrl("1rWf08RjafNYlwX1jWU1hTe1nRcMcygWF8nSwawmc8rA") },
  { id: "handover", title: "Handover Guide", kind: "Google Doc", category: "Governance & Continuity", roles: ["all"], featured: ["president", "vice-president"], summary: "Continuity checklist and transfer guidance for future officer teams.", url: driveResourceUrl("1CQ7QGbDqAKEucQP7Ei-g6cL2f3rot65NLtUBsa6GRhM") }
]);
const allowedOrigins = new Map([
  ["https://florida-quantum-computing.web.app", "florida-quantum-computing.web.app"],
  ["https://florida-quantum-computing.firebaseapp.com", "florida-quantum-computing.firebaseapp.com"],
  ["http://127.0.0.1:4175", "127.0.0.1"],
  ["http://localhost:4175", "localhost"]
]);

const callableOptions = {
  region,
  cors: [...allowedOrigins.keys()],
  maxInstances: 10
};

// The browser checks for a UF address at signup, but that check is only a
// courtesy: anything calling Firebase Auth directly skips it. New accounts are
// gated here as well. Accounts that already exist are left alone, and
// FQC_EMAIL_ALLOWLIST carries named exceptions.
export function assertEligibleSignupEmail(email) {
  const value = cleanText(email, 180).toLowerCase();
  const allowlist = String(process.env.FQC_EMAIL_ALLOWLIST || "")
    .toLowerCase()
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (allowlist.includes(value)) return;
  if (!/^[^\s@]+@ufl\.edu$/.test(value)) {
    throw new HttpsError("permission-denied", "FQC accounts use a UF email ending in @ufl.edu.");
  }
}

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in is required.");
  return request.auth;
}

function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

export function isSafeEventId(value) {
  return safeEventIdPattern.test(cleanText(value, 100));
}

// Display names allow any characters. Uniqueness is checked case-insensitively
// and ignores runs of whitespace so "Alex  Q" cannot shadow "alex q".
export function displayNameKey(value) {
  return cleanText(value, maxDisplayNameLength)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140)
    .replace(/\//g, "∕");
}

const reservedUsernames = new Set(["admin", "administrator", "fqc", "officer", "president", "support", "treasurer"]);

export function usernameForInput(value) {
  const username = cleanText(value, 24).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])$/.test(username)) return "";
  return reservedUsernames.has(username) ? "" : username;
}

function profileRole(value) {
  return value === "officer" ? "officer" : "member";
}

export function uniqueEventIds(eventIds = []) {
  return [...new Set((Array.isArray(eventIds) ? eventIds : [])
    .map((eventId) => cleanText(eventId, 100))
    .filter(Boolean))].slice(0, 250);
}

export function pointsForEvents(eventIds = []) {
  return uniqueEventIds(eventIds).length;
}

export function buildLeaderboardEntries(entries = [], nextEntry = {}, limit = maxLeaderboardEntries) {
  const byUid = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const uid = cleanText(entry?.uid, 160);
    if (!uid) continue;
    byUid.set(uid, {
      uid,
      displayName: cleanText(entry.displayName || "FQC Member", 80),
      points: Math.max(0, Math.trunc(Number(entry.points) || 0)),
      role: profileRole(entry.role)
    });
  }

  const uid = cleanText(nextEntry?.uid, 160);
  if (uid) {
    byUid.set(uid, {
      uid,
      displayName: cleanText(nextEntry.displayName || "FQC Member", 80),
      points: Math.max(0, Math.trunc(Number(nextEntry.points) || 0)),
      role: profileRole(nextEntry.role)
    });
  }

  return [...byUid.values()]
    .sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName) || a.uid.localeCompare(b.uid))
    .slice(0, Math.max(1, Math.min(maxLeaderboardEntries, Number(limit) || maxLeaderboardEntries)));
}

function leaderboardEntry(uid, data = {}) {
  const checkedInEvents = uniqueEventIds(data.checkedInEvents);
  return {
    uid,
    username: usernameForInput(data.username),
    displayName: cleanText(data.displayName || "FQC Member", 80),
    points: pointsForEvents(checkedInEvents),
    role: profileRole(data.role)
  };
}

async function syncLeaderboardProfile(uid, data = {}) {
  const snapshotRef = db.collection("system").doc("leaderboardData");
  const entry = leaderboardEntry(uid, data);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(snapshotRef);
    const currentEntries = snapshot.data()?.entries || [];
    const entries = buildLeaderboardEntries(currentEntries, entry);
    if (JSON.stringify(entries) !== JSON.stringify(currentEntries)) {
      transaction.set(snapshotRef, {
        entries,
        participantCount: entries.length,
        scoring: "one-point-per-event",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    return { entries, participantCount: entries.length };
  });
}

export function leadershipForRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "president") return "president";
  if (normalized === "vice president" || normalized === "vice-president" || normalized === "vp") return "vice_president";
  if (normalized === "treasurer") return "treasurer";
  return "";
}

export function leadershipForStoredValue(value) {
  return ["president", "vice_president", "treasurer"].includes(value) ? value : "";
}

export function leadershipTitle(leadership) {
  if (leadership === "president") return "President";
  if (leadership === "vice_president") return "Vice President";
  if (leadership === "treasurer") return "Treasurer";
  return "Officer";
}

export function officerResourceRoleKey(officerTitle = "", leadership = "") {
  if (leadership === "president") return "president";
  if (leadership === "vice_president") return "vice-president";
  if (leadership === "treasurer") return "treasurer";
  const normalized = String(officerTitle || "").trim().toLowerCase();
  if (normalized.includes("vice") && normalized.includes("president")) return "vice-president";
  if (normalized.includes("president")) return "president";
  if (normalized.includes("treasurer")) return "treasurer";
  if (normalized.includes("secretary")) return "secretary";
  if (normalized.includes("workshop")) return "workshop";
  if (normalized.includes("outreach")) return "outreach";
  if (normalized.includes("social")) return "social-media";
  if (normalized.includes("merch")) return "merch";
  return "general";
}

export function canManageOfficerRoles(token = {}) {
  return token.manageOfficers === true || token.leadership === "president" || token.leadership === "treasurer";
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function normalizedSheetDate(value) {
  const text = cleanText(value, 24);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function normalizedSheetTime(value) {
  return cleanText(value, 24).replace(/^(\d{1,2}:\d{2}):\d{2}\s/i, "$1 ");
}

function sheetNumber(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

export function sheetColumnLetter(index) {
  let value = Math.trunc(Number(index));
  if (!Number.isFinite(value) || value < 0) return "";
  let result = "";
  do {
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return result;
}

export function masterMemberKey(uid) {
  return createHash("sha256").update(cleanText(uid, 160)).digest("hex");
}

export function distanceMilesBetween(first = {}, second = {}) {
  const lat1 = Number(first.lat);
  const lng1 = Number(first.lng);
  const lat2 = Number(second.lat);
  const lng2 = Number(second.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLng = radians(lng2 - lng1);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizedEventStatus(value, date = "") {
  const status = cleanText(value, 40);
  if (eventStatuses.includes(status)) return status;
  return date && date < new Date().toISOString().slice(0, 10) ? "Completed" : "Planned";
}

async function sheetsAccessToken() {
  const client = await sheetsAuth.getClient();
  const result = await client.getAccessToken();
  const token = typeof result === "string" ? result : result?.token;
  if (!token) throw new HttpsError("unavailable", "Google Sheets authorization is unavailable.");
  return token;
}

async function sheetsRequest(path, { method = "GET", body } = {}) {
  const token = await sheetsAccessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${officerRosterSpreadsheetId}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) {
    const detail = cleanText(await response.text(), 500);
    console.error("Google Sheets request failed", response.status, detail);
    throw new HttpsError("unavailable", "The FQC event workbook could not be updated. Try again shortly.");
  }
  return response.status === 204 ? {} : response.json();
}

function valuesPath(range, options = {}) {
  const query = new URLSearchParams(options);
  return `/values/${encodeURIComponent(range)}${query.size ? `?${query}` : ""}`;
}

async function getSheetValues(range, valueRenderOption = "FORMATTED_VALUE") {
  const result = await sheetsRequest(valuesPath(range, { majorDimension: "ROWS", valueRenderOption }));
  return Array.isArray(result.values) ? result.values : [];
}

async function updateSheetValues(data) {
  return sheetsRequest("/values:batchUpdate", {
    method: "POST",
    body: { valueInputOption: "USER_ENTERED", data }
  });
}

async function appendSheetValues(range, values) {
  const query = new URLSearchParams({
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS"
  });
  return sheetsRequest(`/values/${encodeURIComponent(range)}:append?${query}`, {
    method: "POST",
    body: { majorDimension: "ROWS", values }
  });
}

async function ensureMasterMembersSchema() {
  const metadata = await sheetsRequest("?fields=sheets(properties(sheetId,title,gridProperties))");
  let properties = metadata.sheets?.map((sheet) => sheet.properties)
    .find((sheet) => sheet.title === masterMembersSheetName);
  let created = false;
  if (!properties) {
    const response = await sheetsRequest(":batchUpdate", {
      method: "POST",
      body: {
        requests: [{
          addSheet: {
            properties: {
              title: masterMembersSheetName,
              gridProperties: { rowCount: 1000, columnCount: masterMembersColumnCount, frozenRowCount: 2 }
            }
          }
        }]
      }
    });
    properties = response.replies?.[0]?.addSheet?.properties;
    created = true;
  }
  if (!properties?.sheetId) throw new HttpsError("unavailable", "The Master Members tab is unavailable.");

  const needsStructure = created ||
    Number(properties.gridProperties?.columnCount) < masterMembersColumnCount ||
    Number(properties.gridProperties?.frozenRowCount) !== 2;
  if (needsStructure) {
    await sheetsRequest(":batchUpdate", {
      method: "POST",
      body: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: properties.sheetId,
                gridProperties: { columnCount: masterMembersColumnCount, frozenRowCount: 2 }
              },
              fields: "gridProperties.columnCount,gridProperties.frozenRowCount"
            }
          },
          {
            repeatCell: {
              range: { sheetId: properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: masterMembersColumnCount },
              cell: {
                userEnteredFormat: {
                  backgroundColorStyle: { rgbColor: { red: 0.9, green: 0.9, blue: 0.9 } },
                  textFormat: { bold: true },
                  verticalAlignment: "MIDDLE",
                  wrapStrategy: "WRAP"
                }
              },
              fields: "userEnteredFormat(backgroundColorStyle,textFormat,verticalAlignment,wrapStrategy)"
            }
          },
          {
            repeatCell: {
              range: { sheetId: properties.sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: masterMembersColumnCount },
              cell: {
                userEnteredFormat: {
                  backgroundColorStyle: { rgbColor: { red: 0.96, green: 0.96, blue: 0.96 } },
                  textFormat: { italic: true }
                }
              },
              fields: "userEnteredFormat(backgroundColorStyle,textFormat)"
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: properties.sheetId, dimension: "ROWS", startIndex: 1, endIndex: 2 },
              properties: { hiddenByUser: true },
              fields: "hiddenByUser"
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: properties.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
              properties: { hiddenByUser: true, pixelSize: 150 },
              fields: "hiddenByUser,pixelSize"
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: properties.sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
              properties: { pixelSize: 190 },
              fields: "pixelSize"
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: properties.sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 },
              properties: { pixelSize: 125 },
              fields: "pixelSize"
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: properties.sheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 },
              properties: { pixelSize: 75 },
              fields: "pixelSize"
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: properties.sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: masterMembersColumnCount },
              properties: { pixelSize: 170 },
              fields: "pixelSize"
            }
          }
        ]
      }
    });
  }

  const [header = [], identity = []] = await getSheetValues(`'${masterMembersSheetName}'!A1:E2`);
  const expectedHeader = ["Member Key", "Member Name", "Role", "Points", "Last Check-In"];
  const expectedIdentity = ["Stable private app key", "", "", "", "Event IDs continue from column F"];
  if (JSON.stringify(header) !== JSON.stringify(expectedHeader) || JSON.stringify(identity) !== JSON.stringify(expectedIdentity)) {
    await updateSheetValues([{
      range: `'${masterMembersSheetName}'!A1:E2`,
      values: [expectedHeader, expectedIdentity]
    }]);
  }
  return properties;
}

function masterEventHeader(event = {}) {
  return `${cleanText(event.date, 24)} · ${cleanText(event.title, 120)}`;
}

async function syncMasterMemberEventHeaders(workbook) {
  await ensureMasterMembersSchema();
  const [titleRow = [], idRow = []] = await getSheetValues(`'${masterMembersSheetName}'!A1:IZ2`);
  const columnByEventId = new Map();
  for (let column = masterMembersBaseColumns; column < idRow.length; column += 1) {
    const eventId = cleanText(idRow[column], 100);
    if (eventId) columnByEventId.set(eventId, column);
  }

  const claimedColumns = new Set();
  const nextOpenColumn = () => {
    for (let column = masterMembersBaseColumns; column < masterMembersColumnCount; column += 1) {
      if (!claimedColumns.has(column) && !cleanText(idRow[column], 100)) return column;
    }
    throw new HttpsError("resource-exhausted", "The Master Members tab needs more event columns.");
  };
  const updates = [];
  for (const event of workbook.events) {
    let column = columnByEventId.get(event.id);
    if (column !== undefined) {
      claimedColumns.add(column);
    } else {
      const datePrefix = `${event.date} · `;
      const sameDateColumns = [];
      for (let candidate = masterMembersBaseColumns; candidate < titleRow.length; candidate += 1) {
        if (String(titleRow[candidate] || "").startsWith(datePrefix) && !claimedColumns.has(candidate)) sameDateColumns.push(candidate);
      }
      column = sameDateColumns.length === 1 ? sameDateColumns[0] : nextOpenColumn();
      claimedColumns.add(column);
      columnByEventId.set(event.id, column);
    }
    const letter = sheetColumnLetter(column);
    const header = masterEventHeader(event);
    if (titleRow[column] !== header) updates.push({ range: `'${masterMembersSheetName}'!${letter}1`, values: [[header]] });
    if (idRow[column] !== event.id) updates.push({ range: `'${masterMembersSheetName}'!${letter}2`, values: [[event.id]] });
  }
  if (updates.length) await updateSheetValues(updates);
  return columnByEventId;
}

async function syncMasterMemberAttendance({ uid, displayName, roleLabel, points, checkedInEvents, checkedInAt }, workbook) {
  const columnByEventId = await syncMasterMemberEventHeaders(workbook);
  const memberKey = masterMemberKey(uid);
  const memberRows = await getSheetValues(`'${masterMembersSheetName}'!A3:A1000`);
  const existingIndex = memberRows.findIndex((row) => cleanText(row[0], 80) === memberKey);
  const attendedColumns = uniqueEventIds(checkedInEvents)
    .map((eventId) => columnByEventId.get(eventId))
    .filter((column) => Number.isInteger(column));
  const baseValues = [memberKey, cleanText(displayName, 80), cleanText(roleLabel, 80), Math.max(0, Math.trunc(Number(points) || 0)), checkedInAt];

  if (existingIndex >= 0) {
    const row = existingIndex + 3;
    const updates = [{ range: `'${masterMembersSheetName}'!A${row}:E${row}`, values: [baseValues] }];
    attendedColumns.forEach((column) => updates.push({
      range: `'${masterMembersSheetName}'!${sheetColumnLetter(column)}${row}`,
      values: [["✓"]]
    }));
    await updateSheetValues(updates);
    return { row, added: false };
  }

  const finalColumn = Math.max(masterMembersBaseColumns - 1, ...attendedColumns);
  const rowValues = Array(finalColumn + 1).fill("");
  baseValues.forEach((value, index) => { rowValues[index] = value; });
  attendedColumns.forEach((column) => { rowValues[column] = "✓"; });
  const response = await appendSheetValues(`'${masterMembersSheetName}'!A:IZ`, [rowValues]);
  return { row: response.updates?.updatedRange || "appended", added: true };
}

async function syncExistingMasterMemberProfile(uid, profile = {}) {
  await ensureMasterMembersSchema();
  const memberKey = masterMemberKey(uid);
  const memberRows = await getSheetValues(`'${masterMembersSheetName}'!A3:A1000`);
  const existingIndex = memberRows.findIndex((row) => cleanText(row[0], 80) === memberKey);
  if (existingIndex < 0) return false;
  const role = profileRole(profile.role);
  const roleLabel = cleanText(profile.officerTitle || (role === "officer" ? "Officer" : "Member"), 80);
  const points = pointsForEvents(profile.checkedInEvents);
  const row = existingIndex + 3;
  await updateSheetValues([{
    range: `'${masterMembersSheetName}'!B${row}:D${row}`,
    values: [[cleanText(profile.displayName || "FQC Member", 80), roleLabel, points]]
  }]);
  return true;
}

async function ensureEventOperationsSchema() {
  const [headers = []] = await getSheetValues(`'${eventSheetName}'!A1:W1`);
  if (headers[21] === "Event Status" && headers[22] === "Officer RSVPs") return;
  await sheetsRequest(":batchUpdate", {
    method: "POST",
    body: {
      requests: [
        {
          copyPaste: {
            source: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 20, endColumnIndex: 21 },
            destination: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 21, endColumnIndex: 23 },
            pasteType: "PASTE_FORMAT",
            pasteOrientation: "NORMAL"
          }
        },
        {
          setDataValidation: {
            range: { sheetId: 0, startRowIndex: 1, endRowIndex: 1001, startColumnIndex: 21, endColumnIndex: 22 },
            rule: {
              condition: { type: "ONE_OF_LIST", values: eventStatuses.map((userEnteredValue) => ({ userEnteredValue })) },
              strict: true,
              showCustomUi: true
            }
          }
        },
        {
          updateDimensionProperties: {
            range: { sheetId: 0, dimension: "COLUMNS", startIndex: 21, endIndex: 23 },
            properties: { pixelSize: 150 },
            fields: "pixelSize"
          }
        }
      ]
    }
  });
  await updateSheetValues([{ range: `'${eventSheetName}'!V1:W1`, majorDimension: "ROWS", values: [["Event Status", "Officer RSVPs"]] }]);
}

async function loadEventOperationsWorkbook() {
  await ensureEventOperationsSchema();
  const query = new URLSearchParams({ majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
  [`'${eventSheetName}'!A1:W1000`, `'${treasurySheetName}'!A1:O1000`, `'${locationSheetName}'!A1:G250`]
    .forEach((range) => query.append("ranges", range));
  const response = await sheetsRequest(`/values:batchGet?${query}`);
  const [eventRange, treasuryRange, locationRange] = response.valueRanges || [];
  const [eventHeaders = [], ...eventRows] = eventRange?.values || [];
  const [treasuryHeaders = [], ...treasuryRows] = treasuryRange?.values || [];
  const [locationHeaders = [], ...locationRows] = locationRange?.values || [];
  const eventIndex = Object.fromEntries(eventHeaders.map((header, index) => [cleanText(header, 80), index]));
  const treasuryIndex = Object.fromEntries(treasuryHeaders.map((header, index) => [cleanText(header, 80), index]));
  const locationIndex = Object.fromEntries(locationHeaders.map((header, index) => [cleanText(header, 80), index]));
  const eventRowById = new Map();
  const blankStatuses = [];
  const events = eventRows.map((row, index) => {
    const date = normalizedSheetDate(row[eventIndex.Date]);
    const id = cleanText(row[eventIndex["Event ID"]], 100);
    if (!id || !date) return null;
    const status = normalizedEventStatus(row[eventIndex["Event Status"]], date);
    if (!row[eventIndex["Event Status"]]) blankStatuses.push({ row: index + 2, status });
    eventRowById.set(id, index + 2);
    return {
      id,
      row: index + 2,
      date,
      time: normalizedSheetTime(row[eventIndex.Time]),
      title: cleanText(row[eventIndex.Type], 120),
      location: cleanText(row[eventIndex.Location], 160),
      backupRoom: cleanText(row[eventIndex["Backup Room"]], 160),
      attendance: cleanText(row[eventIndex.Attendance], 24),
      permitStatus: cleanText(row[eventIndex["Permit (y/n)"]], 120),
      permitNumber: cleanText(row[eventIndex["Permit Number"]], 80),
      roomStatus: cleanText(row[eventIndex["Room Request"]], 120),
      backupRoomStatus: cleanText(row[eventIndex["Backup Room Request"]], 120),
      notes: cleanText(row[eventIndex.Notes], 1200),
      plannedBudget: sheetNumber(row[eventIndex["Event Budget"]]),
      actualSpend: sheetNumber(row[eventIndex["Actual Spend"]]),
      remainingBudget: sheetNumber(row[eventIndex["Remaining Budget"]]),
      fundingSource: cleanText(row[eventIndex["Funding Source"]], 160),
      budgetStatus: cleanText(row[eventIndex["Budget Status"]], 80),
      eventStatus: status,
      officerRsvps: cleanText(row[eventIndex["Officer RSVPs"]], 1000).split(",").map((name) => name.trim()).filter(Boolean)
    };
  }).filter(Boolean);

  if (blankStatuses.length) {
    await updateSheetValues(blankStatuses.map(({ row, status }) => ({ range: `'${eventSheetName}'!V${row}`, values: [[status]] })));
  }

  const budgetItems = treasuryRows.map((row, index) => {
    const eventId = cleanText(row[treasuryIndex["Event ID"]], 100);
    const item = cleanText(row[treasuryIndex.Item], 160);
    if (!eventId || !item) return null;
    return {
      row: index + 2,
      eventId,
      event: cleanText(row[treasuryIndex.Event], 120),
      date: normalizedSheetDate(row[treasuryIndex.Date]),
      item,
      quantity: sheetNumber(row[treasuryIndex.Quantity]),
      unit: cleanText(row[treasuryIndex.Unit], 40),
      unitCost: sheetNumber(row[treasuryIndex["Unit Cost"]]),
      plannedCost: sheetNumber(row[treasuryIndex["Planned Cost"]]),
      actualCost: sheetNumber(row[treasuryIndex["Actual Cost"]]),
      fundingSource: cleanText(row[treasuryIndex["Funding Source"]], 120),
      status: cleanText(row[treasuryIndex.Status], 80),
      notes: cleanText(row[treasuryIndex.Notes], 800)
    };
  }).filter(Boolean);
  const summaries = Object.fromEntries(treasuryRows
    .filter((row) => row[treasuryIndex["Budget Summary"]])
    .map((row) => [cleanText(row[treasuryIndex["Budget Summary"]], 80), sheetNumber(row[treasuryIndex.Amount])]));
  const locationRecords = locationRows.map((row) => ({
    name: cleanText(row[locationIndex.Location], 160),
    address: cleanText(row[locationIndex.Address], 220),
    lat: sheetNumber(row[locationIndex.Latitude]),
    lng: sheetNumber(row[locationIndex.Longitude])
  })).filter((location) => location.name && Number.isFinite(location.lat) && Number.isFinite(location.lng));
  const locations = locationRecords.map((location) => location.name);
  return { events, budgetItems, summaries, locations, locationRecords, eventRowById, treasuryRows };
}

function coordinatesForEvent(event = {}, locationRecords = []) {
  const source = cleanText(event.location, 180).toLowerCase();
  if (!source) return null;
  const aliases = [
    [/reitz/, "Reitz Student Union"],
    [/larsen/, "Larsen Hall"],
    [/marston/, "Marston Science Library"],
    [/malachowsky/, "Malachowsky Hall"],
    [/newell/, "Newell Hall"],
    [/pugh/, "Pugh Hall"],
    [/turlington/, "Turlington Hall"],
    [/little/, "Little Hall"],
    [/weil/, "Weil Hall"],
    [/smathers/, "Smathers Library"],
    [/^(campus|uf|university of florida)$/i, "University of Florida"]
  ];
  const alias = aliases.find(([pattern]) => pattern.test(source))?.[1] || "";
  const match = locationRecords.find((location) =>
    location.name.toLowerCase() === source ||
    source.includes(location.name.toLowerCase()) ||
    location.name === alias
  );
  if (!match) return null;
  return { lat: match.lat, lng: match.lng, name: match.name };
}

export function leadershipRowsFromValues(values = []) {
  const [headers = [], ...rows] = values;
  const headerIndex = Object.fromEntries(headers.map((header, index) => [cleanText(header, 80).toLowerCase(), index]));
  return rows.map((row, index) => ({
    row: index + 2,
    name: cleanText(row[headerIndex["officer name"]], 80),
    title: cleanText(row[headerIndex.title] ?? row[headerIndex.role], 80),
    linkedUid: cleanText(row[headerIndex["linked account"] ?? headerIndex["ufid fingerprint"]], 160),
    active: /^(yes|true|1|active)$/i.test(cleanText(row[headerIndex.active], 12)),
    note: cleanText(row[headerIndex["security note"]], 160)
  })).filter((entry) => entry.name && entry.title);
}

async function loadLeadershipRows() {
  return leadershipRowsFromValues(await getSheetValues(`'${officerRosterSheetName}'!A1:E250`));
}

function pendingLeadershipSlots(rows = []) {
  return rows
    .filter((entry) => !entry.active && !entry.linkedUid)
    .map(({ row, name, title }) => ({ row, name, title }));
}

// The whole Current Leadership tab, minus the linked account ids, so officers can
// see every seat rather than only the ones still waiting on an account.
export function leadershipRosterFromRows(rows = []) {
  return rows.map(({ row, name, title, active, linkedUid }) => ({
    row,
    name,
    title,
    active,
    linked: Boolean(linkedUid),
    pending: !active && !linkedUid
  }));
}

// Roles live in Firestore and nowhere else. A stored leadership seat outranks a
// plain officer grant; anything unrecognized falls back to a normal member.
export function resolvedAccess(existing = {}) {
  const leadership = leadershipForStoredValue(existing.leadership);
  if (leadership) {
    return {
      role: "officer",
      leadership,
      officerTitle: cleanText(existing.officerTitle || leadershipTitle(leadership), 80),
      canManageOfficers: leadership === "president" || leadership === "treasurer"
    };
  }
  if (existing.roleOverride === "officer") {
    return { role: "officer", leadership: "", officerTitle: cleanText(existing.officerTitle || "Officer", 80), canManageOfficers: false };
  }
  return { role: "member", leadership: "", officerTitle: "", canManageOfficers: false };
}

async function setAccessClaims(userRecord, access) {
  const nextClaims = {
    ...(userRecord.customClaims || {}),
    role: access.role,
    leadership: access.leadership,
    manageOfficers: access.canManageOfficers,
    admin: false
  };
  if (userRecord.customClaims?.role !== nextClaims.role
    || userRecord.customClaims?.leadership !== nextClaims.leadership
    || userRecord.customClaims?.manageOfficers !== nextClaims.manageOfficers
    || userRecord.customClaims?.admin !== false) {
    await auth.setCustomUserClaims(userRecord.uid, nextClaims);
  }
}

function requireOfficerManager(request) {
  const caller = requireAuth(request);
  if (!canManageOfficerRoles(caller.token)) {
    throw new HttpsError("permission-denied", "Only the President or Treasurer can change officer roles.");
  }
  return caller;
}

function requireOfficer(request) {
  const caller = requireAuth(request);
  if (caller.token.role !== "officer" && !canManageOfficerRoles(caller.token)) {
    throw new HttpsError("permission-denied", "Officer access is required.");
  }
  return caller;
}

function relyingParty(request) {
  const origin = cleanText(request.rawRequest?.headers?.origin, 240);
  const rpID = allowedOrigins.get(origin);
  if (!rpID) throw new HttpsError("permission-denied", "This site is not approved for passkeys.");
  return { origin, rpID };
}

function publicProfile(uid, data = {}) {
  const checkedInEvents = uniqueEventIds(data.checkedInEvents);
  return {
    uid,
    displayName: cleanText(data.displayName || "FQC Member", 80),
    email: cleanText(data.email, 180),
    photoURL: cleanText(data.photoURL, 500),
    role: profileRole(data.role),
    leadership: ["president", "vice_president", "treasurer"].includes(data.leadership) ? data.leadership : "",
    officerTitle: cleanText(data.officerTitle, 80),
    canManageOfficers: data.canManageOfficers === true,
    checkedInEvents,
    points: pointsForEvents(checkedInEvents),
    passkeyCount: Number(data.passkeyCount) || 0
  };
}

async function ensureProfileForUser(userRecord) {
  const userRef = db.collection("users").doc(userRecord.uid);
  const snapshot = await userRef.get();
  const existing = snapshot.exists ? snapshot.data() : {};
  if (!snapshot.exists) assertEligibleSignupEmail(userRecord.email);
  const access = resolvedAccess(existing);
  const data = {
    username: usernameForInput(existing.username),
    displayName: cleanText(existing.displayName || userRecord.displayName || userRecord.email?.split("@")[0] || "FQC Member", 80),
    email: cleanText(userRecord.email, 180),
    photoURL: cleanText(userRecord.photoURL, 500),
    ...access,
    checkedInEvents: uniqueEventIds(existing.checkedInEvents),
    points: pointsForEvents(existing.checkedInEvents),
    passkeyCount: Number(existing.passkeyCount) || 0,
    createdAt: existing.createdAt || FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp()
  };

  await userRef.set(data, { merge: true });
  await setAccessClaims(userRecord, access);
  await syncLeaderboardProfile(userRecord.uid, data);
  return publicProfile(userRecord.uid, data);
}

export const ensureUserProfile = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const userRecord = await auth.getUser(caller.uid);
  return ensureProfileForUser(userRecord);
});

export const checkUsernameAvailability = onCall(callableOptions, async (request) => {
  const username = usernameForInput(request.data?.username);
  if (!username) throw new HttpsError("invalid-argument", "Use 3–24 letters, numbers, periods, or underscores.");
  const snapshot = await db.collection("usernameDirectory").doc(username).get();
  return { username, available: !snapshot.exists };
});

export const claimUsername = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const username = usernameForInput(request.data?.username);
  if (!username) throw new HttpsError("invalid-argument", "Use 3–24 letters, numbers, periods, or underscores.");
  const usernameRef = db.collection("usernameDirectory").doc(username);
  const userRef = db.collection("users").doc(caller.uid);
  if (!(await userRef.get()).exists) assertEligibleSignupEmail(caller.token.email);
  await db.runTransaction(async (transaction) => {
    const [usernameSnapshot, userSnapshot] = await Promise.all([
      transaction.get(usernameRef),
      transaction.get(userRef)
    ]);
    if (usernameSnapshot.exists && usernameSnapshot.data()?.uid !== caller.uid) {
      throw new HttpsError("already-exists", "That username is already taken.");
    }
    const previous = usernameForInput(userSnapshot.data()?.username);
    if (previous && previous !== username) transaction.delete(db.collection("usernameDirectory").doc(previous));
    transaction.set(usernameRef, { uid: caller.uid, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(userRef, { username, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  await auth.updateUser(caller.uid, { displayName: username });
  return { username };
});

export const resolveLoginIdentifier = onCall(callableOptions, async (request) => {
  const identifier = cleanText(request.data?.identifier, 180).toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return { email: identifier };
  const username = usernameForInput(identifier);
  if (!username) throw new HttpsError("not-found", "The username or password is incorrect.");
  const snapshot = await db.collection("usernameDirectory").doc(username).get();
  const uid = cleanText(snapshot.data()?.uid, 160);
  if (!uid) throw new HttpsError("not-found", "The username or password is incorrect.");
  const userRecord = await auth.getUser(uid);
  if (!userRecord.email) throw new HttpsError("not-found", "The username or password is incorrect.");
  return { email: userRecord.email };
});

export const updateUserProfile = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const displayName = cleanText(request.data?.displayName, maxDisplayNameLength);
  if (displayName.length < 2) throw new HttpsError("invalid-argument", `Use 2 to ${maxDisplayNameLength} characters for your display name.`);

  // Any characters are fine; the only rule is that nobody else holds the name.
  const key = displayNameKey(displayName);
  const nameRef = db.collection("displayNameDirectory").doc(key);
  const userRef = db.collection("users").doc(caller.uid);
  await db.runTransaction(async (transaction) => {
    const [nameSnapshot, userSnapshot] = await Promise.all([
      transaction.get(nameRef),
      transaction.get(userRef)
    ]);
    const owner = cleanText(nameSnapshot.data()?.uid, 160);
    if (owner && owner !== caller.uid) {
      throw new HttpsError("already-exists", "Another member is already using that display name.");
    }
    const previous = displayNameKey(cleanText(userSnapshot.data()?.displayName, maxDisplayNameLength));
    if (previous && previous !== key) transaction.delete(db.collection("displayNameDirectory").doc(previous));
    transaction.set(nameRef, { uid: caller.uid, displayName, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(userRef, { displayName, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  await auth.updateUser(caller.uid, { displayName });
  const snapshot = await db.collection("users").doc(caller.uid).get();
  const profile = snapshot.data() || {};
  await syncLeaderboardProfile(caller.uid, profile);
  try {
    await syncExistingMasterMemberProfile(caller.uid, profile);
  } catch (error) {
    console.error("Master Members profile sync failed", error);
  }
  return publicProfile(caller.uid, profile);
});

export const listMembers = onCall(callableOptions, async (request) => {
  requireOfficer(request);
  const [snapshot, leadershipRows] = await Promise.all([
    db.collection("users").orderBy("displayName").limit(250).get(),
    loadLeadershipRows()
  ]);
  return {
    members: snapshot.docs.map((doc) => publicProfile(doc.id, doc.data())),
    leadershipSlots: pendingLeadershipSlots(leadershipRows),
    leadershipRoster: leadershipRosterFromRows(leadershipRows)
  };
});

export const getOfficerResources = onCall(callableOptions, (request) => {
  requireOfficer(request);
  return { resources: officerResourceCatalog };
});

function eventFormData(value = {}) {
  const date = normalizedSheetDate(value.date);
  const title = cleanText(value.title, 120);
  const time = normalizedSheetTime(value.time);
  const location = cleanText(value.location, 160);
  if (!date || !title || !time || !location) {
    throw new HttpsError("invalid-argument", "Date, time, event name, and location are required.");
  }
  return {
    date,
    title,
    time,
    location,
    backupRoom: cleanText(value.backupRoom, 160),
    attendance: cleanText(value.attendance, 24),
    roomStatus: cleanText(value.roomStatus, 120),
    backupRoomStatus: cleanText(value.backupRoomStatus, 120),
    notes: cleanText(value.notes, 1200),
    eventStatus: normalizedEventStatus(value.eventStatus, date)
  };
}

function eventIdFor(date, title) {
  const slug = cleanText(title, 120).toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 52);
  return `fqc-${date}-${slug}`;
}

function eventRowValues(event, row) {
  return [
    event.date,
    event.time,
    event.title,
    event.location,
    event.backupRoom,
    event.attendance,
    "",
    "",
    "",
    "",
    event.roomStatus,
    event.backupRoomStatus,
    "",
    "",
    event.notes,
    `=IF(OR(A${row}="",C${row}=""),"","fqc-"&TEXT(A${row},"yyyy-mm-dd")&"-"&LEFT(LOWER(REGEXREPLACE(REGEXREPLACE(TRIM(C${row}),"[^A-Za-z0-9]+","-"),"(^-|-$)","")),52))`,
    `=IF(P${row}="","",SUMIF('${treasurySheetName}'!$A$2:$A,P${row},'${treasurySheetName}'!$H$2:$H))`,
    `=IF(P${row}="","",SUMIF('${treasurySheetName}'!$A$2:$A,P${row},'${treasurySheetName}'!$I$2:$I))`,
    `=IF(P${row}="","",Q${row}-R${row})`,
    `=IF(P${row}="","",IFERROR(TEXTJOIN(", ",TRUE,UNIQUE(FILTER('${treasurySheetName}'!$J$2:$J,'${treasurySheetName}'!$A$2:$A=P${row},'${treasurySheetName}'!$J$2:$J<>""))),""))`,
    `=IF(P${row}="","",IF(Q${row}=0,"No plan",IF(R${row}>Q${row},"Over budget",IF(R${row}=Q${row},"Complete",IF(R${row}=0,"Planned","In progress")))))`,
    event.eventStatus,
    ""
  ];
}

function rsvpEntriesForEvent(rsvpData = {}, eventId) {
  const entries = rsvpData?.byEvent?.[eventId];
  return Array.isArray(entries) ? entries.slice(0, 300) : [];
}

export const getOfficerEventOperations = onCall(callableOptions, async (request) => {
  requireOfficer(request);
  const [workbook, rsvpSnapshot] = await Promise.all([
    loadEventOperationsWorkbook(),
    db.collection("system").doc("eventRsvps").get()
  ]);
  await syncMasterMemberEventHeaders(workbook);
  const rsvpData = rsvpSnapshot.data() || {};
  return {
    events: workbook.events.map((event) => ({
      ...event,
      rsvps: rsvpEntriesForEvent(rsvpData, event.id),
      officerRsvps: rsvpEntriesForEvent(rsvpData, event.id)
        .filter((entry) => entry.role === "officer")
        .map((entry) => entry.displayName)
    })),
    budgetItems: workbook.budgetItems,
    totals: {
      baseFunding: workbook.summaries["Base Funding"] || 0,
      operationalFunding: workbook.summaries["Operational Funding"] || 0,
      totalApproved: workbook.summaries["Total Approved"] || 0,
      plannedSpend: workbook.summaries["Planned Spend"] || 0,
      actualSpend: workbook.summaries["Actual Spend"] || 0,
      availableAfterActual: workbook.summaries["Available After Actual"] || 0,
      uncommittedAfterPlan: workbook.summaries["Uncommitted After Plan"] || 0
    },
    locations: workbook.locations,
    updatedAt: new Date().toISOString()
  };
});

export const saveOfficerEvent = onCall(callableOptions, async (request) => {
  const caller = requireOfficer(request);
  const input = eventFormData(request.data?.event);
  const requestedId = cleanText(request.data?.event?.id, 100);
  const workbook = await loadEventOperationsWorkbook();
  const existingRow = requestedId ? workbook.eventRowById.get(requestedId) : null;
  let row = existingRow;
  if (existingRow) {
    const updates = [
      ["A", input.date], ["B", input.time], ["C", input.title], ["D", input.location], ["E", input.backupRoom],
      ["F", input.attendance], ["K", input.roomStatus], ["L", input.backupRoomStatus], ["O", input.notes], ["P", requestedId], ["V", input.eventStatus]
    ].map(([column, value]) => ({ range: `'${eventSheetName}'!${column}${existingRow}`, values: [[value]] }));
    await updateSheetValues(updates);
  } else {
    row = Math.max(1, ...workbook.events.map((event) => event.row)) + 1;
    await updateSheetValues([{ range: `'${eventSheetName}'!A${row}:W${row}`, values: [eventRowValues(input, row)] }]);
  }
  const savedEvent = {
    ...input,
    id: requestedId || eventIdFor(input.date, input.title),
    row
  };
  const existingIndex = workbook.events.findIndex((event) => event.id === requestedId);
  if (existingIndex >= 0) workbook.events[existingIndex] = { ...workbook.events[existingIndex], ...savedEvent };
  else workbook.events.push(savedEvent);
  await syncMasterMemberEventHeaders(workbook);
  await db.collection("eventOperationsAudit").add({
    action: existingRow ? "event-updated" : "event-created",
    eventId: requestedId || "generated-in-sheet",
    row,
    updatedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  });
  return { saved: true, row };
});

export function budgetItemData(value = {}) {
  const eventId = cleanText(value.eventId, 100);
  const event = cleanText(value.event, 120);
  const date = normalizedSheetDate(value.date);
  const item = cleanText(value.item, 160);
  if (!isSafeEventId(eventId) || !event || !date || !item) {
    throw new HttpsError("invalid-argument", "Choose an event and enter a budget item name.");
  }
  return {
    eventId,
    event,
    date,
    item,
    quantity: Math.max(0, sheetNumber(value.quantity)),
    unit: cleanText(value.unit, 40),
    unitCost: Math.max(0, sheetNumber(value.unitCost)),
    actualCost: Math.max(0, sheetNumber(value.actualCost)),
    fundingSource: cleanText(value.fundingSource, 120),
    status: cleanText(value.status, 80) || "Estimate",
    notes: cleanText(value.notes, 800)
  };
}

export const saveOfficerBudgetItem = onCall(callableOptions, async (request) => {
  const caller = requireOfficer(request);
  const input = budgetItemData(request.data?.item);
  const workbook = await loadEventOperationsWorkbook();
  if (!workbook.eventRowById.has(input.eventId)) throw new HttpsError("not-found", "That event is no longer in the workbook.");
  const requestedRow = Math.trunc(Number(request.data?.item?.row) || 0);
  const existing = requestedRow > 1 ? workbook.budgetItems.find((item) => item.row === requestedRow) : null;
  if (requestedRow && (!existing || existing.eventId !== input.eventId)) {
    throw new HttpsError("failed-precondition", "That budget row changed. Refresh and try again.");
  }
  const row = existing ? existing.row : Math.max(1, workbook.treasuryRows.length + 1) + 1;
  const values = [[
    input.eventId,
    input.event,
    input.date,
    input.item,
    input.quantity || "",
    input.unit,
    input.unitCost || "",
    `=IF(OR(E${row}="",G${row}=""),"",E${row}*G${row})`,
    input.actualCost || "",
    input.fundingSource,
    input.status,
    input.notes
  ]];
  await updateSheetValues([{ range: `'${treasurySheetName}'!A${row}:L${row}`, values }]);
  await db.collection("eventOperationsAudit").add({
    action: existing ? "budget-item-updated" : "budget-item-created",
    eventId: input.eventId,
    row,
    updatedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  });
  return { saved: true, row };
});

export const deleteOfficerBudgetItem = onCall(callableOptions, async (request) => {
  const caller = requireOfficer(request);
  const row = Math.trunc(Number(request.data?.row) || 0);
  if (row < 2) throw new HttpsError("invalid-argument", "Choose a saved budget line to remove.");
  const workbook = await loadEventOperationsWorkbook();
  const existing = workbook.budgetItems.find((item) => item.row === row);
  if (!existing) throw new HttpsError("not-found", "That budget line is already gone. Refresh and try again.");
  await updateSheetValues([{ range: `'${treasurySheetName}'!A${row}:L${row}`, values: [Array(12).fill("")] }]);
  await db.collection("eventOperationsAudit").add({
    action: "budget-item-removed",
    eventId: existing.eventId,
    item: existing.item,
    row,
    updatedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  });
  return { removed: true, row };
});

export const removeMember = onCall(callableOptions, async (request) => {
  const caller = requireOfficerManager(request);
  const uid = cleanText(request.data?.uid, 160);
  if (!uid) throw new HttpsError("invalid-argument", "Choose a member to remove.");
  if (uid === caller.uid) throw new HttpsError("failed-precondition", "You cannot remove your own account.");

  const userRef = db.collection("users").doc(uid);
  const guardSnapshot = await userRef.get();
  const guardUser = await auth.getUser(uid).catch(() => null);
  if (guardSnapshot.data()?.leadership || guardUser?.customClaims?.leadership) {
    throw new HttpsError("failed-precondition", "Open that leadership seat before removing the account.");
  }
  const [targetSnapshot, targetUser] = await Promise.all([
    userRef.get(),
    auth.getUser(uid).catch(() => null)
  ]);
  const targetData = targetSnapshot.data() || {};
  if (targetData.leadership || targetUser?.customClaims?.leadership) {
    throw new HttpsError("failed-precondition", "President, Vice President, and Treasurer accounts are protected.");
  }

  const displayName = cleanText(targetData.displayName || targetUser?.displayName || "FQC Member", 80);
  const batch = db.batch();
  const [passkeys, credentials] = await Promise.all([
    userRef.collection("passkeys").get(),
    db.collection("passkeyCredentials").where("uid", "==", uid).get()
  ]);
  passkeys.docs.forEach((doc) => batch.delete(doc.ref));
  credentials.docs.forEach((doc) => batch.delete(doc.ref));
  uniqueEventIds(targetData.checkedInEvents)
    .forEach((eventId) => batch.delete(db.collection("events").doc(eventId).collection("checkins").doc(uid)));
  const username = usernameForInput(targetData.username);
  if (username) batch.delete(db.collection("usernameDirectory").doc(username));
  const nameKey = displayNameKey(targetData.displayName);
  if (nameKey) batch.delete(db.collection("displayNameDirectory").doc(nameKey));
  batch.delete(userRef);
  await batch.commit();

  await db.runTransaction(async (transaction) => {
    const leaderboardRef = db.collection("system").doc("leaderboardData");
    const rsvpRef = db.collection("system").doc("eventRsvps");
    const [leaderboardSnapshot, rsvpSnapshot] = await Promise.all([
      transaction.get(leaderboardRef),
      transaction.get(rsvpRef)
    ]);
    const entries = (leaderboardSnapshot.data()?.entries || []).filter((entry) => entry?.uid !== uid);
    transaction.set(leaderboardRef, {
      entries,
      participantCount: entries.length,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    const byEvent = { ...(rsvpSnapshot.data()?.byEvent || {}) };
    for (const eventId of Object.keys(byEvent)) {
      byEvent[eventId] = (byEvent[eventId] || []).filter((entry) => entry?.uid !== uid);
    }
    transaction.set(rsvpRef, { byEvent, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  if (targetUser) await auth.deleteUser(uid);

  await db.collection("officerRosterAudit").add({
    action: "member-removed",
    targetUid: uid,
    displayName,
    removedBy: caller.uid,
    removedAt: FieldValue.serverTimestamp()
  });
  return { removed: true, uid, displayName };
});

export const setEventRsvp = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const eventId = cleanText(request.data?.eventId, 100);
  const going = request.data?.going === true;
  if (!isSafeEventId(eventId)) throw new HttpsError("invalid-argument", "Choose a valid event.");
  const aggregateRef = db.collection("system").doc("eventRsvps");
  const userRef = db.collection("users").doc(caller.uid);
  const result = await db.runTransaction(async (transaction) => {
    const [aggregateSnapshot, userSnapshot] = await Promise.all([
      transaction.get(aggregateRef),
      transaction.get(userRef)
    ]);
    const data = aggregateSnapshot.data() || {};
    const byEvent = { ...(data.byEvent || {}) };
    const current = rsvpEntriesForEvent(data, eventId).filter((entry) => entry.uid !== caller.uid);
    const profile = userSnapshot.data() || {};
    if (going) {
      current.push({
        uid: caller.uid,
        displayName: cleanText(profile.displayName || caller.token.name || caller.token.email || "FQC Member", 80),
        role: profileRole(profile.role || caller.token.role)
      });
    }
    byEvent[eventId] = current.slice(0, 300);
    transaction.set(aggregateRef, { byEvent, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { entries: byEvent[eventId], role: profileRole(profile.role || caller.token.role) };
  });

  if (result.role === "officer") {
    try {
      const workbook = await loadEventOperationsWorkbook();
      const row = workbook.eventRowById.get(eventId);
      if (row) {
        const names = result.entries.filter((entry) => entry.role === "officer").map((entry) => entry.displayName).join(", ");
        await updateSheetValues([{ range: `'${eventSheetName}'!W${row}`, values: [[names]] }]);
      }
    } catch (error) {
      console.error("Officer RSVP sheet sync failed", error);
    }
  }
  return { eventId, going, entries: result.entries };
});

export const setMemberRole = onCall(callableOptions, async (request) => {
  const caller = requireOfficer(request);
  const uid = cleanText(request.data?.uid, 160);
  const role = profileRole(request.data?.role);
  if (!uid) throw new HttpsError("invalid-argument", "Choose a member.");
  const [targetUser, targetSnapshot] = await Promise.all([
    auth.getUser(uid),
    db.collection("users").doc(uid).get()
  ]);
  const targetData = targetSnapshot.data() || {};
  if (targetData.leadership || targetUser.customClaims?.leadership) {
    throw new HttpsError("failed-precondition", "President, Vice President, and Treasurer roles are protected.");
  }
  if (role === "member" && !canManageOfficerRoles(caller.token)) {
    throw new HttpsError("permission-denied", "Only the President or Treasurer can remove an officer role.");
  }
  if (uid === caller.uid) throw new HttpsError("failed-precondition", "Choose another member.");
  const claims = {
    ...(targetUser.customClaims || {}),
    role,
    leadership: "",
    manageOfficers: false,
    admin: false
  };
  const batch = db.batch();
  batch.set(db.collection("users").doc(uid), {
    role,
    leadership: "",
    officerTitle: role === "officer" ? "Officer" : "",
    canManageOfficers: false,
    roleOverride: role,
    roleUpdatedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await Promise.all([auth.setCustomUserClaims(uid, claims), batch.commit()]);
  const updatedProfile = { ...targetData, role, officerTitle: role === "officer" ? "Officer" : "" };
  await syncLeaderboardProfile(uid, updatedProfile);
  try {
    await syncExistingMasterMemberProfile(uid, updatedProfile);
  } catch (error) {
    console.error("Master Members officer title sync failed", error);
  }
  await db.collection("officerRosterAudit").add({
    action: role === "officer" ? "officer-granted" : "officer-revoked",
    targetUid: uid,
    updatedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  });
  return { uid, role, leadership: "", canManageOfficers: false };
});

export const assignMemberLeadership = onCall(callableOptions, async (request) => {
  const caller = requireOfficerManager(request);
  const uid = cleanText(request.data?.uid, 160);
  const row = Number(request.data?.row);
  if (!uid || !Number.isInteger(row) || row < 2 || row > 250) {
    throw new HttpsError("invalid-argument", "Choose a pending leadership role and a member account.");
  }

  const [targetUser, targetSnapshot, leadershipRows] = await Promise.all([
    auth.getUser(uid),
    db.collection("users").doc(uid).get(),
    loadLeadershipRows()
  ]);
  const targetData = targetSnapshot.data() || {};
  const slot = leadershipRows.find((entry) => entry.row === row);
  // Holding a different seat is a conflict. Re-linking the seat someone already
  // holds is a repair, and has to stay possible when the sheet drifts from Firestore.
  if (targetData.leadership && slot && targetData.leadership !== leadershipForRole(slot.title)) {
    throw new HttpsError("failed-precondition", "That account already holds a different leadership seat. Open that seat first.");
  }
  if (!slot || slot.active || slot.linkedUid) {
    throw new HttpsError("failed-precondition", "That leadership role is no longer pending. Refresh the roster.");
  }
  if (leadershipRows.some((entry) => entry.row !== row && entry.linkedUid === uid)) {
    throw new HttpsError("already-exists", "That account is already linked to another leadership role.");
  }

  const access = resolvedAccess({
    leadership: leadershipForRole(slot.title),
    roleOverride: "officer",
    officerTitle: slot.title
  });
  await updateSheetValues([
    { range: `'${officerRosterSheetName}'!B1`, values: [["Linked Account"]] },
    { range: `'${officerRosterSheetName}'!B${row}`, values: [[uid]] },
    { range: `'${officerRosterSheetName}'!D${row}:E${row}`, values: [["Yes", "Linked through officer management"]] }
  ]);

  const updatedProfile = {
    ...targetData,
    ...access,
    roleOverride: "officer",
    roleUpdatedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  };
  await Promise.all([
    db.collection("users").doc(uid).set(updatedProfile, { merge: true }),
    setAccessClaims(targetUser, access)
  ]);
  const synchronizedProfile = { ...targetData, ...access };
  await syncLeaderboardProfile(uid, synchronizedProfile);
  try {
    await syncExistingMasterMemberProfile(uid, synchronizedProfile);
  } catch (error) {
    console.error("Master Members leadership sync failed", error);
  }
  await db.collection("officerRosterAudit").add({
    action: "leadership-slot-linked",
    targetUid: uid,
    leadershipRow: row,
    officerName: slot.name,
    officerTitle: slot.title,
    updatedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  });
  return { profile: publicProfile(uid, synchronizedProfile), slot: { row, name: slot.name, title: slot.title } };
});

// Who currently holds a seat. Column B records the account id for seats linked
// through the app; seats linked before that fall back to a lookup by the role
// the sheet lists, then to a uid the caller supplies.
async function leadershipSeatHolder(slot, requestedUid = "") {
  if (requestedUid) return requestedUid;
  const columnUid = /^[a-f0-9]{64}$/.test(slot.linkedUid) ? "" : slot.linkedUid;
  if (columnUid) return columnUid;
  const leadership = leadershipForRole(slot.title);
  const query = leadership
    ? db.collection("users").where("leadership", "==", leadership)
    : db.collection("users").where("officerTitle", "==", slot.title);
  const snapshot = await query.limit(2).get();
  if (snapshot.size === 1) return snapshot.docs[0].id;
  return requestedUid;
}

async function remainingOfficerManagers(excludedUid) {
  const snapshot = await db.collection("users").where("canManageOfficers", "==", true).limit(10).get();
  return snapshot.docs.filter((doc) => doc.id !== excludedUid).length;
}

// Opening a seat clears it on the Current Leadership tab and drops the holder to
// a plain officer. The President or Treasurer can demote them the rest of the way
// afterwards; ending a term should not silently remove someone from the team.
export const unassignMemberLeadership = onCall(callableOptions, async (request) => {
  const caller = requireOfficerManager(request);
  const row = Number(request.data?.row);
  if (!Number.isInteger(row) || row < 2 || row > 250) {
    throw new HttpsError("invalid-argument", "Choose a leadership seat to open.");
  }
  const leadershipRows = await loadLeadershipRows();
  const slot = leadershipRows.find((entry) => entry.row === row);
  if (!slot) throw new HttpsError("not-found", "That leadership row is no longer in the sheet. Refresh the roster.");
  if (!slot.active && !slot.linkedUid) throw new HttpsError("failed-precondition", "That seat is already open.");

  const uid = await leadershipSeatHolder(slot, cleanText(request.data?.uid, 160));
  if (uid && uid === caller.uid) {
    throw new HttpsError("failed-precondition", "Ask the other manager to open your own seat.");
  }
  if (uid && canManageOfficerRoles({ leadership: leadershipForRole(slot.title) })
    && await remainingOfficerManagers(uid) === 0) {
    throw new HttpsError("failed-precondition", "Link another President or Treasurer before opening this seat, or the club loses officer management.");
  }

  await updateSheetValues([
    { range: `'${officerRosterSheetName}'!B1`, values: [["Linked Account"]] },
    { range: `'${officerRosterSheetName}'!B${row}`, values: [[""]] },
    { range: `'${officerRosterSheetName}'!D${row}:E${row}`, values: [["No", "Seat opened through officer management"]] }
  ]);

  const holderSnapshot = uid ? await db.collection("users").doc(uid).get() : null;
  // Only step an actual officer down. Naming an account that is already a member
  // must never quietly promote them.
  if (uid && holderSnapshot?.data()?.role === "officer") {
    const targetUser = await auth.getUser(uid);
    const targetData = holderSnapshot.data() || {};
    const access = resolvedAccess({ roleOverride: "officer", officerTitle: "Officer" });
    const updatedProfile = { ...targetData, ...access, roleOverride: "officer", roleUpdatedBy: caller.uid, updatedAt: FieldValue.serverTimestamp() };
    await Promise.all([
      db.collection("users").doc(uid).set(updatedProfile, { merge: true }),
      setAccessClaims(targetUser, access)
    ]);
    await syncLeaderboardProfile(uid, { ...targetData, ...access });
    try {
      await syncExistingMasterMemberProfile(uid, { ...targetData, ...access });
    } catch (error) {
      console.error("Master Members leadership removal sync failed", error);
    }
  }

  await db.collection("officerRosterAudit").add({
    action: "leadership-slot-opened",
    targetUid: uid || "",
    leadershipRow: row,
    officerName: slot.name,
    officerTitle: slot.title,
    updatedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  });
  return { row, uid, demoted: Boolean(uid) };
});

function normalizedClientLocation(value = {}) {
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function requireNearbyLocation(checkIn = {}, requestLocation = {}) {
  if (checkIn.requireLocation === false) return false;
  const eventLocation = normalizedClientLocation({ lat: checkIn.eventLat, lng: checkIn.eventLng });
  if (!eventLocation) {
    throw new HttpsError("failed-precondition", "This event does not have a mapped UF location. An officer can fix the event location or turn off location verification for an online event.");
  }
  const memberLocation = normalizedClientLocation(requestLocation);
  if (!memberLocation) {
    throw new HttpsError("failed-precondition", "Location is required for this check-in. Allow location access and try again.");
  }
  if (distanceMilesBetween(memberLocation, eventLocation) > maxCheckInDistanceMiles) {
    throw new HttpsError("out-of-range", "You must be within 2 miles of the event location to check in.");
  }
  return true;
}

export const setActiveCheckIn = onCall(callableOptions, async (request) => {
  const caller = requireOfficer(request);
  const eventId = cleanText(request.data?.eventId, 100);
  const open = request.data?.open === true;
  if (open && !eventId) throw new HttpsError("invalid-argument", "Choose an event.");
  const current = await db.collection("settings").doc("checkin").get();
  const requireLocation = current.data()?.requireLocation !== false;
  const checkIn = {
    eventId,
    open,
    updatedBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (open) {
    const workbook = await loadEventOperationsWorkbook();
    const event = workbook.events.find((entry) => entry.id === eventId);
    if (!event) throw new HttpsError("not-found", "That event is no longer in the 2026 Event Logistics Sheet.");
    const coordinates = coordinatesForEvent(event, workbook.locationRecords);
    if (requireLocation && !coordinates) {
      throw new HttpsError("failed-precondition", "This event needs a mapped UF location before check-in can open. Update its location, or turn off location verification in Settings for an online event.");
    }
    Object.assign(checkIn, {
      eventTitle: event.title,
      eventLocation: event.location,
      eventLat: coordinates?.lat ?? null,
      eventLng: coordinates?.lng ?? null
    });
  }
  await db.collection("settings").doc("checkin").set(checkIn, { merge: true });
  return { eventId, open, requireLocation };
});

export const setCheckInLocationRequirement = onCall(callableOptions, async (request) => {
  const caller = requireOfficer(request);
  const requireLocation = request.data?.requireLocation !== false;
  const settingRef = db.collection("settings").doc("checkin");
  const current = await settingRef.get();
  const checkIn = current.data() || {};
  if (requireLocation && checkIn.open === true && !normalizedClientLocation({ lat: checkIn.eventLat, lng: checkIn.eventLng })) {
    throw new HttpsError("failed-precondition", "The current event has no mapped UF location. Close it or update the event location before turning verification on.");
  }
  await settingRef.set({ requireLocation, updatedBy: caller.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { requireLocation };
});

export const recordEventCheckIn = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const settingRef = db.collection("settings").doc("checkin");
  const userRef = db.collection("users").doc(caller.uid);
  const leaderboardRef = db.collection("system").doc("leaderboardData");
  const checkedInAt = new Date().toISOString();
  const preflightSnapshot = await settingRef.get();
  const preflight = preflightSnapshot.data() || {};
  if (preflight.open === true && preflight.eventId && preflight.requireLocation !== false &&
    !normalizedClientLocation({ lat: preflight.eventLat, lng: preflight.eventLng })) {
    const workbook = await loadEventOperationsWorkbook();
    const event = workbook.events.find((entry) => entry.id === cleanText(preflight.eventId, 100));
    const coordinates = event ? coordinatesForEvent(event, workbook.locationRecords) : null;
    if (coordinates) {
      await settingRef.set({
        eventTitle: event.title,
        eventLocation: event.location,
        eventLat: coordinates.lat,
        eventLng: coordinates.lng,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  const result = await db.runTransaction(async (transaction) => {
    const setting = await transaction.get(settingRef);
    const checkIn = setting.data() || {};
    if (checkIn.open !== true || !checkIn.eventId) {
      throw new HttpsError("failed-precondition", "Event check-in is not open.");
    }
    const locationVerified = requireNearbyLocation(checkIn, request.data?.location);

    const eventId = cleanText(checkIn.eventId, 100);
    const checkInRef = db.collection("events").doc(eventId).collection("checkins").doc(caller.uid);
    const checkInSnapshot = await transaction.get(checkInRef);
    const userSnapshot = await transaction.get(userRef);
    const leaderboardSnapshot = await transaction.get(leaderboardRef);
    const userData = userSnapshot.data() || {};
    const currentEvents = uniqueEventIds(userData.checkedInEvents);
    const alreadyEarned = currentEvents.includes(eventId);
    const checkedInEvents = alreadyEarned ? currentEvents : [...currentEvents, eventId];
    const points = pointsForEvents(checkedInEvents);
    const displayName = cleanText(userData.displayName || caller.token.name || caller.token.email || "FQC Member", 80);
    const role = profileRole(userData.role || caller.token.role);
    const roleLabel = cleanText(userData.officerTitle || caller.token.officerTitle || (role === "officer" ? "Officer" : "Member"), 80);
    const entries = buildLeaderboardEntries(leaderboardSnapshot.data()?.entries, {
      uid: caller.uid,
      displayName,
      points,
      role
    });

    if (!checkInSnapshot.exists) {
      transaction.set(checkInRef, {
        uid: caller.uid,
        displayName,
        email: cleanText(caller.token.email, 180),
        pointsAwarded: alreadyEarned ? 0 : 1,
        locationVerified,
        locationRequirement: locationVerified ? "within-2-miles" : "disabled",
        checkedInAt: FieldValue.serverTimestamp()
      });
    }

    if (!alreadyEarned || Number(userData.points) !== points) {
      transaction.set(userRef, {
        checkedInEvents,
        points,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    if (JSON.stringify(entries) !== JSON.stringify(leaderboardSnapshot.data()?.entries || [])) {
      transaction.set(leaderboardRef, {
        entries,
        participantCount: entries.length,
        scoring: "one-point-per-event",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    return {
      eventId,
      awarded: !alreadyEarned,
      points,
      newCheckIn: !checkInSnapshot.exists,
      memberSheet: { displayName, roleLabel, checkedInEvents, checkedInAt },
      leaderboard: { entries, participantCount: entries.length }
    };
  });

  let sheetSynced = true;
  if (result.newCheckIn) {
    try {
      const workbook = await loadEventOperationsWorkbook();
      await syncMasterMemberAttendance({
        uid: caller.uid,
        displayName: result.memberSheet.displayName,
        roleLabel: result.memberSheet.roleLabel,
        points: result.points,
        checkedInEvents: result.memberSheet.checkedInEvents,
        checkedInAt: result.memberSheet.checkedInAt
      }, workbook);
    } catch (error) {
      sheetSynced = false;
      console.error("Master Members attendance sync failed", error);
    }
  }
  const { memberSheet, newCheckIn, ...publicResult } = result;
  return { ...publicResult, sheetSynced };
});

export const beginPasskeyRegistration = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const { origin, rpID } = relyingParty(request);
  const userRecord = await auth.getUser(caller.uid);
  const credentials = await db.collection("users").doc(caller.uid).collection("passkeys").get();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: userRecord.email || caller.uid,
    userDisplayName: userRecord.displayName || userRecord.email || "FQC Member",
    userID: Buffer.from(caller.uid, "utf8"),
    attestationType: "none",
    excludeCredentials: credentials.docs.map((doc) => ({ id: doc.id, transports: doc.data().transports || [] })),
    authenticatorSelection: {
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required"
    },
    preferredAuthenticatorType: "localDevice"
  });
  const challengeId = randomUUID();
  await db.collection("passkeyChallenges").doc(challengeId).set({
    type: "registration",
    uid: caller.uid,
    challenge: options.challenge,
    origin,
    rpID,
    expiresAt: Timestamp.fromMillis(Date.now() + challengeLifetimeMs)
  });
  return { challengeId, options };
});

export const finishPasskeyRegistration = onCall(callableOptions, async (request) => {
  const caller = requireAuth(request);
  const challengeId = cleanText(request.data?.challengeId, 100);
  const response = request.data?.response;
  const challengeRef = db.collection("passkeyChallenges").doc(challengeId);
  const challengeSnapshot = await challengeRef.get();
  const challenge = challengeSnapshot.data();
  if (!challenge || challenge.type !== "registration" || challenge.uid !== caller.uid || challenge.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError("failed-precondition", "This passkey request expired. Try again.");
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: challenge.rpID,
    requireUserVerification: true
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new HttpsError("permission-denied", "The passkey could not be verified.");
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const credentialData = {
    uid: caller.uid,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: response?.response?.transports || [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null
  };
  // Registering the same authenticator twice refreshes the stored credential but
  // must not inflate the count, or the number of devices shown drifts upward.
  const credentialRef = db.collection("passkeyCredentials").doc(credential.id);
  const alreadyRegistered = (await credentialRef.get()).exists;
  const batch = db.batch();
  batch.set(credentialRef, credentialData);
  batch.set(db.collection("users").doc(caller.uid).collection("passkeys").doc(credential.id), {
    transports: credentialData.transports,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    createdAt: FieldValue.serverTimestamp()
  });
  batch.set(db.collection("users").doc(caller.uid), {
    ...(alreadyRegistered ? {} : { passkeyCount: FieldValue.increment(1) }),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.delete(challengeRef);
  await batch.commit();
  return { verified: true };
});

export const beginPasskeySignIn = onCall(callableOptions, async (request) => {
  const { origin, rpID } = relyingParty(request);
  const options = await generateAuthenticationOptions({
    rpID,
    timeout: 60_000,
    userVerification: "required"
  });
  const challengeId = randomUUID();
  await db.collection("passkeyChallenges").doc(challengeId).set({
    type: "authentication",
    challenge: options.challenge,
    origin,
    rpID,
    expiresAt: Timestamp.fromMillis(Date.now() + challengeLifetimeMs)
  });
  return { challengeId, options };
});

export const finishPasskeySignIn = onCall(callableOptions, async (request) => {
  const challengeId = cleanText(request.data?.challengeId, 100);
  const response = request.data?.response;
  const credentialId = cleanText(response?.id, 1024);
  if (!challengeId || !credentialId) throw new HttpsError("invalid-argument", "Passkey response is incomplete.");

  const challengeRef = db.collection("passkeyChallenges").doc(challengeId);
  const credentialRef = db.collection("passkeyCredentials").doc(credentialId);
  const [challengeSnapshot, credentialSnapshot] = await Promise.all([challengeRef.get(), credentialRef.get()]);
  const challenge = challengeSnapshot.data();
  const stored = credentialSnapshot.data();
  if (!challenge || challenge.type !== "authentication" || challenge.expiresAt.toMillis() < Date.now() || !stored?.uid) {
    throw new HttpsError("failed-precondition", "This passkey request expired. Try again.");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: challenge.rpID,
    credential: {
      id: credentialId,
      publicKey: new Uint8Array(stored.publicKey.toBuffer()),
      counter: Number(stored.counter) || 0,
      transports: stored.transports || []
    },
    requireUserVerification: true
  });
  if (!verification.verified) throw new HttpsError("permission-denied", "The passkey could not be verified.");

  const batch = db.batch();
  batch.update(credentialRef, {
    counter: verification.authenticationInfo.newCounter,
    lastUsedAt: FieldValue.serverTimestamp()
  });
  batch.delete(challengeRef);
  await batch.commit();
  const customToken = await auth.createCustomToken(stored.uid, { passkey: true });
  return { customToken };
});
