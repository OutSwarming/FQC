import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  changeMemberRole,
  createEmailAccount,
  loadLeaderboard,
  loadMembers,
  loadOfficerEventOperations,
  loadOfficerResources,
  logOut,
  observeCheckIn,
  observeSession,
  readableAuthError,
  recommendOfficer,
  requestPasswordReset,
  recordCheckIn,
  registerPasskey,
  saveOfficerBudgetItem,
  saveOfficerEvent,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signInWithPasskey,
  supportsPasskeys,
  updateActiveCheckIn,
  updateEventRsvp,
  updateProfileName,
  verifyUfid
} from "./firebase-client.js";

const APP_VERSION = "2.4.1";
const APP_RELEASE_DATE = "August 13, 2026";
const RELEASE_HISTORY = [
  ["2.4.1", "Moved events into a Past archive 24 hours after they begin and repaired leadership role matching"],
  ["2.4.0", "Cleaned up Profile and added one Sheet-synced event operations workspace for officers"],
  ["2.3.0", "Added secure, role-prioritized FQC Drive resources for officers on phones and computers"],
  ["2.2.1", "Consolidated events, treasury, UF locations, and current leadership into one canonical workbook"],
  ["2.2.0", "Added live officer event budgets, itemized purchase plans, and verified FQC funding totals"],
  ["2.1.0", "Added a one-read live leaderboard with one point per unique event check-in"],
  ["2.0.4", "Simplified account creation to email, password, and UFID only"],
  ["2.0.3", "Restored the circular FQC seal as the installed app icon and favicon"],
  ["2.0.2", "Restored durable FQC branding and same-origin web.app Google sign-in"],
  ["2.0.1", "Repaired Google sign-in with the registered Firebase OAuth callback"],
  ["2.0.0", "Live 2026 Event Logistics schedule and secure leader roster integration"],
  ["1.9.0", "App settings, update recovery, version history, and safer cache refreshes"],
  ["1.8.0", "Email/password login, password reset, and UFID account setup"],
  ["1.7.0", "Firebase Functions, secure officer roles, Google and passkey authentication"],
  ["1.6.0", "Unified UF event map, list, calendar, and mobile bottom sheet"],
  ["1.5.0", "Google Sheets event updates and UF campus locations"]
];
const allowedViews = new Set(["home", "checkin", "profile", "settings"]);
const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const EVENT_SHEET_ID = "1xB4q--RsY7girF9JumjbUKKRu9lFQ8XHRlkCHttbgd0";
const EVENTS_SHEET_NAME = "Events";
const TREASURER_SHEET_NAME = "Treasurer Breakdown";
const UF_LOCATIONS_SHEET_NAME = "UF Locations";
const EVENT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const EVENT_DATA_CACHE_KEY = "fqc:event-data";
const EVENT_BUDGET_CACHE_KEY = "fqc:event-budget";
const EVENT_DATA_SOURCE = "2026 Event Logistics Google Sheet";
const EVENT_BUDGET_SHEET_URL = `https://docs.google.com/spreadsheets/d/${EVENT_SHEET_ID}/edit#gid=806240242`;
const MAX_EVENTS = 250;
const MAX_LOCATIONS = 250;
const MAX_BUDGET_ITEMS = 1000;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,80}$/i;
const UF_CAMPUS_BOUNDS = Object.freeze({
  south: 29.62,
  west: -82.39,
  north: 29.67,
  east: -82.31
});

function isUfCampusCoordinate(lat, lng) {
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= UF_CAMPUS_BOUNDS.south &&
    lat <= UF_CAMPUS_BOUNDS.north &&
    lng >= UF_CAMPUS_BOUNDS.west &&
    lng <= UF_CAMPUS_BOUNDS.east;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

const storedView = localStorage.getItem("fqc:view") || "home";
const state = {
  view: allowedViews.has(storedView) ? storedView : "home",
  theme: localStorage.getItem("fqc:theme") || document.documentElement.dataset.theme || systemTheme,
  eventMode: localStorage.getItem("fqc:event-mode") || "list",
  calendarMonth: localStorage.getItem("fqc:calendar-month") || "2026-03",
  selectedEventId: localStorage.getItem("fqc:selected-event") || "fqc-2026-03-03-ionq",
  memberName: localStorage.getItem("fqc:name") || "Future Member",
  memberEmail: "",
  memberPhotoURL: "",
  loggedIn: false,
  authReady: false,
  authBusy: false,
  authError: "",
  authMessage: "",
  authMode: "login",
  authUser: null,
  memberRole: "member",
  leadership: "",
  officerTitle: "",
  canManageOfficers: false,
  ufidStatus: "",
  passkeyCount: 0,
  members: [],
  membersLoading: false,
  officerResources: [],
  officerResourcesLoaded: false,
  officerResourcesLoading: false,
  officerResourcesError: "",
  officerOperations: null,
  officerOperationsLoaded: false,
  officerOperationsLoading: false,
  officerOperationsError: "",
  selectedOfficerEventId: "",
  activeCheckInEventId: "fqc-2026-03-03-ionq",
  checkInOpen: false,
  checkedInEvents: [],
  memberPoints: 0,
  leaderboardEntries: [],
  leaderboardParticipantCount: 0,
  leaderboardLoaded: false,
  leaderboardLoading: false,
  leaderboardError: "",
  rsvps: readJson("fqc:rsvps", [])
};

const fallbackLocations = {
  "malachowsky-hall": { id: "malachowsky-hall", name: "Malachowsky Hall", address: "1889 Museum Road, Gainesville, FL 32611", lat: 29.644482, lng: -82.34805 },
  "larsen-hall": { id: "larsen-hall", name: "Larsen Hall", address: "968 Center Drive, Gainesville, FL 32611", lat: 29.64311, lng: -82.34738 },
  "reitz-student-union": { id: "reitz-student-union", name: "Reitz Student Union", address: "655 Reitz Union Drive, Gainesville, FL 32611", lat: 29.64631, lng: -82.34788 },
  "marston-science-library": { id: "marston-science-library", name: "Marston Science Library", address: "444 Newell Drive, Gainesville, FL 32611", lat: 29.64794, lng: -82.34394 },
  "newell-hall": { id: "newell-hall", name: "Newell Hall", address: "1700 Stadium Road, Gainesville, FL 32611", lat: 29.64909, lng: -82.34508 },
  "pugh-hall": { id: "pugh-hall", name: "Pugh Hall", address: "296 Buckman Drive, Gainesville, FL 32611", lat: 29.64941, lng: -82.34553 },
  "turlington-hall": { id: "turlington-hall", name: "Turlington Hall", address: "330 Newell Drive, Gainesville, FL 32611", lat: 29.64921, lng: -82.34407 },
  "little-hall": { id: "little-hall", name: "Little Hall", address: "1400 Stadium Road, Gainesville, FL 32611", lat: 29.64885, lng: -82.34073 },
  "weil-hall": { id: "weil-hall", name: "Weil Hall", address: "1949 Stadium Road, Gainesville, FL 32611", lat: 29.64835, lng: -82.34843 },
  "smathers-library": { id: "smathers-library", name: "Smathers Library", address: "1508 Union Road, Gainesville, FL 32611", lat: 29.65092, lng: -82.34181 }
};

const fallbackEvents = [
  {
    id: "fqc-2026-03-03-ionq",
    date: "2026-03-03",
    title: "IonQ Quantum Networking Speaker Session",
    time: "3:30 PM",
    locationId: "reitz-student-union",
    room: "Room 2340",
    description: "Daniel Pompa of IonQ presented on current industry progress in quantum networking; Palm & Pine catering was provided."
  },
  {
    id: "fqc-2026-03-10-gbm-2",
    date: "2026-03-10",
    title: "GBM 2",
    time: "6:00 PM",
    locationId: "malachowsky-hall",
    room: "Room 1142",
    description: "A community meeting to connect students interested in quantum computing, share semester progress, and explain ways to get involved. Pizza was served."
  },
  {
    id: "fqc-2026-03-24-quirk",
    date: "2026-03-24",
    title: "Workshop 3: Quirk Circuit Simulator",
    time: "6:00 PM",
    locationId: "larsen-hall",
    room: "Room 234",
    description: "A hands-on introduction to Quirk, an interactive quantum circuit simulator. Pizza was provided."
  },
  {
    id: "fqc-2026-03-31-bomb-testing",
    date: "2026-03-31",
    title: "Workshop 4: Quantum Bomb Testing",
    time: "6:00 PM",
    locationId: "malachowsky-hall",
    room: "Room 1142",
    description: "A workshop exploring the Quantum Bomb Testing algorithm. Sandwiches were provided."
  },
  {
    id: "fqc-2026-04-07-laura-kim",
    date: "2026-04-07",
    title: "Speaker Session: Dr. Laura Kim",
    time: "5:30 PM",
    locationId: "malachowsky-hall",
    room: "Room G168",
    description: "FQC speaker session featuring UF Assistant Professor Dr. Laura Kim. Food began at 5:30 PM and the presentation began at 6:00 PM."
  },
  {
    id: "fqc-2026-04-14-gbm-3",
    date: "2026-04-14",
    title: "GBM 3: Quantum Technology Today",
    time: "6:00 PM",
    locationId: "larsen-hall",
    room: "Room 234",
    description: "A general body meeting on the present-day impact of quantum technology. Piesanos was provided."
  },
  {
    id: "fqc-2026-04-21-social",
    date: "2026-04-21",
    title: "End of Year Social",
    time: "6:00 PM",
    locationId: "malachowsky-hall",
    room: "Room G186",
    description: "A semester-closing social for the FQC community, open to all majors. Huey Magoo's was served."
  }
];

let locations = { ...fallbackLocations };
let events = fallbackEvents.map((event) => ({ ...event }));
let eventDataSource = "Bundled schedule copy";
let eventDataUpdatedAt = null;
let eventRefreshInFlight = null;
let eventBudget = {
  baseFunding: 1050,
  operationalFunding: 2490,
  totalApproved: 3540,
  plannedSpend: 0,
  actualSpend: 0,
  availableAfterActual: 3540,
  uncommittedAfterPlan: 3540,
  items: []
};
let eventBudgetSource = "Verified FQC funding copy";
let eventBudgetUpdatedAt = null;

function locationIdFor(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function csvObjects(csvText) {
  const [headers = [], ...rows] = parseCsv(csvText);
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header.trim(), String(row[index] || "").trim()])));
}

function normalizeSheetDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function normalizeSheetTime(value) {
  return String(value || "").trim().replace(/^(\d{1,2}:\d{2}):\d{2}\s/i, "$1 ");
}

function eventIdFor(date, title) {
  const slug = locationIdFor(title).slice(0, 52) || "meeting";
  return `fqc-${date}-${slug}`;
}

function sheetMoney(value) {
  const normalized = String(value ?? "").replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return 0;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function buildSheetBudgetData(budgetCsv) {
  const rows = csvObjects(budgetCsv);
  const summaries = Object.fromEntries(rows
    .filter((row) => row["Budget Summary"])
    .map((row) => [row["Budget Summary"], sheetMoney(row.Amount)]));
  const items = rows
    .filter((row) => row["Event ID"] && row.Item)
    .slice(0, MAX_BUDGET_ITEMS)
    .map((row) => ({
      eventId: row["Event ID"],
      event: row.Event,
      date: normalizeSheetDate(row.Date),
      item: row.Item,
      quantity: sheetMoney(row.Quantity),
      unit: row.Unit,
      unitCost: sheetMoney(row["Unit Cost"]),
      plannedCost: sheetMoney(row["Planned Cost"]),
      actualCost: sheetMoney(row["Actual Cost"]),
      fundingSource: row["Funding Source"],
      status: row.Status,
      notes: row.Notes
    }));
  const baseFunding = summaries["Base Funding"];
  const operationalFunding = summaries["Operational Funding"];
  const totalApproved = summaries["Total Approved"] || baseFunding + operationalFunding;
  if (!Number.isFinite(totalApproved) || totalApproved <= 0 || items.length > MAX_BUDGET_ITEMS) {
    throw new Error("The budget sheet did not contain a valid FQC funding summary.");
  }
  const plannedSpend = summaries["Planned Spend"] || items.reduce((sum, item) => sum + item.plannedCost, 0);
  const actualSpend = summaries["Actual Spend"] || items.reduce((sum, item) => sum + item.actualCost, 0);
  return {
    baseFunding,
    operationalFunding,
    totalApproved,
    plannedSpend,
    actualSpend,
    availableAfterActual: summaries["Available After Actual"] || totalApproved - actualSpend,
    uncommittedAfterPlan: summaries["Uncommitted After Plan"] || totalApproved - plannedSpend,
    items
  };
}

function isValidBudgetData(nextBudget) {
  return Boolean(
    nextBudget &&
    Number.isFinite(nextBudget.totalApproved) &&
    nextBudget.totalApproved > 0 &&
    Number.isFinite(nextBudget.plannedSpend) &&
    Number.isFinite(nextBudget.actualSpend) &&
    Array.isArray(nextBudget.items) &&
    nextBudget.items.length <= MAX_BUDGET_ITEMS &&
    nextBudget.items.every((item) => SAFE_ID_PATTERN.test(item.eventId) && item.item && item.plannedCost >= 0 && item.actualCost >= 0)
  );
}

function applyBudgetData(nextBudget, options = {}) {
  if (!isValidBudgetData(nextBudget)) return false;
  const changed = JSON.stringify(eventBudget) !== JSON.stringify(nextBudget);
  eventBudget = {
    ...nextBudget,
    items: nextBudget.items.map((item) => ({ ...item }))
  };
  eventBudgetSource = options.source || EVENT_DATA_SOURCE;
  eventBudgetUpdatedAt = options.updatedAt || new Date().toISOString();
  if (options.persist !== false) {
    try {
      localStorage.setItem(EVENT_BUDGET_CACHE_KEY, JSON.stringify({ ...eventBudget, updatedAt: eventBudgetUpdatedAt }));
    } catch {}
  }
  return changed;
}

function loadCachedBudgetData() {
  try {
    const cached = JSON.parse(localStorage.getItem(EVENT_BUDGET_CACHE_KEY) || "null");
    if (!cached) return false;
    const { updatedAt, ...budget } = cached;
    return applyBudgetData(budget, { source: "Saved Google Sheet budget", updatedAt, persist: false });
  } catch {
    return false;
  }
}

function logisticsLocation(value) {
  const text = String(value || "").trim();
  const compact = text.replace(/\s*\(.*\)\s*$/, "").trim();
  const match = compact.match(/^(Reitz|Larsen|Marston)\s*(.*)$/i);
  if (!match) {
    return {
      location: "University of Florida",
      room: text && !/^campus$/i.test(text) ? text : "Location to be announced"
    };
  }

  const building = match[1].toLowerCase();
  const names = {
    reitz: "Reitz Student Union",
    larsen: "Larsen Hall",
    marston: "Marston Science Library"
  };
  return {
    location: names[building],
    room: match[2] ? `Room ${match[2].replace(/^room\s+/i, "")}` : "Room details to be announced"
  };
}

function buildSheetEventData(eventsCsv, locationsCsv) {
  const nextLocations = {};
  csvObjects(locationsCsv).forEach((row) => {
    const name = row.Location;
    const id = locationIdFor(name);
    const lat = Number(row.Lat || row.Latitude);
    const lng = Number(row.Long || row.Longitude);
    if (!id || !name || !isUfCampusCoordinate(lat, lng)) return;
    nextLocations[id] = { id, name, address: row.Address || "University of Florida", lat, lng };
  });

  const seenIds = new Set();
  const nextEvents = csvObjects(eventsCsv)
    .filter((row) => !Object.hasOwn(row, "Published") || String(row.Published || "").toLowerCase() === "yes")
    .map((row) => {
      const logistics = Object.hasOwn(row, "Date") && Object.hasOwn(row, "Type");
      const date = normalizeSheetDate(logistics ? row.Date : row["Event Date"]);
      const title = logistics ? row.Type : row["Event Name"];
      const place = logistics ? logisticsLocation(row.Location) : {
        location: row.Location,
        room: row.Room ? `Room ${row.Room.replace(/^room\s+/i, "")}` : "Room details in event post"
      };
      return {
        id: logistics ? eventIdFor(date, title) : row["Event ID"],
        date,
        title,
        time: normalizeSheetTime(logistics ? row.Time : row["Start Time"]),
        locationId: locationIdFor(place.location),
        room: place.room,
        description: logistics
          ? `${title} for the Florida Quantum Computing Society. Check the club announcement for the latest agenda and room updates.`
          : row["Event Description"] || "See the FQC event announcement for details.",
        backupRoom: row["Backup Room"] || "",
        attendance: row.Attendance || "",
        permitStatus: row["Permit (y/n)"] || "",
        permitNumber: row["Permit Number"] || "",
        roomStatus: row["Room Request"] || "",
        backupRoomStatus: row["Backup Room Request"] || "",
        officerNotes: row.Notes || "",
        plannedBudget: sheetMoney(row["Event Budget"]),
        actualSpend: sheetMoney(row["Actual Spend"]),
        remainingBudget: sheetMoney(row["Remaining Budget"]),
        fundingSource: row["Funding Source"] || "",
        budgetStatus: row["Budget Status"] || "",
        eventStatus: row["Event Status"] || "Planned"
      };
    })
    .filter((event) => {
      const valid = Boolean(
        event.id &&
        SAFE_ID_PATTERN.test(event.id) &&
        !seenIds.has(event.id) &&
        event.date &&
        event.title &&
        event.time &&
        nextLocations[event.locationId]
      );
      if (valid) seenIds.add(event.id);
      return valid;
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time));

  if (
    !nextEvents.length ||
    nextEvents.length > MAX_EVENTS ||
    !Object.keys(nextLocations).length ||
    Object.keys(nextLocations).length > MAX_LOCATIONS
  ) throw new Error("The published sheet did not contain a complete event schedule.");
  return { events: nextEvents, locations: nextLocations };
}

function isValidEventData(nextData) {
  const nextEvents = nextData?.events;
  const nextLocations = nextData?.locations;
  if (
    !Array.isArray(nextEvents) ||
    !nextEvents.length ||
    nextEvents.length > MAX_EVENTS ||
    !nextLocations ||
    Array.isArray(nextLocations) ||
    !Object.keys(nextLocations).length ||
    Object.keys(nextLocations).length > MAX_LOCATIONS
  ) return false;

  const validLocations = Object.entries(nextLocations).every(([id, location]) => (
    SAFE_ID_PATTERN.test(id) &&
    location?.id === id &&
    typeof location.name === "string" &&
    location.name.trim().length > 0 &&
    typeof location.address === "string" &&
    isUfCampusCoordinate(location.lat, location.lng)
  ));
  if (!validLocations) return false;

  const seenIds = new Set();
  return nextEvents.every((event) => {
    const valid = Boolean(
      event &&
      SAFE_ID_PATTERN.test(event.id) &&
      !seenIds.has(event.id) &&
      /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
      typeof event.title === "string" &&
      event.title.trim().length > 0 &&
      typeof event.time === "string" &&
      event.time.trim().length > 0 &&
      typeof event.room === "string" &&
      typeof event.description === "string" &&
      nextLocations[event.locationId]
    );
    if (valid) seenIds.add(event.id);
    return valid;
  });
}

function eventDataSignature(nextEvents, nextLocations) {
  return JSON.stringify({ events: nextEvents, locations: nextLocations });
}

function applyEventData(nextData, options = {}) {
  if (!isValidEventData(nextData)) return false;
  const changed = eventDataSignature(events, locations) !== eventDataSignature(nextData.events, nextData.locations);
  events = nextData.events.map((event) => ({ ...event }));
  locations = Object.fromEntries(Object.entries(nextData.locations).map(([id, location]) => [id, { ...location }]));
  eventDataSource = options.source || EVENT_DATA_SOURCE;
  eventDataUpdatedAt = options.updatedAt || new Date().toISOString();

  if (!events.some((event) => event.id === state.selectedEventId)) state.selectedEventId = events[0].id;
  if (!events.some((event) => event.id === state.activeCheckInEventId)) state.activeCheckInEventId = events[0].id;
  if (!events.some((event) => event.date.startsWith(`${state.calendarMonth}-`))) {
    state.calendarMonth = events[0].date.slice(0, 7);
  }

  if (options.persist !== false) {
    try {
      localStorage.setItem(EVENT_DATA_CACHE_KEY, JSON.stringify({
        events,
        locations,
        updatedAt: eventDataUpdatedAt
      }));
    } catch {}
  }

  return changed;
}

function loadCachedEventData() {
  try {
    const cached = JSON.parse(localStorage.getItem(EVENT_DATA_CACHE_KEY) || "null");
    if (!cached?.events?.length || !cached?.locations) return false;
    return applyEventData(cached, { source: "Saved Google Sheet copy", updatedAt: cached.updatedAt, persist: false });
  } catch {
    return false;
  }
}

function sheetCsvUrl(sheetName) {
  const query = new URLSearchParams({ tqx: "out:csv", sheet: sheetName, cache_bypass: String(Date.now()) });
  return `https://docs.google.com/spreadsheets/d/${EVENT_SHEET_ID}/gviz/tq?${query}`;
}

async function refreshEventData(reason = "scheduled refresh") {
  if (window.location.protocol === "file:" || !navigator.onLine) return false;
  if (eventRefreshInFlight) return eventRefreshInFlight;

  eventRefreshInFlight = Promise.all([
    fetch(sheetCsvUrl(EVENTS_SHEET_NAME), { cache: "no-store" }),
    fetch(sheetCsvUrl(UF_LOCATIONS_SHEET_NAME), { cache: "no-store" }),
    fetch(sheetCsvUrl(TREASURER_SHEET_NAME), { cache: "no-store" })
  ])
    .then(async ([eventsResponse, locationsResponse, budgetResponse]) => {
      if (!eventsResponse.ok || !locationsResponse.ok || !budgetResponse.ok) {
        throw new Error(`Sheet request failed (${eventsResponse.status}/${locationsResponse.status}/${budgetResponse.status}).`);
      }
      const nextData = buildSheetEventData(await eventsResponse.text(), await locationsResponse.text());
      const nextBudget = buildSheetBudgetData(await budgetResponse.text());
      const previousSource = eventDataSource;
      const changed = applyEventData(nextData, { source: EVENT_DATA_SOURCE });
      const budgetChanged = applyBudgetData(nextBudget, { source: EVENT_DATA_SOURCE });
      if ((changed || budgetChanged || previousSource !== eventDataSource) && (state.view === "home" || state.view === "profile")) render();
      return true;
    })
    .catch((error) => {
      console.warn(`[events] ${reason} unavailable; keeping the current schedule.`, error);
      return false;
    })
    .finally(() => {
      eventRefreshInFlight = null;
    });

  return eventRefreshInFlight;
}

loadCachedEventData();
loadCachedBudgetData();

if (!events.some((event) => event.id === state.selectedEventId)) state.selectedEventId = events[0].id;
if (!events.some((event) => event.id === state.activeCheckInEventId)) state.activeCheckInEventId = events[0].id;
if (!/^(member|officer)$/.test(state.memberRole)) state.memberRole = "member";
if (!/^(list|calendar|past)$/.test(state.eventMode)) state.eventMode = "list";
if (!/^\d{4}-\d{2}$/.test(state.calendarMonth)) state.calendarMonth = events[0].date.slice(0, 7);
if (!/^(light|dark)$/.test(state.theme)) state.theme = systemTheme;

const titles = {
  home: "Events",
  checkin: "Check In",
  profile: "Profile",
  settings: "Settings"
};

const app = document.querySelector("#app");
const title = document.querySelector("#screen-title");
const navItems = [...document.querySelectorAll(".nav-item")];
const quickProfile = document.querySelector("#quick-profile");
const profileInitial = document.querySelector("#profile-initial");
const themeToggle = document.querySelector("#theme-toggle");
const settingsToggle = document.querySelector("#settings-toggle");
let eventMap = null;
let eventMarkers = new Map();
let pendingMapPan = null;
const MOBILE_EVENT_SHEET_MODES = ["closed", "low", "medium", "high"];
let mobileEventSheetMode = "medium";

function saveState() {
  localStorage.setItem("fqc:view", state.view);
  localStorage.setItem("fqc:theme", state.theme);
  localStorage.setItem("fqc:event-mode", state.eventMode);
  localStorage.setItem("fqc:calendar-month", state.calendarMonth);
  localStorage.setItem("fqc:selected-event", state.selectedEventId);
  localStorage.setItem("fqc:name", state.memberName);
  localStorage.setItem("fqc:rsvps", JSON.stringify(state.rsvps));
}

function getEvent(eventId) {
  return events.find((event) => event.id === eventId) || events[0];
}

function getEventLocation(event) {
  return locations[event.locationId];
}

function eventDate(event) {
  return new Date(`${event.date}T12:00:00`);
}

function eventStartDate(event) {
  const match = String(event.time || "").trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  let hours = Number(match?.[1] || 12);
  const minutes = Number(match?.[2] || 0);
  const meridiem = String(match?.[3] || "").toUpperCase();
  if (meridiem === "AM" && hours === 12) hours = 0;
  if (meridiem === "PM" && hours !== 12) hours += 12;
  const [year, month, day] = event.date.split("-").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function isPastEvent(event, now = new Date()) {
  return now.getTime() >= eventStartDate(event).getTime() + 24 * 60 * 60 * 1000;
}

function upcomingEvents(now = new Date()) {
  return events.filter((event) => !isPastEvent(event, now));
}

function pastEvents(now = new Date()) {
  return events.filter((event) => isPastEvent(event, now)).reverse();
}

function eventsForMode(mode = state.eventMode) {
  return mode === "past" ? pastEvents() : upcomingEvents();
}

function ensureSelectedEventForMode() {
  const visibleEvents = eventsForMode();
  const available = visibleEvents.length ? visibleEvents : events;
  if (available.length && !available.some((event) => event.id === state.selectedEventId)) {
    state.selectedEventId = available[0].id;
  }
  if (state.eventMode === "calendar" && visibleEvents.length && !visibleEvents.some((event) => event.date.startsWith(`${state.calendarMonth}-`))) {
    state.calendarMonth = visibleEvents[0].date.slice(0, 7);
  }
}

function formatEventDate(event, options = {}) {
  return new Intl.DateTimeFormat("en-US", options).format(eventDate(event));
}

function formatEventDataStatus() {
  if (!eventDataUpdatedAt) return eventDataSource;
  const refreshed = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(eventDataUpdatedAt));
  return `${eventDataSource} · ${refreshed}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatBudgetDataStatus() {
  if (!eventBudgetUpdatedAt) return eventBudgetSource;
  const refreshed = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(eventBudgetUpdatedAt));
  return `${eventBudgetSource} · ${refreshed}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function applyTheme(theme, persist = true) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;
  themeToggle.setAttribute("aria-label", `Use ${state.theme === "dark" ? "light" : "dark"} theme`);
  themeToggle.title = `Use ${state.theme === "dark" ? "light" : "dark"} theme`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    state.theme === "dark" ? "#080d1d" : "#f7f9fe"
  );
  if (persist) saveState();
}

async function nukeAndReload() {
  try {
    await logOut();
  } catch {}

  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}

  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
  } catch {}

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {}

  window.setTimeout(() => window.location.reload(), 80);
}

async function checkForUpdates() {
  state.authBusy = true;
  state.authError = "";
  state.authMessage = "Checking for the newest release…";
  render();
  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.filter((name) => name.startsWith("fqc-app-")).map((name) => caches.delete(name)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update()));
    }
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set("release", APP_VERSION);
    window.location.replace(url);
  }
}

function stopZoomGesture(event) {
  event.preventDefault();
}

function setView(view) {
  state.view = allowedViews.has(view) ? view : "home";
  saveState();
  render();
  if (state.view === "profile" && state.loggedIn) queueMicrotask(() => refreshLeaderboard());
  if (state.view === "profile" && state.memberRole === "officer") {
    queueMicrotask(refreshOfficerResources);
    queueMicrotask(refreshOfficerOperations);
  }
  if (state.view === "settings" && state.memberRole === "officer" && !state.members.length) queueMicrotask(refreshMemberDirectory);
}

function render() {
  if (eventMap) {
    if (pendingMapPan) eventMap.off("moveend", pendingMapPan);
    eventMap.remove();
    eventMap = null;
    eventMarkers = new Map();
    pendingMapPan = null;
  }

  const eventsScreenActive = state.view === "home";
  document.documentElement.classList.toggle("events-screen-active", eventsScreenActive);
  document.body.classList.toggle("events-screen-active", eventsScreenActive);
  if (eventsScreenActive && isMobileEventSheetViewport() && window.scrollY !== 0) window.scrollTo(0, 0);

  title.textContent = titles[state.view] || "Events";
  profileInitial.textContent = state.memberName.trim().charAt(0).toUpperCase() || "F";
  navItems.forEach((item) => {
    const active = item.dataset.view === state.view;
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });

  const views = {
    home: renderHome,
    checkin: renderCheckIn,
    profile: renderProfile,
    settings: renderSettings
  };

  app.innerHTML = views[state.view]?.() || renderHome();
  bindViewEvents();
  app.focus({ preventScroll: true });
  if (state.view === "home") requestAnimationFrame(initEventMap);
}

function renderHome() {
  ensureSelectedEventForMode();
  const currentEvents = upcomingEvents();
  const archivedEvents = pastEvents();
  return `
    <section class="view events-home" data-screen="home">
      <section class="event-explorer" data-sheet-mode="${mobileEventSheetMode}" aria-label="FQC events and locations">
        <div class="event-planner" id="event-planner" data-sheet-mode="${mobileEventSheetMode}">
          <button class="event-sheet-handle" id="event-sheet-handle" type="button" aria-label="Resize event list" aria-controls="event-planner-content" aria-expanded="${mobileEventSheetMode === "high"}">
            <span aria-hidden="true"></span>
            <small>Swipe for events</small>
          </button>

          <div id="event-planner-content">
            <div class="event-intro" id="event-intro" aria-live="polite">
              ${renderSelectedEventIntro()}
            </div>

            <div class="event-tabs" role="tablist" aria-label="Event view">
              <button type="button" role="tab" data-event-tab="list" aria-selected="${state.eventMode === "list"}">
                <svg><use href="#icon-map"></use></svg>
                List
              </button>
              <button type="button" role="tab" data-event-tab="calendar" aria-selected="${state.eventMode === "calendar"}">
                <svg><use href="#icon-calendar"></use></svg>
                Calendar
              </button>
              <button type="button" role="tab" data-event-tab="past" aria-selected="${state.eventMode === "past"}">
                Past <span class="event-tab-count">${archivedEvents.length}</span>
              </button>
            </div>

            <div class="event-mode-panel" data-event-panel="list" ${state.eventMode === "list" ? "" : "hidden"}>
              ${currentEvents.length ? `<div class="event-list" aria-label="Upcoming events">${currentEvents.map(renderEventCard).join("")}</div>` : '<p class="calendar-empty">No upcoming events are scheduled yet. Completed events are saved under Past.</p>'}
            </div>

            <div class="event-mode-panel" data-event-panel="calendar" ${state.eventMode === "calendar" ? "" : "hidden"}>
              <div id="event-calendar">${renderCalendarMonth()}</div>
            </div>

            <div class="event-mode-panel" data-event-panel="past" ${state.eventMode === "past" ? "" : "hidden"}>
              ${archivedEvents.length ? `<div class="event-list past-event-list" aria-label="Past events">${archivedEvents.map((event) => renderEventCard(event, { past: true })).join("")}</div>` : '<p class="calendar-empty">Past events will appear here 24 hours after they begin.</p>'}
            </div>
          </div>
        </div>

        <div class="event-map-shell">
          <div class="map-status"><span></span>${currentEvents.length} upcoming · ${archivedEvents.length} past</div>
          <div id="event-map" aria-label="Map of FQC event locations"></div>
          <div class="event-map-message" id="event-map-message" hidden>Map tiles are unavailable. Event details still work below.</div>
          <div class="event-details" id="event-details" aria-live="polite">
            ${renderSelectedEventDetails()}
          </div>
        </div>
      </section>
    </section>
  `;
}

function renderSelectedEventIntro() {
  const event = getEvent(state.selectedEventId);
  const location = getEventLocation(event);
  return `
    <p class="section-kicker">${escapeHtml(formatEventDate(event, { weekday: "long", month: "long", day: "numeric" }))} · ${escapeHtml(event.time)}</p>
    <h2>${escapeHtml(event.title)}</h2>
    <div class="event-intro-location">
      <svg><use href="#icon-location"></use></svg>
      <span>${escapeHtml(location.name)} · ${escapeHtml(event.room)}</span>
    </div>
    <p class="event-intro-summary">${escapeHtml(event.description)}</p>
    <div class="event-data-status" title="${escapeHtml(formatEventDataStatus())}">
      <span aria-hidden="true"></span>
      <strong>${eventDataSource === EVENT_DATA_SOURCE ? "Google Sheet connected" : "Schedule ready offline"}</strong>
    </div>
  `;
}

function renderEventCard(event, options = {}) {
  const location = getEventLocation(event);
  const selected = event.id === state.selectedEventId;
  const going = state.rsvps.includes(event.id);
  return `
    <article class="event-card${selected ? " selected" : ""}${options.past ? " past-event-card" : ""}" data-event-card="${event.id}">
      <button class="event-card-select" type="button" data-select-event="${event.id}" aria-pressed="${selected}">
        <span class="date-block">
          <span>${formatEventDate(event, { month: "short" })}</span>
          <strong>${formatEventDate(event, { day: "2-digit" })}</strong>
        </span>
        <span class="event-card-copy">
          <strong>${escapeHtml(event.title)}</strong>
          <span>${escapeHtml(event.time)} <i></i> ${escapeHtml(location.name)}</span>
        </span>
        <svg class="event-chevron"><use href="#icon-chevron-right"></use></svg>
      </button>
      ${options.past
        ? '<span class="event-past-label">Past</span>'
        : `<button class="event-rsvp-mini${going ? " going" : ""}" type="button" data-rsvp="${event.id}" aria-label="${going ? "Cancel RSVP for" : "RSVP for"} ${escapeHtml(event.title)}">${going ? "Going" : "RSVP"}</button>`}
    </article>
  `;
}

function renderCalendarMonth() {
  const [year, month] = state.calendarMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingDays = firstDay.getDay();
  const previousMonthDays = new Date(year, month - 1, 0).getDate();
  const currentEvents = upcomingEvents();
  const monthEvents = currentEvents.filter((event) => event.date.startsWith(state.calendarMonth));
  const eventMonths = [...new Set(currentEvents.map((event) => event.date.slice(0, 7)))].sort();
  const firstEventMonth = eventMonths[0];
  const lastEventMonth = eventMonths[eventMonths.length - 1];
  const eventsByDay = new Map();
  monthEvents.forEach((event) => {
    const day = Number(event.date.slice(8, 10));
    eventsByDay.set(day, [...(eventsByDay.get(day) || []), event]);
  });
  const cells = [];

  for (let index = 0; index < leadingDays; index += 1) {
    cells.push(`<span class="calendar-day outside" aria-hidden="true"><span>${previousMonthDays - leadingDays + index + 1}</span></span>`);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayEvents = eventsByDay.get(day) || [];
    if (dayEvents.length) {
      const selectedEvent = dayEvents.find((event) => event.id === state.selectedEventId) || dayEvents[0];
      const selected = dayEvents.some((event) => event.id === state.selectedEventId);
      cells.push(`
        <button class="calendar-day has-event${selected ? " selected" : ""}" type="button" data-select-event="${escapeHtml(selectedEvent.id)}" aria-pressed="${selected}" aria-label="${escapeHtml(dayEvents.map((event) => event.title).join(", "))}, ${escapeHtml(formatEventDate(selectedEvent, { month: "long", day: "numeric" }))}">
          <span class="calendar-day-number">${day}</span>
          <span class="calendar-day-label">${escapeHtml(selectedEvent.title)}</span>
          <i aria-hidden="true"></i>
        </button>
      `);
    } else {
      cells.push(`<span class="calendar-day"><span class="calendar-day-number">${day}</span></span>`);
    }
  }
  const trailingDays = 42 - cells.length;
  for (let day = 1; day <= trailingDays; day += 1) {
    cells.push(`<span class="calendar-day outside" aria-hidden="true"><span>${day}</span></span>`);
  }

  return `
    <div class="calendar-heading">
      <button type="button" data-calendar-shift="-1" aria-label="Previous month" ${!firstEventMonth || state.calendarMonth <= firstEventMonth ? "disabled" : ""}><svg><use href="#icon-chevron-left"></use></svg></button>
      <div>
        <strong>${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(firstDay)}</strong>
        <span>${monthEvents.length} ${monthEvents.length === 1 ? "event" : "events"} · ${currentEvents.length} upcoming</span>
      </div>
      <button type="button" data-calendar-shift="1" aria-label="Next month" ${!lastEventMonth || state.calendarMonth >= lastEventMonth ? "disabled" : ""}><svg><use href="#icon-chevron-right"></use></svg></button>
    </div>
    <div class="calendar-weekdays" aria-hidden="true">
      ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<span>${day}</span>`).join("")}
    </div>
    <div class="calendar-grid">${cells.join("")}</div>
    ${monthEvents.length ? `
      <div class="calendar-agenda-heading">
        <strong>Events this month</strong>
        <span>${monthEvents.length} scheduled</span>
      </div>
      <div class="calendar-agenda">
        ${monthEvents.map((event) => {
          const location = getEventLocation(event);
          const selected = event.id === state.selectedEventId;
          return `
            <button class="calendar-agenda-event${selected ? " selected" : ""}" type="button" data-select-event="${event.id}" aria-pressed="${selected}">
              <span class="calendar-agenda-date"><small>${formatEventDate(event, { month: "short" })}</small><strong>${formatEventDate(event, { day: "2-digit" })}</strong></span>
              <span class="calendar-agenda-copy">
                <strong>${escapeHtml(event.title)}</strong>
                <span>${escapeHtml(event.time)} · ${escapeHtml(location.name)} · ${escapeHtml(event.room)}</span>
              </span>
              <svg class="event-chevron"><use href="#icon-chevron-right"></use></svg>
            </button>
          `;
        }).join("")}
      </div>
    ` : '<p class="calendar-empty">No FQC events scheduled this month.</p>'}
  `;
}

function renderSelectedEventDetails() {
  const event = getEvent(state.selectedEventId);
  const location = getEventLocation(event);
  const going = state.rsvps.includes(event.id);
  const past = isPastEvent(event);
  const directionsDestination = encodeURIComponent(`${location.lat},${location.lng}`);
  return `
    <article class="event-detail-card">
      <div class="event-detail-copy">
        <p>${formatEventDate(event, { weekday: "long", month: "long", day: "numeric" })} · ${escapeHtml(event.time)}</p>
        <h3>${escapeHtml(event.title)}</h3>
        <div class="event-detail-location">
          <svg><use href="#icon-location"></use></svg>
          <span>${escapeHtml(location.name)}</span>
        </div>
        <div class="event-detail-meta">
          <span>${escapeHtml(event.room)}</span>
          <span>${escapeHtml(location.address)}</span>
        </div>
        <p class="event-detail-focus">${escapeHtml(event.description)}</p>
      </div>
      <div class="event-detail-actions">
        <a class="secondary-button" href="https://www.google.com/maps/dir/?api=1&destination=${directionsDestination}" target="_blank" rel="noopener noreferrer">Directions</a>
        ${past
          ? '<span class="event-detail-past-label">Past event</span>'
          : `<button class="primary-button${going ? " going" : ""}" type="button" data-rsvp="${event.id}">${going ? "Going" : "RSVP"}</button>`}
      </div>
    </article>
  `;
}

function setEventMode(mode) {
  state.eventMode = ["calendar", "past"].includes(mode) ? mode : "list";
  ensureSelectedEventForMode();
  saveState();
  document.querySelectorAll("[data-event-tab]").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.eventTab === state.eventMode));
  });
  document.querySelectorAll("[data-event-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.eventPanel !== state.eventMode;
  });
  selectEvent(state.selectedEventId, { focusMap: false });
  if (isMobileEventSheetViewport()) {
    const nextSheetMode = state.eventMode === "calendar" || state.eventMode === "past" || mobileEventSheetMode === "high"
      ? "high"
      : "medium";
    setMobileEventSheetMode(nextSheetMode);
  }
}

function shiftCalendarMonth(offset) {
  const [year, month] = state.calendarMonth.split("-").map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  state.calendarMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  saveState();
  const calendar = document.querySelector("#event-calendar");
  if (calendar) {
    calendar.innerHTML = renderCalendarMonth();
    bindCalendarEvents();
  }
}

function selectEvent(eventId, options = {}) {
  const selectedEvent = events.find((event) => event.id === eventId);
  if (!selectedEvent) return;
  const nextMode = isPastEvent(selectedEvent) ? "past" : state.eventMode === "past" ? "list" : state.eventMode;
  if (nextMode !== state.eventMode) setEventMode(nextMode);
  state.selectedEventId = eventId;
  if (state.eventMode === "calendar") state.calendarMonth = selectedEvent.date.slice(0, 7);
  saveState();

  document.querySelectorAll("[data-event-card]").forEach((card) => {
    card.classList.toggle("selected", card.dataset.eventCard === eventId);
  });
  document.querySelectorAll("[data-select-event]").forEach((button) => {
    if (button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", String(button.dataset.selectEvent === eventId));
    if (button.classList.contains("calendar-day")) button.classList.toggle("selected", button.dataset.selectEvent === eventId);
  });

  eventMarkers.forEach((marker, id) => {
    marker.getElement()?.querySelector(".event-map-pin")?.classList.toggle("active", id === eventId);
  });

  const details = document.querySelector("#event-details");
  if (details) {
    details.innerHTML = renderSelectedEventDetails();
    bindRsvpEvents(details);
  }

  const intro = document.querySelector("#event-intro");
  if (intro) intro.innerHTML = renderSelectedEventIntro();

  const calendar = document.querySelector("#event-calendar");
  if (calendar && state.eventMode === "calendar") {
    calendar.innerHTML = renderCalendarMonth();
    bindCalendarEvents();
  }

  if (options.revealSheet === true && isMobileEventSheetViewport()) {
    setMobileEventSheetMode("medium");
  }

  if (options.focusMap !== false) focusSelectedEvent();
}

function isMobileEventSheetViewport() {
  return window.matchMedia("(max-width: 680px)").matches;
}

function getMobileEventSheetMetrics() {
  const explorer = document.querySelector(".event-explorer");
  const availableHeight = explorer?.getBoundingClientRect().height || Math.max(520, window.innerHeight - 160);
  const low = Math.min(190, Math.max(154, availableHeight * 0.24));
  const medium = Math.min(320, Math.max(low + 94, availableHeight * 0.45));
  const high = Math.max(medium + 112, availableHeight * 0.78);
  return { closed: 0, low, medium, high: Math.min(high, availableHeight - 92) };
}

function setMobileEventSheetMode(mode, options = {}) {
  if (!isMobileEventSheetViewport()) return;
  const planner = document.querySelector(".event-planner");
  const explorer = document.querySelector(".event-explorer");
  if (!planner || !explorer) return;

  const nextMode = MOBILE_EVENT_SHEET_MODES.includes(mode) ? mode : "medium";
  const metrics = getMobileEventSheetMetrics();
  mobileEventSheetMode = nextMode;
  planner.dataset.sheetMode = nextMode;
  explorer.dataset.sheetMode = nextMode;
  planner.style.height = `${Math.round(metrics[nextMode])}px`;
  planner.classList.toggle("event-sheet-dragging", options.dragging === true);
  document.querySelector("#event-sheet-handle")?.setAttribute("aria-expanded", String(nextMode === "high"));
  planner.setAttribute("aria-hidden", String(nextMode === "closed"));
  planner.inert = nextMode === "closed";
  if (nextMode !== "high" || options.preserveScroll !== true) planner.scrollTop = 0;
  window.setTimeout(() => eventMap?.invalidateSize(), options.immediate ? 0 : 260);
}

function bindMobileEventSheet() {
  const planner = document.querySelector(".event-planner");
  const explorer = document.querySelector(".event-explorer");
  const handle = document.querySelector("#event-sheet-handle");
  const intro = document.querySelector("#event-intro");
  if (!planner || !explorer || !handle || !intro || !isMobileEventSheetViewport()) return;

  setMobileEventSheetMode(mobileEventSheetMode, { immediate: true });
  let drag = null;
  let suppressHandleClick = false;
  let suppressSheetClick = false;
  let dragFrame = null;
  let pendingDragHeight = null;
  let scrollMomentumFrame = null;

  const stopScrollMomentum = () => {
    if (scrollMomentumFrame) cancelAnimationFrame(scrollMomentumFrame);
    scrollMomentumFrame = null;
  };

  const startScrollMomentum = (initialVelocity) => {
    stopScrollMomentum();
    let velocity = Math.max(-2.4, Math.min(2.4, initialVelocity));
    if (Math.abs(velocity) < 0.08) return;
    let lastTime = performance.now();

    const coast = (now) => {
      const elapsed = Math.min(32, Math.max(1, now - lastTime));
      lastTime = now;
      const maxScrollTop = Math.max(0, planner.scrollHeight - planner.clientHeight);
      const nextScrollTop = Math.max(0, Math.min(maxScrollTop, planner.scrollTop + velocity * elapsed));
      const reachedBoundary = (nextScrollTop <= 0 && velocity < 0) || (nextScrollTop >= maxScrollTop && velocity > 0);
      planner.scrollTop = nextScrollTop;
      velocity *= Math.pow(0.95, elapsed / 16.67);

      if (!reachedBoundary && Math.abs(velocity) > 0.025 && mobileEventSheetMode === "high") {
        scrollMomentumFrame = requestAnimationFrame(coast);
      } else {
        scrollMomentumFrame = null;
      }
    };

    scrollMomentumFrame = requestAnimationFrame(coast);
  };

  const modeIndex = () => MOBILE_EVENT_SHEET_MODES.indexOf(mobileEventSheetMode);
  const stepMode = (direction) => {
    const nextIndex = Math.max(0, Math.min(MOBILE_EVENT_SHEET_MODES.length - 1, modeIndex() + direction));
    setMobileEventSheetMode(MOBILE_EVENT_SHEET_MODES[nextIndex]);
  };

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    stopScrollMomentum();
    const metrics = getMobileEventSheetMetrics();
    const startHeight = planner.getBoundingClientRect().height;
    drag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      startHeight,
      currentHeight: startHeight,
      lastTime: performance.now(),
      velocity: 0,
      metrics,
      moved: false,
      resizing: false,
      modeAtStart: mobileEventSheetMode,
      startScrollTop: planner.scrollTop,
      resizeSurface: Boolean(event.target.closest("#event-sheet-handle, #event-intro")),
      scrollHandoff: false
    };
  };

  const moveDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const now = performance.now();
    const elapsed = Math.max(1, now - drag.lastTime);
    const instantVelocity = (drag.lastY - event.clientY) / elapsed;
    drag.velocity = drag.velocity * 0.35 + instantVelocity * 0.65;
    drag.lastY = event.clientY;
    drag.lastTime = now;
    const delta = drag.startY - event.clientY;
    if (!drag.moved && Math.abs(delta) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      planner.classList.add("event-sheet-dragging");
      try { planner.setPointerCapture(event.pointerId); } catch {}
    }

    let resizeDelta = delta;
    if (drag.modeAtStart === "high" && !drag.resizeSurface) {
      const maxScrollTop = Math.max(0, planner.scrollHeight - planner.clientHeight);
      planner.scrollTop = Math.max(0, Math.min(maxScrollTop, drag.startScrollTop + delta));
      const downwardPastTop = Math.max(0, -delta - drag.startScrollTop);
      drag.resizing = downwardPastTop > 0;
      resizeDelta = -downwardPastTop;
    } else {
      drag.resizing = true;
      if (delta > 0) {
        const expansionDistance = Math.max(0, drag.metrics.high - drag.startHeight);
        resizeDelta = Math.min(delta, expansionDistance);
        const upwardPastHigh = Math.max(0, delta - expansionDistance);
        if (upwardPastHigh > 0) {
          drag.scrollHandoff = true;
          const maxScrollTop = Math.max(0, planner.scrollHeight - planner.clientHeight);
          planner.scrollTop = Math.max(0, Math.min(maxScrollTop, drag.startScrollTop + upwardPastHigh));
        }
      }
    }

    const nextHeight = Math.max(drag.metrics.low, Math.min(drag.metrics.high, drag.startHeight + resizeDelta));
    drag.currentHeight = nextHeight;
    pendingDragHeight = nextHeight;
    if (!dragFrame) {
      dragFrame = requestAnimationFrame(() => {
        planner.style.height = `${Math.round(pendingDragHeight)}px`;
        dragFrame = null;
      });
    }
    if (event.cancelable) event.preventDefault();
  };

  const finishDrag = (event) => {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const finished = drag;
    drag = null;
    if (dragFrame) cancelAnimationFrame(dragFrame);
    dragFrame = null;
    pendingDragHeight = null;
    planner.classList.remove("event-sheet-dragging");
    const distance = finished.startY - finished.lastY;
    const meaningfulSwipe = Math.abs(distance) > 22;

    if (Math.abs(distance) > 7) {
      suppressHandleClick = true;
      suppressSheetClick = true;
      window.setTimeout(() => { suppressHandleClick = false; }, 280);
      window.setTimeout(() => { suppressSheetClick = false; }, 280);
    }

    if (!finished.resizing) {
      if (finished.modeAtStart === "high") {
        setMobileEventSheetMode("high", { preserveScroll: true });
        startScrollMomentum(finished.velocity);
      }
      return;
    }

    const nearestMode = MOBILE_EVENT_SHEET_MODES.slice(1).reduce((nearest, candidate) => (
      Math.abs(finished.metrics[candidate] - finished.currentHeight) < Math.abs(finished.metrics[nearest] - finished.currentHeight)
        ? candidate
        : nearest
    ), "medium");
    let nextMode = nearestMode;

    if (meaningfulSwipe && Math.abs(finished.velocity) > 0.12) {
      const startModeIndex = MOBILE_EVENT_SHEET_MODES.indexOf(finished.modeAtStart);
      const nearestModeIndex = MOBILE_EVENT_SHEET_MODES.indexOf(nearestMode);
      const directionalModeIndex = Math.max(1, Math.min(3, startModeIndex + (distance > 0 ? 1 : -1)));
      const nextModeIndex = distance > 0
        ? Math.max(nearestModeIndex, directionalModeIndex)
        : Math.min(nearestModeIndex, directionalModeIndex);
      nextMode = MOBILE_EVENT_SHEET_MODES[nextModeIndex];
    }

    const preserveScroll = nextMode === "high" && finished.scrollHandoff;
    setMobileEventSheetMode(nextMode, { preserveScroll });
    if (preserveScroll) startScrollMomentum(finished.velocity);
  };

  planner.addEventListener("pointerdown", startDrag);
  planner.addEventListener("pointermove", moveDrag, { passive: false });
  planner.addEventListener("pointerup", finishDrag);
  planner.addEventListener("pointercancel", finishDrag);
  planner.addEventListener("click", (event) => {
    if (!suppressSheetClick) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  handle.addEventListener("click", (event) => {
    if (suppressHandleClick) {
      event.preventDefault();
      return;
    }
    stepMode(mobileEventSheetMode === "high" ? -1 : 1);
  });

  handle.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      stepMode(1);
      event.preventDefault();
    } else if (event.key === "ArrowDown") {
      stepMode(-1);
      event.preventDefault();
    }
  });

  planner.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) < 24) return;
    if (event.deltaY > 0 && mobileEventSheetMode !== "high") {
      stepMode(1);
      event.preventDefault();
    } else if (event.deltaY < 0 && planner.scrollTop <= 1 && mobileEventSheetMode !== "low") {
      stepMode(-1);
      event.preventDefault();
    }
  }, { passive: false });

  const resizeSheet = () => setMobileEventSheetMode(mobileEventSheetMode, { immediate: true, preserveScroll: true });
  window.addEventListener("resize", resizeSheet, { once: true });
}

async function toggleRsvp(eventId) {
  const wasGoing = state.rsvps.includes(eventId);
  const going = !wasGoing;
  state.rsvps = going ? [...state.rsvps, eventId] : state.rsvps.filter((id) => id !== eventId);
  saveState();

  document.querySelectorAll(`[data-rsvp="${eventId}"]`).forEach((button) => {
    button.classList.toggle("going", going);
    button.textContent = going ? "Going" : "RSVP";
    button.setAttribute("aria-label", `${going ? "Cancel RSVP for" : "RSVP for"} ${getEvent(eventId).title}`);
  });
  if (!state.loggedIn) return;
  try {
    await updateEventRsvp(eventId, going);
    if (state.memberRole === "officer") state.officerOperationsLoaded = false;
  } catch (error) {
    state.rsvps = wasGoing ? [...new Set([...state.rsvps, eventId])] : state.rsvps.filter((id) => id !== eventId);
    state.authError = readableAuthError(error);
    saveState();
    render();
  }
}

function bindRsvpEvents(root = document) {
  root.querySelectorAll("[data-rsvp]").forEach((button) => {
    button.addEventListener("click", () => toggleRsvp(button.dataset.rsvp));
  });
}

function bindCalendarEvents() {
  document.querySelectorAll("[data-calendar-shift]").forEach((button) => {
    button.addEventListener("click", () => shiftCalendarMonth(Number(button.dataset.calendarShift)));
  });
  document.querySelectorAll("#event-calendar [data-select-event]").forEach((button) => {
    button.addEventListener("click", () => selectEvent(button.dataset.selectEvent));
  });
}

function initEventMap() {
  const mapElement = document.querySelector("#event-map");
  if (!mapElement || !window.L) {
    document.querySelector("#event-map-message")?.removeAttribute("hidden");
    return;
  }

  eventMap = window.L.map(mapElement, {
    zoomControl: false,
    attributionControl: true,
    scrollWheelZoom: false,
    maxBounds: [
      [UF_CAMPUS_BOUNDS.south, UF_CAMPUS_BOUNDS.west],
      [UF_CAMPUS_BOUNDS.north, UF_CAMPUS_BOUNDS.east]
    ],
    maxBoundsViscosity: 1
  });

  window.L.control.zoom({ position: "topright" }).addTo(eventMap);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(eventMap);

  eventMap.on("click", () => {
    if (isMobileEventSheetViewport()) setMobileEventSheetMode("closed");
  });

  const bounds = [];
  events.forEach((event) => {
    const location = getEventLocation(event);
    const day = Number(event.date.slice(8, 10));
    const marker = window.L.marker([location.lat, location.lng], {
      title: event.title,
      alt: `${event.title} at ${location.name}`,
      icon: window.L.divIcon({
        className: "event-marker-shell",
        html: `<span class="event-map-pin${event.id === state.selectedEventId ? " active" : ""}" data-event-id="${event.id}"><span>${day}</span></span>`,
        iconSize: [44, 48],
        iconAnchor: [22, 44]
      }),
      bubblingMouseEvents: false
    }).addTo(eventMap);
    marker.on("click", () => selectEvent(event.id, { revealSheet: true }));
    eventMarkers.set(event.id, marker);
    bounds.push([location.lat, location.lng]);
  });

  eventMap.fitBounds(bounds, { padding: [54, 54], maxZoom: 16 });
  window.setTimeout(() => eventMap?.invalidateSize(), 120);
}

function focusSelectedEvent() {
  if (!eventMap) return;
  const event = getEvent(state.selectedEventId);
  const location = getEventLocation(event);
  const zoom = Math.max(eventMap.getZoom(), 16);
  if (pendingMapPan) eventMap.off("moveend", pendingMapPan);
  eventMap.stop();
  pendingMapPan = () => {
    if (!eventMap) return;
    eventMap.panBy([0, window.innerWidth < 680 ? 90 : 105], { animate: true, duration: 0.25 });
    pendingMapPan = null;
  };
  eventMap.once("moveend", pendingMapPan);
  eventMap.flyTo([location.lat, location.lng], zoom, { duration: 0.45 });
}

function renderMetrics(metrics) {
  return metrics.map(([value, label]) => `
    <article class="metric-card">
      <strong>${value}</strong>
      <span>${label}</span>
    </article>
  `).join("");
}

function roleLabel() {
  if (state.leadership === "president") return "President";
  if (state.leadership === "treasurer") return "Treasurer";
  return state.memberRole === "officer" ? state.officerTitle || "Officer" : "Member";
}

function profileRoleLabel(profile) {
  if (profile.leadership === "president") return "President";
  if (profile.leadership === "treasurer") return "Treasurer";
  return profile.role === "officer" ? profile.officerTitle || "Officer" : "Member";
}

function applyMemberProfile(profile) {
  state.memberName = profile.displayName || "FQC Member";
  state.memberEmail = profile.email || "";
  state.memberPhotoURL = profile.photoURL || "";
  state.memberRole = profile.role === "officer" ? "officer" : "member";
  state.leadership = ["president", "vice_president", "treasurer"].includes(profile.leadership) ? profile.leadership : "";
  state.officerTitle = profile.officerTitle || "";
  state.canManageOfficers = profile.canManageOfficers === true;
  state.ufidStatus = ["required", "matched", "member"].includes(profile.ufidStatus) ? profile.ufidStatus : "member";
  state.passkeyCount = Number(profile.passkeyCount) || 0;
  state.checkedInEvents = Array.isArray(profile.checkedInEvents) ? profile.checkedInEvents : [];
  state.memberPoints = state.checkedInEvents.length;
  if (state.memberRole !== "officer") {
    state.officerResources = [];
    state.officerResourcesLoaded = false;
    state.officerResourcesLoading = false;
    state.officerResourcesError = "";
    state.officerOperations = null;
    state.officerOperationsLoaded = false;
    state.officerOperationsLoading = false;
    state.officerOperationsError = "";
  }
  localStorage.setItem("fqc:name", state.memberName);
}

async function refreshLeaderboard(force = false) {
  if (!state.loggedIn || state.ufidStatus === "required" || state.leaderboardLoading) return;
  if (state.leaderboardLoaded && !force) return;
  state.leaderboardLoading = true;
  state.leaderboardError = "";
  if (state.view === "profile") render();
  try {
    const leaderboard = await loadLeaderboard();
    state.leaderboardEntries = leaderboard.entries;
    state.leaderboardParticipantCount = leaderboard.participantCount;
    state.leaderboardLoaded = true;
  } catch (error) {
    state.leaderboardError = readableAuthError(error);
  } finally {
    state.leaderboardLoading = false;
    if (state.view === "profile") render();
  }
}

async function runAuthAction(action, successMessage = "") {
  state.authBusy = true;
  state.authError = "";
  state.authMessage = "";
  render();
  try {
    const result = await action();
    if (successMessage) state.authMessage = successMessage;
    return result;
  } catch (error) {
    state.authError = readableAuthError(error);
    return null;
  } finally {
    state.authBusy = false;
    render();
  }
}

async function refreshMemberDirectory() {
  if (state.memberRole !== "officer") return;
  state.membersLoading = true;
  render();
  try {
    state.members = await loadMembers();
    state.authError = "";
  } catch (error) {
    state.authError = readableAuthError(error);
  } finally {
    state.membersLoading = false;
    render();
  }
}

async function refreshOfficerResources(force = false) {
  if (state.memberRole !== "officer" || state.officerResourcesLoading) return;
  if (state.officerResourcesLoaded && !force) return;
  state.officerResourcesLoading = true;
  state.officerResourcesError = "";
  if (state.view === "profile") render();
  try {
    state.officerResources = await loadOfficerResources();
    state.officerResourcesLoaded = true;
  } catch (error) {
    state.officerResourcesError = readableAuthError(error);
  } finally {
    state.officerResourcesLoading = false;
    if (state.view === "profile") render();
  }
}

async function refreshOfficerOperations(force = false) {
  if (state.memberRole !== "officer" || state.officerOperationsLoading) return;
  if (state.officerOperationsLoaded && !force) return;
  state.officerOperationsLoading = true;
  state.officerOperationsError = "";
  if (state.view === "profile") render();
  try {
    state.officerOperations = await loadOfficerEventOperations();
    state.officerOperationsLoaded = true;
    const operationEvents = state.officerOperations?.events || [];
    if (!operationEvents.some((event) => event.id === state.selectedOfficerEventId)) {
      state.selectedOfficerEventId = operationEvents.find((event) => event.id === state.selectedEventId)?.id || operationEvents[0]?.id || "";
    }
  } catch (error) {
    state.officerOperationsError = readableAuthError(error);
  } finally {
    state.officerOperationsLoading = false;
    if (state.view === "profile") render();
  }
}

function renderAuthFeedback() {
  return `
    <div class="auth-feedback" aria-live="polite">
      ${state.authError ? `<p class="form-error">${escapeHtml(state.authError)}</p>` : ""}
      ${state.authMessage ? `<p class="form-success">${escapeHtml(state.authMessage)}</p>` : ""}
    </div>
  `;
}

function renderAuthLoading(screen) {
  return `
    <section class="view" data-screen="${screen}">
      <section class="section auth-loading" aria-live="polite">
        <span class="auth-spinner" aria-hidden="true"></span>
        <h2>Checking your FQC account</h2>
        <p>Securely restoring your Firebase session.</p>
      </section>
    </section>
  `;
}

function renderCheckIn() {
  if (!state.authReady) return renderAuthLoading("checkin");
  if (!state.loggedIn) {
    return `
      <section class="view" data-screen="checkin">
        <section class="section checkin-gate">
          <div class="checkin-icon"><svg><use href="#icon-check"></use></svg></div>
          <p class="section-kicker">Attendance</p>
          <h2>Sign in to check in</h2>
          <p>Use your FQC profile for tabling, GBMs, workshops, speaker sessions, and socials.</p>
          <button class="primary-button" id="go-to-login" type="button">Open Profile Login</button>
        </section>
      </section>
    `;
  }

  if (state.ufidStatus === "required") {
    return `
      <section class="view" data-screen="checkin">
        <section class="section checkin-gate">
          <div class="checkin-icon"><svg><use href="#icon-lock"></use></svg></div>
          <p class="section-kicker">One-time account setup</p>
          <h2>Verify your UFID first</h2>
          <p>Finish your secure profile before checking in to an event.</p>
          <button class="primary-button" id="go-to-login" type="button">Finish Account Setup</button>
        </section>
      </section>
    `;
  }

  const event = getEvent(state.activeCheckInEventId);
  const location = getEventLocation(event);
  const checkedIn = state.checkedInEvents.includes(event.id);
  return `
    <section class="view" data-screen="checkin">
      <section class="section checkin-hero">
        <div class="checkin-status ${state.checkInOpen ? "live" : "closed"}"><span></span>${state.checkInOpen ? "Check-in open" : "No check-in open"}</div>
        ${state.checkInOpen ? `
          <p class="section-kicker">Current FQC event</p>
          <h2>${escapeHtml(event.title)}</h2>
          <div class="checkin-meta">
            <span>${escapeHtml(event.time)}</span>
            <span>${escapeHtml(location.name)}</span>
            <span>${escapeHtml(event.room)}</span>
          </div>
          <p>${escapeHtml(event.description)}</p>
          <button class="primary-button checkin-button${checkedIn ? " going" : ""}" id="check-in-now" type="button" ${checkedIn ? "disabled" : ""}>
            <svg><use href="#icon-check"></use></svg><span>${checkedIn ? "Checked In" : "Check In Now"}</span>
          </button>
          ${checkedIn ? `<p class="checkin-confirmation">Attendance recorded for ${escapeHtml(state.memberName)}.</p>` : ""}
        ` : `
          <h2>Nothing active right now</h2>
          <p>An officer will open this screen when tabling or an FQC event begins.</p>
        `}
      </section>
      <section class="section identity-card">
        <span class="role-badge ${state.memberRole}">${roleLabel()}</span>
        <div><strong>${escapeHtml(state.memberName)}</strong><p>${escapeHtml(roleLabel())} · Signed in and ready for attendance.</p></div>
      </section>
    </section>
  `;
}

function renderOfficerWorkspace() {
  const operations = state.officerOperations;
  if (state.officerOperationsLoading && !operations) {
    return `<section class="section officer-operations"><div class="section-header"><div><p class="section-kicker">Officer workspace</p><h2>Event Operations</h2><p>Loading events, budgets, notes, rooms, and RSVPs…</p></div><span class="auth-spinner" aria-hidden="true"></span></div></section>${renderOfficerResources()}`;
  }
  if (state.officerOperationsError && !operations) {
    return `<section class="section officer-operations"><div class="section-header"><div><p class="section-kicker">Officer workspace</p><h2>Event Operations</h2><p>${escapeHtml(state.officerOperationsError)}</p></div><button class="secondary-button" id="retry-officer-operations" type="button">Try Again</button></div></section>${renderOfficerResources()}`;
  }

  const totals = operations?.totals || eventBudget;
  const operationEvents = operations?.events || [];
  const budgetMetrics = [
    [formatMoney(totals.totalApproved), "Total approved"],
    [formatMoney(totals.plannedSpend), "Planned spend"],
    [formatMoney(totals.actualSpend), "Actual spend"],
    [formatMoney(totals.availableAfterActual), "Available now"]
  ];
  return `
    <section class="section officer-operations">
      <div class="section-header officer-operations-header">
        <div><p class="section-kicker">Officer workspace</p><h2>Event Operations</h2><p>Rooms, status, money, RSVPs, notes, and check-in are together under each event.</p></div>
        <button class="secondary-button" id="refresh-officer-operations" type="button" ${state.officerOperationsLoading ? "disabled" : ""}>${state.officerOperationsLoading ? "Refreshing…" : "Refresh"}</button>
      </div>
      <div class="budget-sync-line"><span></span><strong>2026 Event Logistics connected</strong><p>App edits save to Google Sheets; Sheet edits return on refresh and every 5 minutes.</p></div>
      <section class="metric-grid officer-budget-overview" aria-label="Team budget overview">${renderMetrics(budgetMetrics)}</section>
      <div class="budget-summary-line"><strong>${formatMoney(totals.baseFunding)} base + ${formatMoney(totals.operationalFunding)} operational</strong><span>${formatMoney(totals.uncommittedAfterPlan)} uncommitted after plans</span></div>

      <details class="officer-add-event">
        <summary><span><svg><use href="#icon-plus"></use></svg>Add Event</span><small>Creates a new Events row</small></summary>
        ${renderOfficerEventForm({ eventStatus: "Planning" }, true)}
      </details>
      <datalist id="uf-location-options">${(operations?.locations || []).map((location) => `<option value="${escapeHtml(location)}"></option>`).join("")}</datalist>

      <div class="officer-event-list" aria-label="Officer event operations">
        ${operationEvents.map((event) => renderOfficerEventCard(event, operations.budgetItems || [])).join("") || '<p class="empty-state">No events are available yet.</p>'}
      </div>
      <a class="secondary-button budget-sheet-link" href="${EVENT_BUDGET_SHEET_URL}" target="_blank" rel="noopener noreferrer">Open Full Google Sheet</a>
      ${renderAuthFeedback()}
    </section>
    ${renderOfficerResources()}
  `;
}

function eventStatusOptions(current = "Planned") {
  return ["Planning", "Planned", "Room pending", "Confirmed", "In progress", "Completed", "Cancelled"]
    .map((status) => `<option value="${status}" ${status === current ? "selected" : ""}>${status}</option>`).join("");
}

function renderOfficerEventForm(event = {}, creating = false) {
  const formId = creating ? "new-officer-event" : `officer-event-${event.id}`;
  return `
    <form class="officer-event-form" id="${escapeHtml(formId)}" data-officer-event-form="${escapeHtml(event.id || "new")}">
      <div class="officer-form-grid">
        <div class="form-row"><label>Event name</label><input name="title" aria-label="Event name" value="${escapeHtml(event.title || "")}" maxlength="120" required /></div>
        <div class="form-row"><label>Status</label><select name="eventStatus" aria-label="Status">${eventStatusOptions(event.eventStatus)}</select></div>
        <div class="form-row"><label>Date</label><input name="date" aria-label="Date" type="date" value="${escapeHtml(event.date || "")}" required /></div>
        <div class="form-row"><label>Time</label><input name="time" aria-label="Time" value="${escapeHtml(event.time || "")}" placeholder="6:00 PM" required /></div>
        <div class="form-row officer-form-wide"><label>Location / room</label><input name="location" aria-label="Location / room" list="uf-location-options" value="${escapeHtml(event.location || "")}" placeholder="Reitz G320" required /></div>
        <div class="form-row"><label>Backup room</label><input name="backupRoom" aria-label="Backup room" value="${escapeHtml(event.backupRoom || "")}" placeholder="Larsen 234" /></div>
        <div class="form-row"><label>Expected attendance</label><input name="attendance" aria-label="Expected attendance" inputmode="numeric" value="${escapeHtml(event.attendance || "")}" /></div>
        <div class="form-row"><label>Room status</label><input name="roomStatus" aria-label="Room status" value="${escapeHtml(event.roomStatus || "")}" placeholder="Submitted / Confirmed" /></div>
        <div class="form-row"><label>Backup status</label><input name="backupRoomStatus" aria-label="Backup status" value="${escapeHtml(event.backupRoomStatus || "")}" placeholder="Not submitted" /></div>
        <div class="form-row officer-form-wide"><label>Officer notes for this event</label><textarea name="notes" aria-label="Officer notes for this event" maxlength="1200" placeholder="Decisions, next steps, room details, catering owner…">${escapeHtml(event.notes || "")}</textarea></div>
      </div>
      <button class="primary-button" type="submit"><svg><use href="#icon-check"></use></svg><span>${creating ? "Create Event" : "Save Event Details"}</span></button>
    </form>
  `;
}

function renderBudgetItemForm(item, event, creating = false) {
  const row = creating ? "new" : item.row;
  return `
    <form class="event-budget-item-form" data-budget-item-form="${escapeHtml(String(row))}" data-budget-event="${escapeHtml(event.id)}">
      <div class="budget-item-heading"><strong>${creating ? "New purchase" : escapeHtml(item.item)}</strong>${creating ? "" : `<span>${formatMoney(item.plannedCost)} planned</span>`}</div>
      <div class="budget-edit-grid">
        <div class="form-row budget-item-name"><label>Item</label><input name="item" aria-label="Item" value="${escapeHtml(item.item || "")}" required /></div>
        <div class="form-row"><label>Quantity</label><input name="quantity" aria-label="Quantity" type="number" min="0" step="0.01" value="${escapeHtml(item.quantity || "")}" /></div>
        <div class="form-row"><label>Unit</label><input name="unit" aria-label="Unit" value="${escapeHtml(item.unit || "")}" placeholder="each / order" /></div>
        <div class="form-row"><label>Unit cost</label><input name="unitCost" aria-label="Unit cost" type="number" min="0" step="0.01" value="${escapeHtml(item.unitCost || "")}" /></div>
        <div class="form-row"><label>Actual cost</label><input name="actualCost" aria-label="Actual cost" type="number" min="0" step="0.01" value="${escapeHtml(item.actualCost || "")}" /></div>
        <div class="form-row"><label>Funding source</label><input name="fundingSource" aria-label="Funding source" value="${escapeHtml(item.fundingSource || "")}" /></div>
        <div class="form-row"><label>Budget status</label><input name="status" aria-label="Budget status" value="${escapeHtml(item.status || "Estimate")}" /></div>
        <div class="form-row budget-item-notes"><label>Budget notes</label><textarea name="notes" aria-label="Budget notes" maxlength="800">${escapeHtml(item.notes || "")}</textarea></div>
      </div>
      <button class="secondary-button" type="submit">${creating ? "Add Budget Item" : "Save Money Changes"}</button>
    </form>
  `;
}

function renderOfficerEventCard(event, allBudgetItems) {
  const items = allBudgetItems.filter((item) => item.eventId === event.id);
  const open = event.id === state.selectedOfficerEventId;
  const rsvps = event.rsvps || [];
  return `
    <details class="officer-event-card" data-officer-event="${escapeHtml(event.id)}" ${open ? "open" : ""}>
      <summary>
        <span class="officer-event-date"><small>${escapeHtml(formatEventDate(event, { month: "short" }))}</small><strong>${escapeHtml(formatEventDate(event, { day: "2-digit" }))}</strong></span>
        <span class="officer-event-summary"><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.location || "Location pending")} · ${escapeHtml(event.time)}</small></span>
        <span class="event-status-pill status-${escapeHtml(String(event.eventStatus || "planned").toLowerCase().replace(/[^a-z]+/g, "-"))}">${escapeHtml(event.eventStatus || "Planned")}</span>
        <span class="officer-event-money">${formatMoney(event.plannedBudget)}</span>
      </summary>
      <div class="officer-event-body">
        <div class="officer-event-stats">
          <span><small>Planned</small><strong>${formatMoney(event.plannedBudget)}</strong></span>
          <span><small>Actual</small><strong>${formatMoney(event.actualSpend)}</strong></span>
          <span><small>Remaining</small><strong class="${event.remainingBudget < 0 ? "over-budget" : ""}">${formatMoney(event.remainingBudget)}</strong></span>
          <span><small>RSVPs</small><strong>${rsvps.length}</strong></span>
        </div>
        <div class="officer-event-quick-facts">
          <span><strong>Room</strong>${escapeHtml(event.roomStatus || "Not set")}</span>
          <span><strong>Backup</strong>${escapeHtml(event.backupRoom || "None")} · ${escapeHtml(event.backupRoomStatus || "Not set")}</span>
          <span><strong>Permit</strong>${escapeHtml(event.permitStatus || "Not set")}${event.permitNumber ? ` · ${escapeHtml(event.permitNumber)}` : ""}</span>
          <span><strong>Funding</strong>${escapeHtml(event.fundingSource || "Not assigned")}</span>
        </div>
        <div class="officer-event-actions">
          <button class="primary-button" type="button" data-start-event="${escapeHtml(event.id)}">${state.checkInOpen && state.activeCheckInEventId === event.id ? "Check-In Is Live" : "Start Event Check-In"}</button>
          ${state.checkInOpen && state.activeCheckInEventId === event.id ? `<button class="secondary-button" id="close-checkin-${escapeHtml(event.id)}" data-close-event="${escapeHtml(event.id)}" type="button">Close Check-In</button>` : ""}
        </div>
        <details class="officer-event-subsection">
          <summary>Event details & notes</summary>
          ${renderOfficerEventForm(event)}
        </details>
        <details class="officer-event-subsection">
          <summary><span>RSVPs</span><small>${rsvps.length} going · ${event.officerRsvps?.length || 0} officers</small></summary>
          <div class="event-rsvp-roster">${rsvps.length ? rsvps.map((entry) => `<span><strong>${escapeHtml(entry.displayName)}</strong><small>${entry.role === "officer" ? "Officer" : "Member"}</small></span>`).join("") : '<p class="empty-state">No RSVPs yet.</p>'}</div>
        </details>
        <details class="officer-event-subsection">
          <summary><span>Budget & purchases</span><small>${items.length} ${items.length === 1 ? "item" : "items"} · ${escapeHtml(event.budgetStatus || "No plan")}</small></summary>
          <div class="event-budget-editor">
            ${items.map((item) => renderBudgetItemForm(item, event)).join("") || '<p class="empty-state">No budget items yet.</p>'}
            ${renderBudgetItemForm({}, event, true)}
          </div>
        </details>
      </div>
    </details>
  `;
}

function officerResourceRoleKey() {
  if (state.leadership === "president") return "president";
  if (state.leadership === "vice_president") return "vice-president";
  if (state.leadership === "treasurer") return "treasurer";
  const title = String(state.officerTitle || "").toLowerCase();
  if (title.includes("vice") && title.includes("president")) return "vice-president";
  if (title.includes("president")) return "president";
  if (title.includes("treasurer")) return "treasurer";
  if (title.includes("secretary")) return "secretary";
  if (title.includes("workshop")) return "workshop";
  if (title.includes("outreach")) return "outreach";
  if (title.includes("social")) return "social-media";
  if (title.includes("merch")) return "merch";
  return "general";
}

function renderResourceLink(resource, featured = false) {
  return `
    <a class="officer-resource-card${featured ? " featured" : ""}" href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">
      <span class="officer-resource-icon" aria-hidden="true"><svg><use href="#icon-file"></use></svg></span>
      <span class="officer-resource-copy"><strong>${escapeHtml(resource.title)}</strong><small>${escapeHtml(resource.kind || "Google Drive")}</small><p>${escapeHtml(resource.summary || "Open this FQC officer resource in Google Drive.")}</p></span>
      <span class="officer-resource-open" aria-hidden="true">↗</span>
    </a>
  `;
}

function renderOfficerResources() {
  const currentRole = officerResourceRoleKey();
  const roleName = roleLabel();
  if ((!state.officerResourcesLoaded || state.officerResourcesLoading) && !state.officerResources.length && !state.officerResourcesError) {
    return `
      <section class="section officer-resources" aria-live="polite">
        <p class="section-kicker">Useful information</p>
        <h2>${escapeHtml(roleName)} Resources</h2>
        <p>Loading your secure FQC Drive toolkit…</p>
      </section>
    `;
  }
  if (state.officerResourcesError && !state.officerResources.length) {
    return `
      <section class="section officer-resources" aria-live="polite">
        <p class="section-kicker">Useful information</p>
        <h2>${escapeHtml(roleName)} Resources</h2>
        <p>${escapeHtml(state.officerResourcesError)}</p>
        <button class="secondary-button" id="retry-officer-resources" type="button">Try Again</button>
      </section>
    `;
  }

  const personal = state.officerResources
    .filter((resource) => resource.featured?.includes("all") || resource.featured?.includes(currentRole))
    .sort((a, b) => Number(b.roles?.includes(currentRole)) - Number(a.roles?.includes(currentRole)))
    .slice(0, 6);
  const grouped = state.officerResources.reduce((groups, resource) => {
    const category = resource.category || "Other Resources";
    (groups[category] ||= []).push(resource);
    return groups;
  }, {});

  return `
    <section class="section officer-resources">
      <div class="section-header officer-resource-header">
        <div><p class="section-kicker">Useful information</p><h2>Your ${escapeHtml(roleName)} Toolkit</h2><p>Your most useful FQC Drive documents are first. Links open in Google Drive on phones and computers.</p></div>
        <span class="role-badge officer">${escapeHtml(roleName)}</span>
      </div>
      <div class="officer-resource-featured" aria-label="Your ${escapeHtml(roleName)} resources">
        ${personal.length ? personal.map((resource) => renderResourceLink(resource, true)).join("") : '<p class="empty-state">Your role guide is being organized. Use the complete Drive library below.</p>'}
      </div>
      <details class="officer-resource-browser">
        <summary><span>All Officer Documents</span><small>${state.officerResources.length} current resources</small></summary>
        <div class="officer-resource-groups">
          ${Object.entries(grouped).map(([category, resources]) => `
            <section class="officer-resource-group">
              <h3>${escapeHtml(category)}</h3>
              <div>${resources.map((resource) => renderResourceLink(resource)).join("")}</div>
            </section>
          `).join("")}
        </div>
      </details>
    </section>
  `;
}

function renderRoleWorkspace() {
  if (state.memberRole !== "officer") return "";
  return `
    <section class="section admin-roster">
      <div class="section-header">
        <div>
          <p class="section-kicker">${state.canManageOfficers ? "President & Treasurer" : "Current officers"}</p>
          <h2>${state.canManageOfficers ? "Officer Management" : "Officer Recommendations"}</h2>
          <p>${state.canManageOfficers
            ? "Promote members or remove ordinary officers. President and Treasurer accounts are protected."
            : "Recommend a signed-in member for officer access. The President or Treasurer completes every role change."}</p>
        </div>
        <button class="secondary-button" id="refresh-members" type="button" ${state.membersLoading ? "disabled" : ""}>${state.membersLoading ? "Loading…" : "Refresh"}</button>
      </div>
      <div class="member-roster" aria-live="polite">
        ${state.membersLoading && !state.members.length ? '<p class="empty-state">Loading FQC accounts…</p>' : state.members.length ? state.members.map((member) => `
          <article class="member-role-row" data-member-id="${escapeHtml(member.uid)}">
            <div class="member-identity">
              <strong>${escapeHtml(member.displayName)}</strong>
              <span>${escapeHtml(member.email || "No shared email")} · ${escapeHtml(profileRoleLabel(member))}${member.officerNomination === "pending" ? " · Recommendation pending" : ""}</span>
            </div>
            ${state.canManageOfficers ? `
              <label>
                <span class="sr-only">Role for ${escapeHtml(member.displayName)}</span>
                <select data-member-role="${escapeHtml(member.uid)}" ${member.leadership ? "disabled" : ""}>
                  <option value="member" ${member.role === "member" ? "selected" : ""}>Member</option>
                  <option value="officer" ${member.role === "officer" ? "selected" : ""}>Officer</option>
                </select>
              </label>
              <button class="secondary-button" data-save-member-role="${escapeHtml(member.uid)}" type="button" ${member.leadership ? "disabled" : ""}>Save role</button>
            ` : member.role === "member" ? `
              <button class="secondary-button" data-recommend-officer="${escapeHtml(member.uid)}" type="button" ${member.officerNomination === "pending" ? "disabled" : ""}>${member.officerNomination === "pending" ? "Recommended" : "Recommend officer"}</button>
            ` : '<span class="role-badge officer">Officer</span>'}
          </article>
        `).join("") : '<p class="empty-state">No FQC accounts have signed in yet.</p>'}
      </div>
    </section>
  `;
}

function renderUfidForm(onboarding = false) {
  return `
    <section class="section ufid-card${onboarding ? " ufid-onboarding" : ""}">
      <div class="section-header">
        <div>
          <p class="section-kicker">${onboarding ? "One-time account setup" : "Secure role verification"}</p>
          <h2>${onboarding ? "Enter your UFID" : "Verify a different UFID"}</h2>
          <p>Firebase compares a protected fingerprint with the officer roster. The eight-digit UFID is never saved or sent back to the browser.</p>
        </div>
        ${onboarding ? `<button class="secondary-button" id="profile-logout" type="button" ${state.authBusy ? "disabled" : ""}>Sign Out</button>` : ""}
      </div>
      <div class="form-row">
        <label for="member-ufid">Eight-digit UFID</label>
        <input id="member-ufid" type="text" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" autocomplete="off" placeholder="8-digit UFID" />
      </div>
      <button class="primary-button" id="verify-ufid" type="button" ${state.authBusy ? "disabled" : ""}><svg><use href="#icon-check"></use></svg><span>${onboarding ? "Finish Account Setup" : "Check UFID Role"}</span></button>
      ${state.authBusy ? '<p class="auth-working"><span class="auth-spinner" aria-hidden="true"></span> Checking the secure officer roster…</p>' : ""}
      ${onboarding ? renderAuthFeedback() : ""}
      <p class="auth-privacy">A matching active roster entry receives its listed role, including President, Treasurer, Vice President, or another officer title. No match creates a normal Member account.</p>
    </section>
  `;
}

function renderAccountSettings() {
  if (!state.authReady) return renderAuthLoading("settings");
  if (!state.loggedIn) {
    return `<section class="section settings-account-summary"><div class="section-header"><div><p class="section-kicker">Account management</p><h2>No account signed in</h2><p>Open Profile to log in or create an account.</p></div><button class="secondary-button" id="settings-go-to-login" type="button">Open Login</button></div></section>`;
  }
  return `
    <section class="section settings-account-summary">
      <div class="section-header"><div><p class="section-kicker">Account management</p><h2>${escapeHtml(state.memberName)}</h2><p>${escapeHtml(state.memberEmail || "Secure Firebase account")} · ${escapeHtml(roleLabel())}</p></div><button class="secondary-button" id="profile-logout" type="button" ${state.authBusy ? "disabled" : ""}>Sign Out</button></div>
      <div class="form-row"><label for="member-name">Display name</label><input id="member-name" value="${escapeHtml(state.memberName)}" /></div>
      <button class="primary-button" id="save-profile" type="button" ${state.authBusy ? "disabled" : ""}><svg><use href="#icon-check"></use></svg><span>Save Profile</span></button>
      ${renderAuthFeedback()}
    </section>
    <details class="section settings-group passkey-card">
      <summary><span><p class="section-kicker">Security</p><strong>Passkeys & Face ID</strong></span><small>${state.passkeyCount} ${state.passkeyCount === 1 ? "passkey" : "passkeys"}</small></summary>
      <div class="settings-group-content"><p>Use Face ID, Touch ID, your screen lock, or a hardware security key next time.</p><button class="primary-button" id="register-passkey" type="button" ${state.authBusy || !supportsPasskeys() ? "disabled" : ""}><svg><use href="#icon-lock"></use></svg><span>${supportsPasskeys() ? "Set Up Face ID / Touch ID" : "Passkeys unavailable"}</span></button></div>
    </details>
    <details class="section settings-group">
      <summary><span><p class="section-kicker">Identity</p><strong>UFID & role verification</strong></span><small>${escapeHtml(roleLabel())}</small></summary>
      <div class="settings-group-content">${renderUfidForm(false)}</div>
    </details>
    ${state.memberRole === "officer" ? renderRoleWorkspace() : ""}
  `;
}

function renderSettings() {
  return `
    <section class="view settings-view" data-screen="settings">
      <section class="section settings-hero">
        <div>
          <p class="section-kicker">App settings</p>
          <h2>Florida Quantum Computing</h2>
          <p>Version ${APP_VERSION} · Released ${APP_RELEASE_DATE}</p>
        </div>
        <button class="secondary-button" id="close-settings" type="button">Back</button>
      </section>
      ${renderAccountSettings()}
      <section class="section">
        <div class="section-header">
          <div><h2>Updates</h2><p>Fetch the newest app shell while keeping your account and saved app data.</p></div>
        </div>
        <button class="primary-button" id="check-for-updates" type="button" ${state.authBusy ? "disabled" : ""}>
          <svg><use href="#icon-check"></use></svg><span>Check for Updates</span>
        </button>
      </section>
      <details class="section settings-group version-history-settings">
        <summary><span><p class="section-kicker">What changed</p><h2>Version History</h2></span><small>v${APP_VERSION}</small></summary>
        <div class="settings-group-content version-history">
          ${RELEASE_HISTORY.map(([version, summary], index) => `
            <article class="version-row">
              <span class="version-number">v${escapeHtml(version)}${index === 0 ? " · Current" : ""}</span>
              <p>${escapeHtml(summary)}</p>
            </article>
          `).join("")}
        </div>
      </details>
      <details class="section advanced-settings">
        <summary>Advanced settings</summary>
        <div class="advanced-settings-content">
          <h2>Reset this device</h2>
          <p>Nuke & Reload signs out, removes this device’s FQC preferences and offline cache, then downloads a completely fresh copy. Firebase attendance and account records are not deleted.</p>
          <button class="danger-button" id="nuke-reload" type="button"><svg><use href="#icon-plus"></use></svg><span>Nuke & Reload</span></button>
        </div>
      </details>
    </section>
  `;
}

function renderLeaderboard() {
  if (state.leaderboardLoading && !state.leaderboardLoaded) {
    return `
      <section class="section leaderboard-section" aria-labelledby="leaderboard-title">
        <div class="section-header"><div><p class="section-kicker">Club standings</p><h2 id="leaderboard-title">Leaderboard</h2><p>Loading verified event standings…</p></div><span class="auth-spinner" aria-hidden="true"></span></div>
      </section>
    `;
  }

  if (state.leaderboardError && !state.leaderboardEntries.length) {
    return `
      <section class="section leaderboard-section" aria-labelledby="leaderboard-title">
        <div class="section-header"><div><p class="section-kicker">Club standings</p><h2 id="leaderboard-title">Leaderboard</h2><p>${escapeHtml(state.leaderboardError)}</p></div><button class="secondary-button" id="refresh-leaderboard" type="button">Try Again</button></div>
      </section>
    `;
  }

  const currentUid = state.authUser?.uid || "";
  const entries = state.leaderboardEntries;
  return `
    <section class="section leaderboard-section" aria-labelledby="leaderboard-title">
      <div class="section-header">
        <div><p class="section-kicker">Club standings</p><h2 id="leaderboard-title">Leaderboard</h2><p>${state.leaderboardParticipantCount || entries.length} participant${(state.leaderboardParticipantCount || entries.length) === 1 ? "" : "s"} · verified event check-ins</p></div>
        <button class="secondary-button leaderboard-refresh" id="refresh-leaderboard" type="button" ${state.leaderboardLoading ? "disabled" : ""}>${state.leaderboardLoading ? "Refreshing…" : "Refresh"}</button>
      </div>
      ${entries.length ? `<div class="leaderboard">${entries.map((entry, index) => {
        const rank = index + 1;
        const isCurrentUser = entry.uid === currentUid;
        const previous = index > 0 ? entries[index - 1] : null;
        const pointsToOvertake = isCurrentUser && previous ? Math.max(1, previous.points - entry.points + 1) : 0;
        return `
          <article class="leader-card rank-${Math.min(rank, 4)}${isCurrentUser ? " current-user" : ""}">
            <span class="leader-rank" aria-label="Rank ${rank}">${rank === 1 ? "♛" : rank}</span>
            <div class="leader-identity">
              <h3>${isCurrentUser ? "You" : escapeHtml(entry.displayName)}</h3>
              <p>${entry.role === "officer" ? "Officer" : "Member"} · ${entry.points} event${entry.points === 1 ? "" : "s"} attended</p>
              ${pointsToOvertake ? `<small>${pointsToOvertake} ${pointsToOvertake === 1 ? "point" : "points"} to move ahead</small>` : ""}
            </div>
            <strong class="leader-points">${entry.points} <span>PT${entry.points === 1 ? "" : "S"}</span></strong>
          </article>
        `;
      }).join("")}</div>` : '<p class="empty-state">No ranked members yet. The first event check-in starts the standings.</p>'}
    </section>
  `;
}

function renderProfile() {
  if (!state.authReady) return renderAuthLoading("profile");
  if (!state.loggedIn) {
    const creating = state.authMode === "create";
    return `
      <section class="view" data-screen="profile">
        <section class="section profile-login">
          <div class="auth-brand">
            <div class="checkin-icon"><svg><use href="#icon-lock"></use></svg></div>
            <div>
              <p class="section-kicker">One secure FQC account</p>
              <h2>${creating ? "Create your FQC account" : "Welcome back"}</h2>
              <p>${creating ? "Create your account with your email, password, and UFID." : "Log in with your email and password, Google, Apple, or a passkey."}</p>
            </div>
          </div>
          <div class="auth-mode-tabs" role="tablist" aria-label="Account access">
            <button id="auth-mode-login" role="tab" aria-selected="${creating ? "false" : "true"}" type="button">Log In</button>
            <button id="auth-mode-create" role="tab" aria-selected="${creating ? "true" : "false"}" type="button">Create Account</button>
          </div>
          <form class="email-auth-form" id="email-auth-form">
            ${creating ? `
              <div class="form-row">
                <label for="auth-name">Name</label>
                <input id="auth-name" name="name" autocomplete="name" maxlength="80" placeholder="Your name" required />
              </div>
            ` : ""}
            <div class="form-row">
              <label for="auth-email">Email</label>
              <input id="auth-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@ufl.edu" required />
            </div>
            <div class="form-row">
              <label for="auth-password">Password</label>
              <input id="auth-password" name="password" type="password" autocomplete="${creating ? "new-password" : "current-password"}" minlength="8" placeholder="At least 8 characters" required />
            </div>
            ${creating ? `
              <div class="form-row ufid-create-field">
                <label for="auth-ufid">UFID</label>
                <input id="auth-ufid" name="ufid" type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]{8}" maxlength="8" placeholder="8-digit UFID" required />
                <small>Used once to assign your current FQC role. Your raw UFID is never stored.</small>
              </div>
            ` : ""}
            <button class="primary-button email-auth-submit" type="submit" ${state.authBusy ? "disabled" : ""}>
              <svg><use href="#icon-lock"></use></svg><span>${creating ? "Create Account" : "Log In"}</span>
            </button>
            ${creating ? "" : '<button class="text-button" id="forgot-password" type="button">Forgot password?</button>'}
          </form>
          ${creating ? "" : `
            <div class="auth-divider"><span>or</span></div>
            <div class="auth-provider-list">
              <button class="auth-provider-button google" id="sign-in-google" type="button" ${state.authBusy ? "disabled" : ""}>
                <span class="provider-mark" aria-hidden="true">G</span><span>Continue with Google</span>
              </button>
              <button class="auth-provider-button apple" id="sign-in-apple" type="button" ${state.authBusy ? "disabled" : ""}>
                <span class="provider-mark apple-mark" aria-hidden="true"></span><span>Continue with Apple</span>
              </button>
              <button class="auth-provider-button passkey" id="sign-in-passkey" type="button" ${state.authBusy || !supportsPasskeys() ? "disabled" : ""}>
                <svg><use href="#icon-lock"></use></svg><span>${supportsPasskeys() ? "Sign in with a passkey" : "Passkeys unavailable on this device"}</span>
              </button>
            </div>
          `}
          ${state.authBusy ? '<p class="auth-working"><span class="auth-spinner" aria-hidden="true"></span> Opening secure sign-in…</p>' : ""}
          ${renderAuthFeedback()}
          <p class="auth-privacy">Firebase Authentication protects passwords and sign-in sessions. FQC never stores your password or raw UFID.</p>
        </section>
      </section>
    `;
  }

  if (state.ufidStatus === "required") {
    return `<section class="view" data-screen="profile">${renderUfidForm(true)}</section>`;
  }

  const points = state.memberPoints;
  return `
    <section class="view" data-screen="profile">
      <section class="section profile-overview">
        <div class="profile-summary">
          <div class="avatar">${profileInitial.textContent}</div>
          <div><div class="profile-role-line"><h2>${escapeHtml(state.memberName)}</h2><span class="role-badge ${state.memberRole}">${roleLabel()}</span></div><p>${points} ${points === 1 ? "point" : "points"} from verified event check-ins</p><div class="progress" aria-label="Event attendance progress"><span style="width: ${Math.min(100, points * 20)}%"></span></div></div>
        </div>
      </section>
      ${renderLeaderboard()}
      ${state.memberRole === "officer" ? renderOfficerWorkspace() : ""}
    </section>
  `;
}

function bindViewEvents() {
  document.querySelectorAll("[data-event-tab]").forEach((button) => {
    button.addEventListener("click", () => setEventMode(button.dataset.eventTab));
  });
  document.querySelectorAll(".event-list [data-select-event]").forEach((button) => {
    button.addEventListener("click", () => selectEvent(button.dataset.selectEvent));
  });
  document.querySelector("#retry-officer-resources")?.addEventListener("click", () => refreshOfficerResources(true));
  document.querySelector("#retry-officer-operations")?.addEventListener("click", () => refreshOfficerOperations(true));
  document.querySelector("#refresh-officer-operations")?.addEventListener("click", () => refreshOfficerOperations(true));
  bindCalendarEvents();
  bindRsvpEvents();
  bindMobileEventSheet();

  document.querySelector("#go-to-login")?.addEventListener("click", () => setView("profile"));
  document.querySelector("#settings-go-to-login")?.addEventListener("click", () => setView("profile"));
  document.querySelector("#close-settings")?.addEventListener("click", () => setView(state.loggedIn ? "profile" : "home"));
  document.querySelector("#check-for-updates")?.addEventListener("click", checkForUpdates);
  document.querySelector("#refresh-leaderboard")?.addEventListener("click", () => refreshLeaderboard(true));

  document.querySelector("#auth-mode-login")?.addEventListener("click", () => {
    state.authMode = "login";
    state.authError = "";
    state.authMessage = "";
    render();
  });
  document.querySelector("#auth-mode-create")?.addEventListener("click", () => {
    state.authMode = "create";
    state.authError = "";
    state.authMessage = "";
    render();
  });
  document.querySelector("#email-auth-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#auth-email")?.value.trim() || "";
    const password = document.querySelector("#auth-password")?.value || "";
    if (state.authMode === "create") {
      const displayName = document.querySelector("#auth-name")?.value.trim() || "";
      const ufid = document.querySelector("#auth-ufid")?.value.trim() || "";
      if (displayName.length < 2) {
        state.authError = "Enter your name.";
        render();
        return;
      }
      if (!/^\d{8}$/.test(ufid)) {
        state.authError = "Enter an eight-digit UFID.";
        render();
        return;
      }
      const profile = await runAuthAction(
        () => createEmailAccount({ displayName, email, password, ufid }),
        "Account created securely."
      );
      if (profile) applyMemberProfile(profile);
      return;
    }
    await runAuthAction(() => signInWithEmail(email, password));
  });
  document.querySelector("#forgot-password")?.addEventListener("click", async () => {
    const email = document.querySelector("#auth-email")?.value.trim() || "";
    if (!email) {
      state.authError = "Enter your email first, then choose Forgot password.";
      render();
      return;
    }
    await runAuthAction(() => requestPasswordReset(email), `Password reset email sent to ${email}.`);
  });

  document.querySelector("#sign-in-google")?.addEventListener("click", () => runAuthAction(signInWithGoogle));
  document.querySelector("#sign-in-apple")?.addEventListener("click", () => runAuthAction(signInWithApple));
  document.querySelector("#sign-in-passkey")?.addEventListener("click", () => runAuthAction(signInWithPasskey));
  document.querySelector("#profile-logout")?.addEventListener("click", () => runAuthAction(logOut));
  document.querySelector("#verify-ufid")?.addEventListener("click", async () => {
    const input = document.querySelector("#member-ufid");
    const ufid = input?.value.trim() || "";
    if (!/^\d{8}$/.test(ufid)) {
      state.authError = "Enter an eight-digit UFID.";
      render();
      return;
    }
    const profile = await runAuthAction(() => verifyUfid(ufid), "UFID checked securely. Your account role is updated.");
    if (profile) {
      if (input) input.value = "";
      applyMemberProfile(profile);
      state.members = [];
      state.leaderboardLoaded = false;
      render();
      queueMicrotask(() => refreshLeaderboard());
      if (state.memberRole === "officer") queueMicrotask(refreshMemberDirectory);
    }
  });
  document.querySelector("#register-passkey")?.addEventListener("click", async () => {
    const profile = await runAuthAction(registerPasskey, "Passkey added. You can now use Face ID, Touch ID, or your device lock to sign in.");
    if (profile) {
      applyMemberProfile(profile);
      render();
    }
  });

  document.querySelector("#check-in-now")?.addEventListener("click", async () => {
    if (!state.loggedIn || !state.checkInOpen) return;
    const result = await runAuthAction(recordCheckIn);
    if (result?.eventId && !state.checkedInEvents.includes(result.eventId)) {
      state.checkedInEvents = [...state.checkedInEvents, state.activeCheckInEventId];
    }
    if (result?.eventId) {
      state.memberPoints = Number(result.points) || state.checkedInEvents.length;
      if (result.leaderboard) {
        state.leaderboardEntries = result.leaderboard.entries || [];
        state.leaderboardParticipantCount = result.leaderboard.participantCount || state.leaderboardEntries.length;
        state.leaderboardLoaded = true;
      }
      render();
    }
  });

  document.querySelectorAll("[data-officer-event]").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.open) state.selectedOfficerEventId = details.dataset.officerEvent;
    });
  });

  document.querySelectorAll("[data-officer-event-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      const eventId = form.dataset.officerEventForm === "new" ? "" : form.dataset.officerEventForm;
      const saved = await runAuthAction(() => saveOfficerEvent({ id: eventId, ...values }), eventId ? "Event details saved to Google Sheets." : "Event created in Google Sheets.");
      if (!saved) return;
      state.officerOperationsLoaded = false;
      await refreshOfficerOperations(true);
      await refreshEventData("officer event save");
    });
  });

  document.querySelectorAll("[data-budget-item-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const eventId = form.dataset.budgetEvent;
      const eventRecord = state.officerOperations?.events?.find((entry) => entry.id === eventId);
      if (!eventRecord) return;
      const values = Object.fromEntries(new FormData(form));
      const row = form.dataset.budgetItemForm === "new" ? 0 : Number(form.dataset.budgetItemForm);
      const saved = await runAuthAction(() => saveOfficerBudgetItem({ row, eventId, event: eventRecord.title, date: eventRecord.date, ...values }), "Money changes saved to Google Sheets.");
      if (!saved) return;
      state.officerOperationsLoaded = false;
      await refreshOfficerOperations(true);
      await refreshEventData("officer budget save");
    });
  });

  document.querySelectorAll("[data-start-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (state.memberRole !== "officer") return;
      const eventId = button.dataset.startEvent;
      await runAuthAction(() => updateActiveCheckIn(eventId, true), "Event check-in is open from the middle tab.");
    });
  });
  document.querySelectorAll("[data-close-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (state.memberRole !== "officer") return;
      await runAuthAction(() => updateActiveCheckIn(button.dataset.closeEvent, false), "Event check-in is closed.");
    });
  });

  document.querySelector("#save-profile")?.addEventListener("click", async () => {
    const name = document.querySelector("#member-name").value.trim();
    if (name.length < 2) {
      state.authError = "Enter a display name.";
      render();
      return;
    }
    const profile = await runAuthAction(() => updateProfileName(name), "Profile saved.");
    if (profile) {
      applyMemberProfile(profile);
      state.leaderboardLoaded = false;
      render();
      queueMicrotask(() => refreshLeaderboard());
    }
  });

  document.querySelector("#refresh-members")?.addEventListener("click", refreshMemberDirectory);
  document.querySelectorAll("[data-save-member-role]").forEach((button) => {
    button.addEventListener("click", async () => {
      const uid = button.dataset.saveMemberRole;
      const role = document.querySelector(`[data-member-role="${CSS.escape(uid)}"]`)?.value || "member";
      const updated = await runAuthAction(() => changeMemberRole(uid, role), "Member role updated.");
      if (updated) await refreshMemberDirectory();
    });
  });
  document.querySelectorAll("[data-recommend-officer]").forEach((button) => {
    button.addEventListener("click", async () => {
      const uid = button.dataset.recommendOfficer;
      const recommended = await runAuthAction(() => recommendOfficer(uid), "Officer recommendation sent to the President and Treasurer.");
      if (recommended) await refreshMemberDirectory();
    });
  });

  document.querySelector("#nuke-reload")?.addEventListener("click", nukeAndReload);
}

navItems.forEach((item) => item.addEventListener("click", () => setView(item.dataset.view)));
quickProfile.addEventListener("click", () => setView("profile"));
settingsToggle.addEventListener("click", () => setView("settings"));
themeToggle.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {}));
}

["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
  document.addEventListener(eventName, stopZoomGesture, { passive: false });
});

window.addEventListener("online", () => {
  refreshEventData("network reconnect");
  if (state.memberRole === "officer") refreshOfficerOperations(true);
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshEventData("tab became active");
    if (state.memberRole === "officer") refreshOfficerOperations(true);
  }
});
window.setInterval(() => {
  if (!document.hidden && navigator.onLine) {
    refreshEventData("five-minute refresh");
    if (state.memberRole === "officer") refreshOfficerOperations(true);
  }
}, EVENT_REFRESH_INTERVAL_MS);

observeSession((session) => {
  state.authReady = true;
  state.authUser = session?.user || null;
  state.loggedIn = Boolean(session?.user);
  if (session?.profile) {
    applyMemberProfile(session.profile);
  } else {
    state.memberName = "Future Member";
    state.memberEmail = "";
    state.memberPhotoURL = "";
    state.memberRole = "member";
    state.leadership = "";
    state.officerTitle = "";
    state.canManageOfficers = false;
    state.ufidStatus = "";
    state.passkeyCount = 0;
    state.checkedInEvents = [];
    state.memberPoints = 0;
    state.leaderboardEntries = [];
    state.leaderboardParticipantCount = 0;
    state.leaderboardLoaded = false;
    state.leaderboardLoading = false;
    state.leaderboardError = "";
    state.members = [];
    state.officerResources = [];
    state.officerResourcesLoaded = false;
    state.officerResourcesLoading = false;
    state.officerResourcesError = "";
    localStorage.removeItem("fqc:name");
  }
  render();
  if (state.view === "profile" && state.loggedIn && state.ufidStatus !== "required") queueMicrotask(() => refreshLeaderboard());
  if (state.memberRole === "officer" && !state.members.length && !state.membersLoading) queueMicrotask(refreshMemberDirectory);
  if (state.memberRole === "officer" && !state.officerResourcesLoaded && !state.officerResourcesLoading) queueMicrotask(refreshOfficerResources);
  if (state.memberRole === "officer" && !state.officerOperationsLoaded && !state.officerOperationsLoading) queueMicrotask(refreshOfficerOperations);
}, (error) => {
  state.authReady = true;
  state.authError = readableAuthError(error);
  render();
});

observeCheckIn((checkIn) => {
  state.activeCheckInEventId = events.some((event) => event.id === checkIn.eventId) ? checkIn.eventId : events[0].id;
  state.checkInOpen = checkIn.open === true;
  if (state.authReady) render();
}, (error) => {
  state.authError = readableAuthError(error);
  if (state.authReady) render();
});

applyTheme(state.theme, false);
render();
refreshEventData("initial Google Sheet load");
