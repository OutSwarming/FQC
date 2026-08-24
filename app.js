import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  assignLeadershipRole,
  openLeadershipSeat,
  checkUsername,
  changeMemberRole,
  createEmailAccount,
  deleteOfficerBudgetItem,
  loadLeaderboard,
  loadMembers,
  loadOfficerEventOperations,
  loadOfficerResources,
  logOut,
  observeCheckIn,
  observeSession,
  readableAuthError,
  requestPasswordReset,
  sendPasswordSetupEmail,
  recordCheckIn,
  registerPasskey,
  removeClubMember,
  saveOfficerBudgetItem,
  saveOfficerEvent,
  signInWithEmail,
  signInWithPasskey,
  supportsPasskeys,
  updateActiveCheckIn,
  updateCheckInLocationRequirement,
  updateEventRsvp,
  updateProfileName
} from "./firebase-client.js";

const APP_VERSION = "2.12.0";
const APP_RELEASE_DATE = "August 14, 2026";
const RELEASE_HISTORY = [
  ["2.12.0", "Enforced the UF email requirement on the server, so a new account cannot be opened with a non-UF address by going around the browser"],
  ["2.11.0", "Added an emailed password link so a passkey member can get in on a device that has no passkey, spelled that out on the login screen, stopped the reset form revealing which accounts exist, and stopped re-registering a device inflating the passkey count"],
  ["2.10.0", "Removed UFID verification everywhere. Every new account starts as a member, any officer can make a member an officer, and the President or Treasurer still handles leadership seats, demotions, and removals. Passkey, Face ID, and Touch ID sign-in are unchanged."],
  ["2.9.3", "Capped the leaderboard at ten with a scrollable full-standings popup instead of one long scroll"],
  ["2.9.2", "Listed every officer seat instead of only pending matches, made account settings and updates collapsible, freed up display names with a uniqueness check, pinned the event tabs, and stopped the map from re-zooming or pinning past events"],
  ["2.9.1", "Adopted the FQC mark as the app icon and home-screen install, so the installed app opens full screen with no address bar or browser buttons"],
  ["2.9.0","Counted events on each map pin, added budget line add/remove with funding dropdowns, tucked officer-only settings away, and moved member management into a real leaderboard with member profiles"],
  ["2.8.1", "Repaired officer money and RSVP saving, kept the workspace open and in place after every save, and put each event's planned total on its card"],
  ["2.8.0", "Simplified the officer profile into compact current events, completed events, resources, and a tucked-away club budget"],
  ["2.7.0", "Polished RSVP, sign-in, and check-in handoffs with faster location checks and clear live confirmation feedback"],
  ["2.6.1", "Moved three-step signup into a dismissible modal and removed the duplicate post-account UFID screen"],
  ["2.6.0", "Added a welcoming three-step signup, unique usernames, username-or-UF-email login, and passkey-only account setup"],
  ["2.5.1", "Added secure pending-leadership account linking and verified every officer-title permission path"],
  ["2.5.0", "Added the Master Members attendance roster and secure two-mile event check-in verification with an officer online-event switch"],
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
const MAX_DISPLAY_NAME = 80;
const LEADERBOARD_PREVIEW = 10;
const FUNDING_SOURCES = ["Advertising Operation", "Food Operation", "Base Funds"];
const BUDGET_UNITS = ["each", "order", "tray", "box", "pack", "dozen", "gallon", "person", "hour", "flat rate"];
const BUDGET_STATUSES = ["Estimate", "Needs quote", "Quoted", "Approved", "Ordered", "Purchased", "Reimbursed"];
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

// A default view over the core campus so the map always renders tiles even
// before any pins exist — e.g. a cold first load whose bundled fallback
// schedule is all past events (0 upcoming = 0 markers = nothing to fit).
const UF_CAMPUS_CENTER = Object.freeze({ lat: 29.647, lng: -82.346, zoom: 15 });

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
  memberUsername: "",
  memberEmail: "",
  memberPhotoURL: "",
  loggedIn: false,
  authReady: false,
  authBusy: false,
  authError: "",
  authMessage: "",
  authMode: "login",
  authPromptOpen: false,
  authPromptAction: "",
  authPromptEventId: "",
  pendingIntent: null,
  signupOpen: false,
  signupStep: 1,
  signupEmail: "",
  signupUsername: "",
  signupMethod: "passkey",
  authUser: null,
  memberRole: "member",
  leadership: "",
  officerTitle: "",
  canManageOfficers: false,
  passkeyCount: 0,
  members: [],
  leadershipSlots: [],
  leadershipRoster: [],
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
  openDisclosures: {},
  memberProfileUid: "",
  leaderboardExpanded: false,
  showAllOfficerEvents: false,
  budgetBreakdownOpen: false,
  activeCheckInEventId: "fqc-2026-03-03-ionq",
  checkInOpen: false,
  checkInRequireLocation: true,
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
let renderedView = "";
let installPrompt = null;
let savedMapView = null;
let mapPinSignature = "";

function isInstalledApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches === true
    || window.matchMedia?.("(display-mode: fullscreen)").matches === true
    || window.navigator.standalone === true;
}

function isIosDevice() {
  const agent = String(window.navigator.userAgent || "");
  return /iPad|iPhone|iPod/.test(agent)
    || (/Macintosh/.test(agent) && window.navigator.maxTouchPoints > 1);
}
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

// Exact lookup: unlike getEvent, an unknown id stays unknown instead of
// silently reporting the first event on the schedule.
function findEventById(eventId) {
  return events.find((event) => event.id === eventId)
    || state.officerOperations?.events?.find((event) => event.id === eventId)
    || null;
}

function getEventLocation(event) {
  return event ? locations[event.locationId] : undefined;
}

function eventsByLocation(source = events) {
  const grouped = new Map();
  source.forEach((event) => {
    const location = getEventLocation(event);
    if (!location) return;
    if (!grouped.has(location.id)) grouped.set(location.id, { location, events: [] });
    grouped.get(location.id).events.push(event);
  });
  return [...grouped.values()];
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
  if (state.memberRole === "officer" && !state.members.length && (state.view === "settings" || state.view === "profile")) {
    queueMicrotask(refreshMemberDirectory);
  }
}

function isDisclosureOpen(key, defaultOpen = false) {
  return key in state.openDisclosures ? state.openDisclosures[key] === true : defaultOpen;
}

function disclosureAttrs(key, defaultOpen = false) {
  return `data-disclosure="${escapeHtml(key)}"${isDisclosureOpen(key, defaultOpen) ? " open" : ""}`;
}

function render() {
  if (eventMap) {
    // Remember where the reader had the map so the rebuild lands in the same place.
    savedMapView = { center: eventMap.getCenter(), zoom: eventMap.getZoom() };
    if (pendingMapPan) eventMap.off("moveend", pendingMapPan);
    eventMap.remove();
    eventMap = null;
    eventMarkers = new Map();
    pendingMapPan = null;
  }

  const eventsScreenActive = state.view === "home";
  document.documentElement.classList.toggle("events-screen-active", eventsScreenActive);
  document.body.classList.toggle("events-screen-active", eventsScreenActive);
  document.body.classList.toggle("signup-modal-open", state.signupOpen || state.authPromptOpen || state.budgetBreakdownOpen || Boolean(state.memberProfileUid) || state.leaderboardExpanded);
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

  const sameView = renderedView === state.view;
  const previousScrollY = window.scrollY;
  app.innerHTML = `${views[state.view]?.() || renderHome()}${state.authPromptOpen ? renderAuthPromptModal() : ""}${state.signupOpen ? renderSignupModal() : ""}`;
  bindViewEvents();
  renderedView = state.view;
  if (sameView) {
    // Re-rendering in place (a save, a background refresh) must not move the page
    // out from under the officer who is still working in it.
    if (window.scrollY !== previousScrollY) window.scrollTo(0, previousScrollY);
  } else {
    app.focus({ preventScroll: true });
  }
  if (mapInitFrame) cancelAnimationFrame(mapInitFrame);
  if (state.view === "home") {
    mapInitFrame = requestAnimationFrame(() => {
      mapInitFrame = null;
      initEventMap();
    });
  } else {
    mapInitFrame = null;
  }
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

            <div class="event-tabs-sticky">
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
  drawMapMarkers();
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

  const activeLocationId = getEventLocation(getEvent(eventId))?.id;
  eventMarkers.forEach((marker, locationId) => {
    marker.getElement()?.querySelector(".event-map-pin")?.classList.toggle("active", locationId === activeLocationId);
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
  if (!state.loggedIn) {
    state.pendingIntent = { type: "rsvp", eventId };
    state.authPromptOpen = true;
    state.authPromptAction = "rsvp";
    state.authPromptEventId = eventId;
    render();
    return;
  }
  const wasGoing = state.rsvps.includes(eventId);
  const going = !wasGoing;
  state.rsvps = going ? [...state.rsvps, eventId] : state.rsvps.filter((id) => id !== eventId);
  saveState();

  document.querySelectorAll(`[data-rsvp="${eventId}"]`).forEach((button) => {
    button.classList.toggle("going", going);
    button.classList.add("is-working");
    button.disabled = true;
    button.textContent = going ? "Going" : "RSVP";
    button.setAttribute("aria-label", `${going ? "Cancel RSVP for" : "RSVP for"} ${getEvent(eventId).title}`);
  });
  showActionFeedback("working", going ? "Saving your RSVP…" : "Updating your RSVP…");
  try {
    await updateEventRsvp(eventId, going);
    if (state.memberRole === "officer") state.officerOperationsLoaded = false;
    document.querySelectorAll(`[data-rsvp="${eventId}"]`).forEach((button) => {
      button.classList.remove("is-working");
      button.classList.add("is-confirmed");
      button.disabled = false;
      window.setTimeout(() => button.classList.remove("is-confirmed"), 900);
    });
    showActionFeedback("success", going ? "RSVP confirmed — you’re going." : "RSVP removed.");
  } catch (error) {
    state.rsvps = wasGoing ? [...new Set([...state.rsvps, eventId])] : state.rsvps.filter((id) => id !== eventId);
    state.authError = readableAuthError(error);
    saveState();
    showActionFeedback("error", state.authError);
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

// Only one initEventMap() may run per frame; render() can fire several times in
// a single tick (initial paint, auth, sheet load) and each used to queue its own
// map init against the same fresh container — the source of the
// "Map container is already initialized" crash and the blank map on first load.
let mapInitFrame = null;
let appRevealed = false;
const splashStartTime = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

// Fade the FQC splash out once the app has actually rendered (map included),
// holding a short minimum so it reads as intentional rather than a flash.
function revealApp() {
  if (appRevealed) return;
  appRevealed = true;
  const splash = document.getElementById("app-splash");
  if (!splash) return;
  const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  const wait = Math.max(0, 600 - (now - splashStartTime));
  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    document.body.classList.remove("splash-active");
    const removeSplash = () => splash.remove();
    splash.addEventListener("transitionend", removeSplash, { once: true });
    window.setTimeout(removeSplash, 900);
  }, wait);
}

function initEventMap() {
  const mapElement = document.querySelector("#event-map");
  if (!mapElement || !window.L) {
    document.querySelector("#event-map-message")?.removeAttribute("hidden");
    revealApp();
    return;
  }

  // A container can host only one Leaflet map; if one is already bound here the
  // map is live, so reveal and bail instead of throwing "already initialized".
  if (mapElement._leaflet_id) {
    revealApp();
    return;
  }

  eventMap = window.L.map(mapElement, {
    center: [UF_CAMPUS_CENTER.lat, UF_CAMPUS_CENTER.lng],
    zoom: UF_CAMPUS_CENTER.zoom,
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

  drawMapMarkers();
  window.__FQC_MAP__ = eventMap;
  window.setTimeout(() => eventMap?.invalidateSize(), 120);
  window.setTimeout(revealApp, 180);
}

// Pins follow the visible tab, so Past events only appear while Past is open.
function drawMapMarkers() {
  if (!eventMap) return;
  eventMarkers.forEach((marker) => marker.remove());
  eventMarkers = new Map();

  const bounds = [];
  const selectedLocationId = getEventLocation(getEvent(state.selectedEventId))?.id;
  const groups = eventsByLocation(eventsForMode());
  groups.forEach(({ location, events: locationEvents }) => {
    const count = locationEvents.length;
    const marker = window.L.marker([location.lat, location.lng], {
      title: `${location.name} · ${count} ${count === 1 ? "event" : "events"}`,
      alt: `${count} ${count === 1 ? "event" : "events"} at ${location.name}`,
      icon: window.L.divIcon({
        className: "event-marker-shell",
        html: `<span class="event-map-pin${location.id === selectedLocationId ? " active" : ""}" data-location-id="${escapeHtml(location.id)}"><span>${count}</span></span>`,
        iconSize: [44, 48],
        iconAnchor: [22, 44]
      }),
      bubblingMouseEvents: false
    }).addTo(eventMap);
    marker.on("click", () => {
      // Tapping a location keeps the current pick when it already lives there,
      // otherwise it opens the soonest event at that spot.
      const alreadyHere = locationEvents.some((event) => event.id === state.selectedEventId);
      selectEvent(alreadyHere ? state.selectedEventId : locationEvents[0].id, { revealSheet: true });
    });
    eventMarkers.set(location.id, marker);
    bounds.push([location.lat, location.lng]);
  });

  // Only reframe when the pins actually change. Refitting on every repaint is
  // what yanked the map away after a background Sheet refresh.
  const signature = groups.map(({ location, events: list }) => `${location.id}:${list.length}`).join("|");
  if (bounds.length && signature !== mapPinSignature) {
    eventMap.fitBounds(bounds, { padding: [54, 54], maxZoom: 16 });
  } else if (savedMapView) {
    eventMap.setView(savedMapView.center, savedMapView.zoom, { animate: false });
  }
  mapPinSignature = signature;
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
  state.memberUsername = profile.username || "";
  state.memberEmail = profile.email || "";
  state.memberPhotoURL = profile.photoURL || "";
  state.memberRole = profile.role === "officer" ? "officer" : "member";
  state.leadership = ["president", "vice_president", "treasurer"].includes(profile.leadership) ? profile.leadership : "";
  state.officerTitle = profile.officerTitle || "";
  state.canManageOfficers = profile.canManageOfficers === true;
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
  if (!state.loggedIn || state.leaderboardLoading) return;
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

function closeMemberProfile() {
  state.memberProfileUid = "";
  render();
}

function closeFullLeaderboard() {
  state.leaderboardExpanded = false;
  render();
}

let actionFeedbackTimer = 0;

function showActionFeedback(kind, message) {
  window.clearTimeout(actionFeedbackTimer);
  let feedback = document.querySelector("#action-feedback");
  if (!feedback) {
    feedback = document.createElement("div");
    feedback.id = "action-feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    document.body.append(feedback);
  }
  feedback.className = `action-feedback ${kind} visible`;
  feedback.innerHTML = `${kind === "working" ? '<span class="auth-spinner" aria-hidden="true"></span>' : `<span class="action-feedback-icon" aria-hidden="true">${kind === "success" ? "✓" : "!"}</span>`}<span>${escapeHtml(message)}</span>`;
  if (kind !== "working") {
    actionFeedbackTimer = window.setTimeout(() => feedback.classList.remove("visible"), kind === "success" ? 2400 : 4200);
  }
}

function confirmDestructiveAction({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel" }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "signup-modal-backdrop confirm-backdrop";
    backdrop.innerHTML = `
      <section class="signup-modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <h2 id="confirm-title">${escapeHtml(title)}</h2>
        <p id="confirm-message">${escapeHtml(message)}</p>
        <div class="confirm-actions">
          <button class="secondary-button" type="button" data-confirm-cancel>${escapeHtml(cancelLabel)}</button>
          <button class="danger-button" type="button" data-confirm-accept>${escapeHtml(confirmLabel)}</button>
        </div>
      </section>
    `;
    const close = (result) => {
      document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
      document.body.classList.toggle("signup-modal-open", state.signupOpen || state.authPromptOpen || state.budgetBreakdownOpen || Boolean(state.memberProfileUid) || state.leaderboardExpanded);
      resolve(result);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") close(false);
    };
    backdrop.querySelector("[data-confirm-cancel]").addEventListener("click", () => close(false));
    backdrop.querySelector("[data-confirm-accept]").addEventListener("click", () => close(true));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(false);
    });
    document.addEventListener("keydown", onKeyDown);
    document.body.append(backdrop);
    document.body.classList.add("signup-modal-open");
    backdrop.querySelector("[data-confirm-cancel]").focus();
  });
}

function setActiveControlBusy(busy) {
  const active = document.activeElement?.closest?.("button");
  if (busy && active && !active.disabled) {
    active.dataset.actionBusy = "true";
    active.disabled = true;
    active.classList.add("is-working");
    return active;
  }
  return null;
}

async function runAuthAction(action, successMessage = "", workingMessage = "Updating FQC…") {
  state.authBusy = true;
  state.authError = "";
  state.authMessage = "";
  const activeControl = setActiveControlBusy(true);
  showActionFeedback("working", workingMessage);
  try {
    const result = await action();
    showActionFeedback("success", successMessage || "Done — your change is confirmed.");
    return result;
  } catch (error) {
    state.authError = readableAuthError(error);
    showActionFeedback("error", state.authError);
    return null;
  } finally {
    state.authBusy = false;
    if (activeControl?.isConnected) {
      activeControl.disabled = false;
      activeControl.classList.remove("is-working");
    }
  }
}

function currentCheckInLocation() {
  if (!navigator.geolocation) return Promise.reject(new Error("Location services are not available on this device."));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition((position) => {
      resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
    }, (error) => {
      if (error.code === 1) reject(new Error("Allow location access to check in, then try again."));
      else if (error.code === 3) reject(new Error("Location took too long. Move near a window and try again."));
      else reject(new Error("Your location could not be determined. Check location services and try again."));
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 });
  });
}

async function refreshMemberDirectory() {
  if (state.memberRole !== "officer") return;
  state.membersLoading = true;
  render();
  try {
    const directory = await loadMembers();
    state.members = directory.members;
    state.leadershipSlots = directory.leadershipSlots;
    state.leadershipRoster = directory.leadershipRoster || [];
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

async function refreshOfficerOperations(force = false, { silent = false } = {}) {
  if (state.memberRole !== "officer" || state.officerOperationsLoading) return;
  if (state.officerOperationsLoaded && !force) return;
  state.officerOperationsLoading = true;
  state.officerOperationsError = "";
  // A silent refresh already has a workspace on screen, so skip the loading pass
  // and repaint once with the saved values instead of flashing twice.
  if (state.view === "profile" && !silent) render();
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
          <p class="checkin-location-note"><svg><use href="#icon-location"></use></svg>${state.checkInRequireLocation
            ? "I’m Here checks that this device is within 2 miles. Your precise location is not saved."
            : "Online-event mode is on. Location verification is disabled club-wide."}</p>
          <button class="primary-button checkin-button${checkedIn ? " going" : ""}" id="check-in-now" type="button" ${checkedIn ? "disabled" : ""}>
            <svg><use href="#icon-check"></use></svg><span>${checkedIn ? "Checked In" : "I’m Here"}</span>
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
    return `<section class="section officer-operations"><div class="section-header"><div><p class="section-kicker">Officer workspace</p><h2>Events</h2></div><span class="auth-spinner" aria-hidden="true"></span></div></section>${renderOfficerResources()}`;
  }
  if (state.officerOperationsError && !operations) {
    return `<section class="section officer-operations"><div class="section-header"><div><p class="section-kicker">Officer workspace</p><h2>Events</h2><p>${escapeHtml(state.officerOperationsError)}</p></div><button class="secondary-button" id="retry-officer-operations" type="button">Try Again</button></div></section>${renderOfficerResources()}`;
  }

  const totals = operations?.totals || eventBudget;
  const operationEvents = operations?.events || [];
  const currentEvents = operationEvents
    .filter((event) => !isOfficerEventCompleted(event))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time)));
  const completedEvents = operationEvents
    .filter(isOfficerEventCompleted)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.time).localeCompare(String(a.time)));
  const visibleCurrentEvents = state.showAllOfficerEvents ? currentEvents : currentEvents.slice(0, 4);
  return `
    <section class="section officer-operations">
      <div class="section-header officer-operations-header"><div><p class="section-kicker">Officer workspace</p><h2>Events</h2></div></div>
      <datalist id="uf-location-options">${(operations?.locations || []).map((location) => `<option value="${escapeHtml(location)}"></option>`).join("")}</datalist>
      <details class="officer-event-group" ${disclosureAttrs("officer-group-current", true)}>
        <summary><span><strong>Current Events</strong><small>${currentEvents.length} scheduled</small></span></summary>
        <div class="officer-event-group-body">
          <div class="officer-event-list" aria-label="Current officer events">
            ${visibleCurrentEvents.map((event) => renderOfficerEventCard(event, operations.budgetItems || [])).join("") || '<p class="empty-state">No current events are scheduled.</p>'}
          </div>
          ${currentEvents.length > 4 && !state.showAllOfficerEvents ? `<button class="officer-show-more" id="show-all-officer-events" type="button">Show all ${currentEvents.length} events</button>` : ""}
        </div>
      </details>
      <details class="officer-event-group completed-events-group" ${disclosureAttrs("officer-group-completed")}>
        <summary><span><strong>Completed Events</strong><small>${completedEvents.length} archived</small></span></summary>
        <div class="officer-event-group-body">
          <div class="officer-event-list" aria-label="Completed officer events">
            ${completedEvents.map((event) => renderOfficerEventCard(event, operations.budgetItems || [])).join("") || '<p class="empty-state">Completed events will appear here.</p>'}
          </div>
        </div>
      </details>
      <div class="officer-event-footer">
        <details class="officer-add-event" ${disclosureAttrs("officer-add-event")}>
          <summary><span><svg><use href="#icon-plus"></use></svg>Add Event</span></summary>
          ${renderOfficerEventForm({ eventStatus: "Planning" }, true)}
        </details>
        <a class="secondary-button budget-sheet-link" href="${EVENT_BUDGET_SHEET_URL}" target="_blank" rel="noopener noreferrer">Open Google Sheet</a>
      </div>
    </section>
    <section class="section officer-budget-card" aria-label="Club budget overview">
      <div class="officer-budget-heading"><div><p class="section-kicker">Club budget</p><h2>Overall Money</h2></div><span>Live from Sheets</span></div>
      <div class="officer-budget-metrics">
        <article><strong>${formatMoney(totals.totalApproved)}</strong><span>Total approved</span></article>
        <article><strong>${formatMoney(totals.plannedSpend)}</strong><span>Planned spend</span></article>
        <button id="open-budget-breakdown" type="button"><strong>${formatMoney(totals.availableAfterActual)}</strong><span>Total available now</span><small>View breakdown</small></button>
      </div>
    </section>
    ${renderOfficerResources()}
    ${state.budgetBreakdownOpen ? renderBudgetBreakdownModal(totals) : ""}
  `;
}

function isOfficerEventCompleted(event) {
  const status = String(event.eventStatus || "").trim().toLowerCase();
  return status === "completed" || status === "cancelled" || isPastEvent(event);
}

function renderBudgetBreakdownModal(totals) {
  return `
    <div class="signup-modal-backdrop budget-breakdown-backdrop" id="budget-breakdown-backdrop">
      <section class="signup-modal budget-breakdown-modal" role="dialog" aria-modal="true" aria-labelledby="budget-breakdown-title">
        <button class="signup-modal-close" id="close-budget-breakdown" type="button" aria-label="Close budget breakdown">×</button>
        <p class="section-kicker">Available now</p>
        <h2 id="budget-breakdown-title">Funding breakdown</h2>
        <div class="budget-breakdown-rows">
          <span><small>Base funding</small><strong>${formatMoney(totals.baseFunding)}</strong></span>
          <span><small>Operational funding</small><strong>${formatMoney(totals.operationalFunding)}</strong></span>
          <span class="budget-breakdown-total"><small>Total approved</small><strong>${formatMoney(totals.totalApproved)}</strong></span>
          <span class="budget-breakdown-available"><small>Available after actual spending</small><strong>${formatMoney(totals.availableAfterActual)}</strong></span>
        </div>
      </section>
    </div>
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

function budgetSelectOptions(options, current) {
  const value = String(current || "").trim();
  const known = options.some((option) => option.toLowerCase() === value.toLowerCase());
  return [
    ...(value && !known ? [value] : []),
    ...options
  ].map((option) => `<option value="${escapeHtml(option)}" ${option.toLowerCase() === value.toLowerCase() ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
}

function renderBudgetItemForm(item, event, creating = false) {
  const row = creating ? "new" : item.row;
  return `
    <form class="event-budget-item-form" data-budget-item-form="${escapeHtml(String(row))}" data-budget-event="${escapeHtml(event.id)}">
      <div class="budget-item-heading">
        <strong>${creating ? "New purchase" : escapeHtml(item.item)}</strong>
        ${creating ? "" : `<span>${formatMoney(item.plannedCost)} planned</span>`}
      </div>
      <div class="budget-edit-grid">
        <div class="form-row budget-item-name"><label>Item</label><input name="item" aria-label="Item" value="${escapeHtml(item.item || "")}" required /></div>
        <div class="form-row"><label>Quantity</label><input name="quantity" aria-label="Quantity" type="number" min="0" step="0.01" value="${escapeHtml(item.quantity || "")}" /></div>
        <div class="form-row"><label>Unit</label>
          <select name="unit" aria-label="Unit">${budgetSelectOptions(BUDGET_UNITS, item.unit || "")}</select>
        </div>
        <div class="form-row"><label>Unit cost</label><input name="unitCost" aria-label="Unit cost" type="number" min="0" step="0.01" value="${escapeHtml(item.unitCost || "")}" /></div>
        <div class="form-row"><label>Actual cost</label><input name="actualCost" aria-label="Actual cost" type="number" min="0" step="0.01" value="${escapeHtml(item.actualCost || "")}" /></div>
        <div class="form-row"><label>Funding source</label>
          <select name="fundingSource" aria-label="Funding source">${budgetSelectOptions(FUNDING_SOURCES, item.fundingSource || "")}</select>
        </div>
        <div class="form-row"><label>Budget status</label>
          <select name="status" aria-label="Budget status">${budgetSelectOptions(BUDGET_STATUSES, item.status || "Estimate")}</select>
        </div>
        <div class="form-row budget-item-notes"><label>Budget notes</label><textarea name="notes" aria-label="Budget notes" maxlength="800">${escapeHtml(item.notes || "")}</textarea></div>
      </div>
      <div class="budget-item-actions">
        <button class="secondary-button" type="submit">${creating ? "Add Budget Item" : "Save Money Changes"}</button>
        ${creating ? "" : `<button class="danger-button budget-item-remove" type="button" data-remove-budget-item="${escapeHtml(String(row))}" data-budget-item-name="${escapeHtml(item.item || "this line")}">Remove Line</button>`}
      </div>
    </form>
  `;
}

function renderOfficerEventCard(event, allBudgetItems) {
  const items = allBudgetItems.filter((item) => item.eventId === event.id);
  const rsvps = event.rsvps || [];
  const completed = isOfficerEventCompleted(event);
  const budgetSummary = `${formatMoney(event.plannedBudget)} planned · ${formatMoney(event.actualSpend)} actual`;
  return `
    <details class="officer-event-card" data-officer-event="${escapeHtml(event.id)}" ${disclosureAttrs(`officer-card-${event.id}`, event.id === state.selectedOfficerEventId)}>
      <summary>
        <span class="officer-event-date"><small>${escapeHtml(formatEventDate(event, { month: "short" }))}</small><strong>${escapeHtml(formatEventDate(event, { day: "2-digit" }))}</strong></span>
        <span class="officer-event-summary"><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.location || "Location pending")} · ${escapeHtml(event.time)}</small></span>
        <span class="event-status-pill status-${escapeHtml(String(event.eventStatus || "planned").toLowerCase().replace(/[^a-z]+/g, "-"))}">${escapeHtml(event.eventStatus || "Planned")}</span>
        <span class="officer-event-money"><small>Planned</small><strong>${formatMoney(event.plannedBudget)}</strong></span>
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
        ${completed ? "" : `<div class="officer-event-actions">
          <button class="primary-button" type="button" data-start-event="${escapeHtml(event.id)}">${state.checkInOpen && state.activeCheckInEventId === event.id ? "Check-In Is Live" : "Start Event Check-In"}</button>
          ${state.checkInOpen && state.activeCheckInEventId === event.id ? `<button class="secondary-button" id="close-checkin-${escapeHtml(event.id)}" data-close-event="${escapeHtml(event.id)}" type="button">Close Check-In</button>` : ""}
        </div>`}
        <details class="officer-event-subsection" ${disclosureAttrs(`officer-notes-${event.id}`)}>
          <summary>Event details & notes</summary>
          ${renderOfficerEventForm(event)}
        </details>
        <details class="officer-event-subsection" ${disclosureAttrs(`officer-rsvps-${event.id}`)}>
          <summary><span>RSVPs</span><small>${rsvps.length} going · ${event.officerRsvps?.length || 0} officers</small></summary>
          <div class="event-rsvp-roster">${rsvps.length ? rsvps.map((entry) => `<span><strong>${escapeHtml(entry.displayName)}</strong><small>${entry.role === "officer" ? "Officer" : "Member"}</small></span>`).join("") : '<p class="empty-state">No RSVPs yet.</p>'}</div>
        </details>
        <details class="officer-event-subsection" ${disclosureAttrs(`officer-budget-${event.id}`)}>
          <summary><span>Budget & purchases</span><small>${items.length} ${items.length === 1 ? "item" : "items"} · ${escapeHtml(budgetSummary)}</small></summary>
          <div class="event-budget-editor">
            ${items.map((item) => renderBudgetItemForm(item, event)).join("") || '<p class="empty-state">No budget items yet.</p>'}
            <details class="budget-add-line" ${disclosureAttrs(`officer-budget-add-${event.id}`)}>
              <summary><span><svg><use href="#icon-plus"></use></svg>Add another line</span></summary>
              ${renderBudgetItemForm({}, event, true)}
            </details>
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
      <span class="officer-resource-copy"><strong>${escapeHtml(resource.title)}</strong><small>${escapeHtml(resource.kind || "Google Drive")}</small></span>
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
        <span class="auth-spinner" aria-hidden="true"></span>
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
        <div><p class="section-kicker">Useful information</p><h2>Your ${escapeHtml(roleName)} Toolkit</h2></div>
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

function leadershipKeyForTitle(title = "") {
  const normalized = String(title).trim().toLowerCase();
  if (normalized === "president") return "president";
  if (normalized === "vice president" || normalized === "vice-president" || normalized === "vp") return "vice_president";
  if (normalized === "treasurer") return "treasurer";
  return "";
}

// Who the app believes holds a seat. Column B only carries an account id for seats
// linked since that change, so the server cannot resolve older ones on its own —
// and a role lookup cannot separate two accounts sharing one leadership value.
function leadershipSeatCandidates(seat) {
  const leadership = leadershipKeyForTitle(seat.title);
  return state.members.filter((member) => leadership
    ? member.leadership === leadership
    : member.role === "officer" && member.officerTitle === seat.title);
}

function renderLeadershipSlots() {
  const roster = state.leadershipRoster.length
    ? state.leadershipRoster
    : state.leadershipSlots.map((slot) => ({ ...slot, active: false, linked: false, pending: true }));
  if (!roster.length) {
    return state.membersLoading ? '<p class="empty-state">Loading the officer roster…</p>' : "";
  }
  // Anyone without a leadership seat of their own can take one, so an existing
  // officer can move up rather than having to be demoted to a member first.
  const eligible = (seatTitle) => state.members.filter((member) =>
    !member.leadership || member.leadership === leadershipKeyForTitle(seatTitle));
  const pendingCount = roster.filter((seat) => seat.pending).length;
  return `
    <div class="member-roster leadership-slot-roster" aria-label="Officer roster">
      <h3>Officer roster</h3>
      <p>Every seat on the <strong>Current Leadership</strong> tab. ${pendingCount
        ? `${pendingCount} ${pendingCount === 1 ? "seat is" : "seats are"} still waiting on an account — link the member who holds that seat.`
        : "Every seat is linked to an account."}</p>
      ${roster.map((seat) => `
        <article class="member-role-row leadership-seat${seat.pending ? " is-pending" : ""}" data-leadership-row="${seat.row}">
          <div class="member-identity">
            <strong>${escapeHtml(seat.name)}</strong>
            <span>${escapeHtml(seat.title)} · ${seat.pending ? "Waiting for an account" : seat.linked ? "Linked to an account" : "Listed, not yet active"}</span>
          </div>
          ${seat.pending && state.canManageOfficers ? `
            <label>
              <span class="sr-only">Account for ${escapeHtml(seat.name)}</span>
              <select data-leadership-member="${seat.row}" ${eligible(seat.title).length ? "" : "disabled"}>
                <option value="">Choose an account</option>
                ${eligible(seat.title).map((member) => `<option value="${escapeHtml(member.uid)}">${escapeHtml(member.displayName)} (${escapeHtml(member.email || "no email")})</option>`).join("")}
              </select>
            </label>
            <button class="secondary-button" data-assign-leadership="${seat.row}" type="button" ${eligible(seat.title).length ? "" : "disabled"}>Link role</button>
          ` : `
            <span class="leadership-seat-status ${seat.pending ? "pending" : "active"}">${seat.pending ? "Pending" : "Active"}</span>
            ${state.canManageOfficers ? (() => {
              const candidates = leadershipSeatCandidates(seat);
              const picker = candidates.length > 1 ? `
                <label>
                  <span class="sr-only">Account holding ${escapeHtml(seat.title)}</span>
                  <select data-leadership-holder="${seat.row}">
                    ${candidates.map((member) => `<option value="${escapeHtml(member.uid)}">${escapeHtml(member.displayName)} (${escapeHtml(member.email || "no email")})</option>`).join("")}
                  </select>
                </label>
              ` : "";
              return `${picker}<button class="secondary-button" data-open-leadership="${seat.row}" data-holder-uid="${escapeHtml(candidates.length === 1 ? candidates[0].uid : "")}" type="button">Open seat</button>`;
            })() : ""}
          `}
        </article>
      `).join("")}
    </div>
  `;
}

function renderAccountSettings() {
  if (!state.authReady) return renderAuthLoading("settings");
  if (!state.loggedIn) {
    return `<section class="section settings-account-summary"><div class="section-header"><div><p class="section-kicker">Account management</p><h2>No account signed in</h2><p>Open Profile to log in or create an account.</p></div><button class="secondary-button" id="settings-go-to-login" type="button">Open Login</button></div></section>`;
  }
  return `
    <details class="section settings-group settings-account-summary" ${disclosureAttrs("settings-account", true)}>
      <summary><span><p class="section-kicker">Account management</p><strong>${escapeHtml(state.memberName)}</strong></span><small>${escapeHtml(roleLabel())}</small></summary>
      <div class="settings-group-content">
        <div class="section-header"><div><p>${state.memberUsername ? `@${escapeHtml(state.memberUsername)} · ` : ""}${escapeHtml(state.memberEmail || "Secure Firebase account")}</p></div><button class="secondary-button" id="profile-logout" type="button" ${state.authBusy ? "disabled" : ""}>Sign Out</button></div>
        <div class="form-row">
          <label for="member-name">Display name</label>
          <input id="member-name" maxlength="${MAX_DISPLAY_NAME}" value="${escapeHtml(state.memberName)}" />
          <small class="field-hint">Any name up to ${MAX_DISPLAY_NAME} characters, as long as another member is not already using it.</small>
        </div>
        <button class="primary-button" id="save-profile" type="button" ${state.authBusy ? "disabled" : ""}><svg><use href="#icon-check"></use></svg><span>Save Profile</span></button>
        ${renderAuthFeedback()}
      </div>
    </details>
    <details class="section settings-group passkey-card">
      <summary><span><p class="section-kicker">Security</p><strong>Passkeys & Face ID</strong></span><small>${state.passkeyCount} ${state.passkeyCount === 1 ? "passkey" : "passkeys"}</small></summary>
      <div class="settings-group-content">
        <p>Use Face ID, Touch ID, your screen lock, or a hardware security key to sign in. A passkey belongs to the device that made it unless your password manager syncs it, so add one on each device you use.</p>
        <button class="primary-button" id="register-passkey" type="button" ${state.authBusy || !supportsPasskeys() ? "disabled" : ""}><svg><use href="#icon-lock"></use></svg><span>${supportsPasskeys() ? "Set Up Face ID / Touch ID" : "Passkeys unavailable"}</span></button>
      </div>
    </details>
    <details class="section settings-group password-card">
      <summary><span><p class="section-kicker">Security</p><strong>Password</strong></span><small>Backup sign-in</small></summary>
      <div class="settings-group-content">
        <p>A password is how you get back in on a device that has no passkey — a borrowed laptop, a new phone, or a lost device. We email you a link to set one; it works whether or not you already have a password.</p>
        <button class="primary-button" id="send-password-link" type="button" ${state.authBusy ? "disabled" : ""}><svg><use href="#icon-check"></use></svg><span>Email Me a Password Link</span></button>
        <p class="field-hint">The link goes to ${escapeHtml(state.memberEmail || "your UF inbox")} and expires after a while. Ask for a new one any time.</p>
      </div>
    </details>
  `;
}

function renderInstallCard() {
  // Standalone display only kicks in once FQC is installed to the home screen,
  // so the browser chrome stays until someone actually adds it.
  if (isInstalledApp()) {
    return `
      <section class="section install-card is-installed">
        <div class="section-header"><div><p class="section-kicker">Installed app</p><h2>Running as the FQC app</h2><p>No address bar, no browser buttons — you are in the installed app.</p></div></div>
      </section>
    `;
  }
  return `
    <section class="section install-card">
      <div class="section-header">
        <div>
          <p class="section-kicker">Home screen app</p>
          <h2>Install FQC</h2>
          <p>Adds the FQC icon to your home screen and opens full screen — no address bar, search field, or browser buttons.</p>
        </div>
      </div>
      ${installPrompt
        ? '<button class="primary-button" id="install-app" type="button"><svg><use href="#icon-plus"></use></svg><span>Install FQC</span></button>'
        : isIosDevice()
          ? '<ol class="install-steps"><li>Tap the <strong>Share</strong> button in Safari.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Open FQC from the new icon.</li></ol>'
          : '<ol class="install-steps"><li>Open your browser menu.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Open FQC from the new icon.</li></ol>'}
    </section>
  `;
}

function renderOfficerSettings() {
  if (state.memberRole !== "officer") return "";
  return `
    <details class="section settings-group officer-settings-group" ${disclosureAttrs("settings-officer-controls")}>
      <summary><span><p class="section-kicker">Officers only</p><strong>Officer controls</strong></span><small>${escapeHtml(roleLabel())}</small></summary>
      <div class="settings-group-content">
        <p>These switches apply to the whole club, not just this device. Members never see this section.</p>
        <label class="settings-switch-row" for="checkin-location-required">
          <span><strong>Require members to be within 2 miles</strong><small>Checked once when they tap I’m Here; precise coordinates are not stored.</small></span>
          <input id="checkin-location-required" type="checkbox" role="switch" ${state.checkInRequireLocation ? "checked" : ""} ${state.authBusy ? "disabled" : ""} />
        </label>
        <p class="officer-settings-note">Members are managed from the leaderboard on the Profile screen — tap anyone in the standings to open their profile.</p>
        ${renderLeadershipSlots()}
      </div>
    </details>
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
      ${renderInstallCard()}
      ${renderOfficerSettings()}
      <section class="section contact-settings">
        <div class="section-header">
          <div>
            <p class="section-kicker">Get in touch</p>
            <h2>Contact</h2>
            <p>Questions, ideas, or something not working? Email the FQC officers and we’ll get back to you.</p>
          </div>
        </div>
        <a class="secondary-button" href="mailto:officers@flqcs.com">
          <svg><use href="#icon-mail"></use></svg><span>officers@flqcs.com</span>
        </a>
      </section>
      <details class="section settings-group" ${disclosureAttrs("settings-updates")}>
        <summary><span><p class="section-kicker">App shell</p><strong>Updates</strong></span><small>v${APP_VERSION}</small></summary>
        <div class="settings-group-content">
          <p>Fetch the newest app shell while keeping your account and saved app data.</p>
          <button class="primary-button" id="check-for-updates" type="button" ${state.authBusy ? "disabled" : ""}>
            <svg><use href="#icon-check"></use></svg><span>Check for Updates</span>
          </button>
        </div>
      </details>
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

  const entries = state.leaderboardEntries;
  const participants = state.leaderboardParticipantCount || entries.length;
  const overflow = Math.max(0, entries.length - LEADERBOARD_PREVIEW);
  return `
    <section class="section leaderboard-section" aria-labelledby="leaderboard-title">
      <div class="section-header">
        <div><p class="section-kicker">Club standings</p><h2 id="leaderboard-title">Leaderboard</h2><p>${participants} participant${participants === 1 ? "" : "s"} · verified event check-ins</p></div>
        <button class="secondary-button leaderboard-refresh" id="refresh-leaderboard" type="button" ${state.leaderboardLoading ? "disabled" : ""}>${state.leaderboardLoading ? "Refreshing…" : "Refresh"}</button>
      </div>
      ${entries.length
        ? renderLeaderboardRows(entries.slice(0, LEADERBOARD_PREVIEW))
        : '<p class="empty-state">No ranked members yet. The first event check-in starts the standings.</p>'}
      ${overflow ? `<button class="secondary-button leaderboard-show-more" id="open-full-leaderboard" type="button">Show all ${entries.length} members</button>` : ""}
    </section>
    ${state.leaderboardExpanded ? renderLeaderboardModal() : ""}
    ${state.memberProfileUid ? renderMemberProfileModal() : ""}
  `;
}

// Ranks come from the full standings so the preview and the popup agree.
function renderLeaderboardRows(visibleEntries) {
  const entries = state.leaderboardEntries;
  const standings = competitionStandings(entries);
  const currentUid = state.authUser?.uid || "";
  const officerView = state.memberRole === "officer";
  return `<ol class="leaderboard" ${officerView ? 'aria-label="Standings — open a member to manage them"' : ""}>${visibleEntries.map((entry) => {
    const index = entries.indexOf(entry);
    const rank = standings[index];
    const isCurrentUser = entry.uid === currentUid;
    const previous = index > 0 ? entries[index - 1] : null;
    const pointsToOvertake = isCurrentUser && previous ? Math.max(1, previous.points - entry.points + 1) : 0;
    const identity = `
        <span class="leader-rank" aria-label="Rank ${rank}">${rank}</span>
        <span class="leader-identity">
          <strong>${isCurrentUser ? "You" : escapeHtml(entry.displayName)}</strong>
          <span class="leader-meta">${entry.role === "officer" ? "Officer" : "Member"} · ${entry.points} event${entry.points === 1 ? "" : "s"} attended</span>
          ${pointsToOvertake ? `<small>${pointsToOvertake} ${pointsToOvertake === 1 ? "point" : "points"} to move ahead</small>` : ""}
        </span>
        <strong class="leader-points">${entry.points} <span>PT${entry.points === 1 ? "" : "S"}</span></strong>
    `;
    return `
      <li class="leader-row${isCurrentUser ? " current-user" : ""}">
        ${officerView
          ? `<button class="leader-open" type="button" data-open-member="${escapeHtml(entry.uid)}" aria-label="Open ${escapeHtml(entry.displayName)}’s member profile">${identity}</button>`
          : `<div class="leader-open is-static">${identity}</div>`}
      </li>
    `;
  }).join("")}</ol>`;
}

function renderLeaderboardModal() {
  const entries = state.leaderboardEntries;
  const participants = state.leaderboardParticipantCount || entries.length;
  return `
    <div class="signup-modal-backdrop leaderboard-backdrop" id="leaderboard-backdrop">
      <section class="signup-modal leaderboard-modal" role="dialog" aria-modal="true" aria-labelledby="full-leaderboard-title">
        <button class="signup-modal-close" id="close-full-leaderboard" type="button" aria-label="Close full leaderboard">×</button>
        <p class="section-kicker">Club standings</p>
        <h2 id="full-leaderboard-title">Full Leaderboard</h2>
        <p class="leaderboard-modal-meta">${participants} participant${participants === 1 ? "" : "s"} · scroll for the whole club</p>
        <div class="leaderboard-scroll">${renderLeaderboardRows(entries)}</div>
      </section>
    </div>
  `;
}

function competitionStandings(entries) {
  let lastPoints = null;
  let lastRank = 0;
  return entries.map((entry, index) => {
    if (entry.points !== lastPoints) {
      lastRank = index + 1;
      lastPoints = entry.points;
    }
    return lastRank;
  });
}

function memberEventHistory(uid) {
  const operations = state.officerOperations;
  const rsvped = (operations?.events || [])
    .filter((event) => (event.rsvps || []).some((entry) => entry.uid === uid))
    .map((event) => ({ id: event.id, title: event.title, date: event.date }));
  return { rsvped };
}

function renderMemberProfileModal() {
  const uid = state.memberProfileUid;
  const entry = state.leaderboardEntries.find((item) => item.uid === uid);
  const member = state.members.find((item) => item.uid === uid);
  const name = member?.displayName || entry?.displayName || "FQC Member";
  const points = member ? member.points : entry?.points || 0;
  const attended = member?.checkedInEvents || [];
  const { rsvped } = memberEventHistory(uid);
  const protectedLeadership = Boolean(member?.leadership);
  const isSelf = uid === state.authUser?.uid;
  return `
    <div class="signup-modal-backdrop member-profile-backdrop" id="member-profile-backdrop">
      <section class="signup-modal member-profile-modal" role="dialog" aria-modal="true" aria-labelledby="member-profile-title">
        <button class="signup-modal-close" id="close-member-profile" type="button" aria-label="Close member profile">×</button>
        <p class="section-kicker">Member profile</p>
        <h2 id="member-profile-title">${escapeHtml(name)}</h2>
        <p class="member-profile-role">${escapeHtml(member ? profileRoleLabel(member) : entry?.role === "officer" ? "Officer" : "Member")}${member?.email ? ` · ${escapeHtml(member.email)}` : ""}</p>
        ${state.membersLoading && !member ? '<p class="empty-state">Loading account details…</p>' : ""}
        <div class="member-profile-metrics">
          <article><strong>${points}</strong><span>Point${points === 1 ? "" : "s"}</span></article>
          <article><strong>${attended.length}</strong><span>Checked in</span></article>
          <article><strong>${rsvped.length}</strong><span>RSVP’d</span></article>
        </div>
        <div class="member-profile-lists">
          <section>
            <h3>Events RSVP’d</h3>
            ${rsvped.length
              ? `<ul>${rsvped.map((event) => `<li><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(formatEventDate(event, { month: "short", day: "numeric" }))}</small></li>`).join("")}</ul>`
              : '<p class="empty-state">No RSVPs recorded.</p>'}
          </section>
          <section>
            <h3>Events attended</h3>
            ${attended.length
              ? `<ul>${attended.map((eventId) => {
                  const event = findEventById(eventId);
                  return `<li><strong>${escapeHtml(event?.title || eventId)}</strong>${event?.date ? `<small>${escapeHtml(formatEventDate(event, { month: "short", day: "numeric" }))}</small>` : ""}</li>`;
                }).join("")}</ul>`
              : '<p class="empty-state">No verified check-ins yet.</p>'}
          </section>
        </div>
        ${member ? `
          <div class="member-profile-manage">
            <h3>Manage</h3>
            ${state.memberRole === "officer" ? `
              <label class="member-profile-role-row">
                <span>Club role</span>
                <select data-member-role="${escapeHtml(uid)}" ${protectedLeadership || isSelf ? "disabled" : ""}>
                  <option value="member" ${member.role === "member" ? "selected" : ""} ${state.canManageOfficers ? "" : "disabled"}>Member</option>
                  <option value="officer" ${member.role === "officer" ? "selected" : ""}>Officer</option>
                </select>
              </label>
              <div class="member-profile-actions">
                <button class="secondary-button" data-save-member-role="${escapeHtml(uid)}" type="button" ${protectedLeadership || isSelf ? "disabled" : ""}>Save role</button>
                ${state.canManageOfficers ? `<button class="danger-button" data-remove-member="${escapeHtml(uid)}" type="button" ${protectedLeadership || isSelf ? "disabled" : ""}>Remove Member</button>` : ""}
              </div>
              ${protectedLeadership ? '<p class="member-profile-note">President, Vice President, and Treasurer accounts are protected.</p>' : ""}
              ${isSelf ? '<p class="member-profile-note">You cannot change your own role.</p>' : ""}
              ${state.canManageOfficers
                ? ""
                : '<p class="member-profile-note">Any officer can make a member an officer. Only the President or Treasurer can take officer access away or remove an account.</p>'}
            ` : '<p class="member-profile-note">Only officers can change club roles.</p>'}
          </div>
        ` : ""}
      </section>
    </div>
  `;
}

function signupProgress() {
  return `
    <div class="signup-progress" aria-label="Account creation progress">
      ${["UF email", "Username", "Secure it"].map((label, index) => {
        const step = index + 1;
        return `<div class="signup-progress-step${state.signupStep === step ? " active" : ""}${state.signupStep > step ? " complete" : ""}"><span>${state.signupStep > step ? "✓" : step}</span><strong>${label}</strong></div>`;
      }).join("")}
    </div>
  `;
}

function renderSignupWizard() {
  if (state.signupStep === 1) {
    return `
      ${signupProgress()}
      <form class="email-auth-form signup-step" id="signup-email-form">
        <div class="signup-step-copy"><p class="section-kicker">Step 1 of 3</p><h3>Start with your UF email</h3><p>This keeps the FQC community connected to UF.</p></div>
        <div class="form-row">
          <label for="signup-email">UF email</label>
          <input id="signup-email" type="email" inputmode="email" autocomplete="email" value="${escapeHtml(state.signupEmail)}" placeholder="you@ufl.edu" required autofocus />
        </div>
        <button class="primary-button email-auth-submit" type="submit"><span>Next: choose a username</span></button>
      </form>
    `;
  }
  if (state.signupStep === 2) {
    return `
      ${signupProgress()}
      <form class="email-auth-form signup-step" id="signup-username-form">
        <div class="signup-step-copy"><p class="section-kicker">Step 2 of 3</p><h3>Choose your FQC username</h3><p>This is what members will see. You can also use it to log in.</p></div>
        <div class="form-row">
          <label for="signup-username">Username</label>
          <input id="signup-username" type="text" inputmode="text" autocomplete="username" value="${escapeHtml(state.signupUsername)}" minlength="3" maxlength="24" pattern="[A-Za-z0-9][A-Za-z0-9._]{1,22}[A-Za-z0-9]" placeholder="quantumgator" required autofocus />
          <small>3–24 letters, numbers, periods, or underscores.</small>
        </div>
        <div class="signup-actions"><button class="secondary-button" id="signup-back-email" type="button">Back</button><button class="primary-button" type="submit" ${state.authBusy ? "disabled" : ""}>Check username</button></div>
      </form>
    `;
  }
  const passkeyAvailable = supportsPasskeys();
  if (!passkeyAvailable && state.signupMethod === "passkey") state.signupMethod = "password";
  return `
    ${signupProgress()}
    <form class="email-auth-form signup-step" id="signup-security-form">
      <div class="signup-step-copy"><p class="section-kicker">Step 3 of 3</p><h3>Secure your account</h3><p>Use a passkey for Face ID, Touch ID, or your device lock—or create a private password. You can add the other one later from Settings.</p></div>
      <div class="signup-summary"><span>${escapeHtml(state.signupEmail)}</span><strong>@${escapeHtml(state.signupUsername)}</strong></div>
      <fieldset class="signup-methods">
        <legend>Choose how to sign in first</legend>
        <label class="signup-method${state.signupMethod === "passkey" ? " selected" : ""}${passkeyAvailable ? "" : " unavailable"}">
          <input type="radio" name="signup-method" value="passkey" ${state.signupMethod === "passkey" ? "checked" : ""} ${passkeyAvailable ? "" : "disabled"} />
          <svg><use href="#icon-lock"></use></svg><span><strong>Passkey</strong><small>${passkeyAvailable ? "Fastest · Face ID, Touch ID, or device lock" : "Unavailable on this device"}</small></span>
        </label>
        <label class="signup-method${state.signupMethod === "password" ? " selected" : ""}">
          <input type="radio" name="signup-method" value="password" ${state.signupMethod === "password" ? "checked" : ""} />
          <svg><use href="#icon-profile"></use></svg><span><strong>Private password</strong><small>Use with your username or UF email</small></span>
        </label>
      </fieldset>
      ${state.signupMethod === "password" ? `
        <div class="form-row">
          <label for="signup-password">Private password</label>
          <input id="signup-password" type="password" autocomplete="new-password" minlength="10" placeholder="At least 10 characters" required />
        </div>
      ` : ""}
      <div class="signup-actions"><button class="secondary-button" id="signup-back-username" type="button">Back</button><button class="primary-button" type="submit" ${state.authBusy ? "disabled" : ""}>${state.signupMethod === "passkey" ? "Create with passkey" : "Create account"}</button></div>
    </form>
  `;
}

function renderSignupModal() {
  return `
    <div class="signup-modal-backdrop" id="signup-modal-backdrop">
      <section class="signup-modal" role="dialog" aria-modal="true" aria-labelledby="signup-modal-title">
        <button class="signup-modal-close" id="close-signup-modal" type="button" aria-label="Close account creation" ${state.authBusy ? "disabled" : ""}>×</button>
        <div class="signup-modal-heading">
          <div class="checkin-icon"><svg><use href="#icon-lock"></use></svg></div>
          <div><p class="section-kicker">Join Florida Quantum Computing</p><h2 id="signup-modal-title">Create your FQC account</h2><p>Three quick steps. Start with a passkey or a private password—you can add the other later.</p></div>
        </div>
        ${renderSignupWizard()}
        ${state.authBusy ? '<p class="auth-working"><span class="auth-spinner" aria-hidden="true"></span> Creating your account…</p>' : ""}
        ${renderAuthFeedback()}
        <p class="auth-privacy">Every new account starts as a member. Officers grant officer access from the member directory.</p>
      </section>
    </div>
  `;
}

function renderAuthPromptModal() {
  const event = state.authPromptEventId ? getEvent(state.authPromptEventId) : null;
  const isRsvp = state.authPromptAction === "rsvp" && event;
  return `
    <div class="signup-modal-backdrop auth-prompt-backdrop" id="auth-prompt-backdrop">
      <section class="signup-modal auth-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="auth-prompt-title">
        <button class="signup-modal-close" id="close-auth-prompt" type="button" aria-label="Close sign-in prompt">×</button>
        <div class="signup-modal-heading">
          <div class="checkin-icon"><svg><use href="#icon-${isRsvp ? "calendar" : "check"}"></use></svg></div>
          <div>
            <p class="section-kicker">${isRsvp ? "Save your spot" : "FQC attendance"}</p>
            <h2 id="auth-prompt-title">${isRsvp ? `RSVP to ${escapeHtml(event.title)}` : "Sign in to check in"}</h2>
            <p>Log in to continue, or create your FQC account in three quick steps.</p>
          </div>
        </div>
        <div class="auth-prompt-actions">
          <button class="primary-button" id="auth-prompt-login" type="button"><svg><use href="#icon-lock"></use></svg><span>Log In</span></button>
          <button class="secondary-button" id="auth-prompt-create" type="button">Create Account</button>
        </div>
        <p class="auth-privacy">After you sign in, we’ll bring you right back and finish this action.</p>
      </section>
    </div>
  `;
}

function renderProfile() {
  if (!state.authReady) return renderAuthLoading("profile");
  if (!state.loggedIn) {
    return `
      <section class="view" data-screen="profile">
        <section class="section profile-login">
          <div class="auth-brand">
            <div class="checkin-icon"><svg><use href="#icon-lock"></use></svg></div>
            <div>
              <p class="section-kicker">One secure FQC account</p>
              <h2>Welcome back</h2>
              <p>Use your username or UF email with your private password, or use a passkey.</p>
            </div>
          </div>
          <div class="auth-mode-tabs" role="tablist" aria-label="Account access">
            <button id="auth-mode-login" role="tab" aria-selected="true" type="button">Log In</button>
            <button id="auth-mode-create" role="tab" aria-selected="false" type="button">Create Account</button>
          </div>
          <form class="email-auth-form" id="email-auth-form">
              <div class="form-row">
                <label for="auth-identifier">Username or UF email</label>
                <input id="auth-identifier" name="identifier" type="text" inputmode="email" autocomplete="username" placeholder="quantumgator or you@ufl.edu" required />
              </div>
              <div class="form-row">
                <label for="auth-password">Private password</label>
                <input id="auth-password" name="password" type="password" autocomplete="current-password" minlength="10" placeholder="Your private password" required />
              </div>
              <button class="primary-button email-auth-submit" type="submit" ${state.authBusy ? "disabled" : ""}><svg><use href="#icon-lock"></use></svg><span>Log In</span></button>
              <button class="text-button" id="forgot-password" type="button">Forgot password?</button>
              <p class="auth-recovery-hint">No passkey on this device, or never set a password? Enter your username or UF email above and choose <strong>Forgot password</strong> — we email you a link to set one.</p>
          </form>
          <div class="auth-divider"><span>or</span></div>
          <div class="auth-provider-list">
            <button class="auth-provider-button passkey" id="sign-in-passkey" type="button" ${state.authBusy || !supportsPasskeys() ? "disabled" : ""}>
              <svg><use href="#icon-lock"></use></svg><span>${supportsPasskeys() ? "Sign in with a passkey" : "Passkeys unavailable on this device"}</span>
            </button>
          </div>
          ${state.authBusy && !state.signupOpen ? '<p class="auth-working"><span class="auth-spinner" aria-hidden="true"></span> Opening secure sign-in…</p>' : ""}
          ${state.signupOpen ? "" : renderAuthFeedback()}
          <p class="auth-privacy">Firebase Authentication protects sign-in sessions. Use Face ID, Touch ID, or your device lock with a passkey, or your private password. You can use both, and add a passkey on every device you sign in from.</p>
        </section>
      </section>
    `;
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
  document.querySelector("#show-all-officer-events")?.addEventListener("click", () => {
    state.showAllOfficerEvents = true;
    render();
  });
  document.querySelector("#open-budget-breakdown")?.addEventListener("click", () => {
    state.budgetBreakdownOpen = true;
    render();
  });
  const closeBudgetBreakdown = () => {
    state.budgetBreakdownOpen = false;
    render();
  };
  document.querySelector("#close-budget-breakdown")?.addEventListener("click", closeBudgetBreakdown);
  const budgetBackdrop = document.querySelector("#budget-breakdown-backdrop");
  budgetBackdrop?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeBudgetBreakdown();
  });
  bindCalendarEvents();
  bindRsvpEvents();
  bindMobileEventSheet();

  document.querySelector("#go-to-login")?.addEventListener("click", () => {
    if (!state.loggedIn) {
      state.pendingIntent = { type: "checkin" };
      state.authPromptOpen = true;
      state.authPromptAction = "checkin";
      state.authPromptEventId = "";
      render();
      return;
    }
    setView("profile");
  });
  document.querySelector("#settings-go-to-login")?.addEventListener("click", () => setView("profile"));
  document.querySelector("#close-settings")?.addEventListener("click", () => setView(state.loggedIn ? "profile" : "home"));
  document.querySelector("#check-for-updates")?.addEventListener("click", checkForUpdates);
  document.querySelector("#refresh-leaderboard")?.addEventListener("click", () => refreshLeaderboard(true));
  document.querySelector("#checkin-location-required")?.addEventListener("change", async (event) => {
    if (state.memberRole !== "officer") return;
    const requireLocation = event.currentTarget.checked;
    const updated = await runAuthAction(
      () => updateCheckInLocationRequirement(requireLocation),
      requireLocation ? "Two-mile check-in verification is on for the whole club." : "Online-event mode is on; location verification is off for the whole club."
    );
    if (updated) state.checkInRequireLocation = updated.requireLocation !== false;
  });

  document.querySelector("#auth-mode-login")?.addEventListener("click", () => {
    state.authMode = "login";
    state.signupOpen = false;
    state.authError = "";
    state.authMessage = "";
    render();
  });
  const closeAuthPrompt = () => {
    state.authPromptOpen = false;
    state.authPromptAction = "";
    state.authPromptEventId = "";
    state.pendingIntent = null;
    render();
  };
  document.querySelector("#close-auth-prompt")?.addEventListener("click", closeAuthPrompt);
  const authPromptBackdrop = document.querySelector("#auth-prompt-backdrop");
  authPromptBackdrop?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeAuthPrompt();
  });
  authPromptBackdrop?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAuthPrompt();
  });
  document.querySelector("#auth-prompt-login")?.addEventListener("click", () => {
    state.authPromptOpen = false;
    state.authPromptAction = "";
    state.authPromptEventId = "";
    setView("profile");
  });
  document.querySelector("#auth-prompt-create")?.addEventListener("click", () => {
    state.authPromptOpen = false;
    state.authPromptAction = "";
    state.authPromptEventId = "";
    state.signupOpen = true;
    state.signupStep = 1;
    state.authError = "";
    state.authMessage = "";
    render();
  });
  document.querySelector("#auth-mode-create")?.addEventListener("click", () => {
    state.authMode = "login";
    state.signupOpen = true;
    state.signupStep = 1;
    state.authError = "";
    state.authMessage = "";
    render();
  });
  const closeSignup = () => {
    if (state.authBusy) return;
    state.signupOpen = false;
    state.signupStep = 1;
    state.authError = "";
    state.authMessage = "";
    render();
  };
  document.querySelector("#close-signup-modal")?.addEventListener("click", closeSignup);
  const signupBackdrop = document.querySelector("#signup-modal-backdrop");
  signupBackdrop?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeSignup();
  });
  signupBackdrop?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSignup();
  });
  document.querySelector("#email-auth-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const identifier = document.querySelector("#auth-identifier")?.value.trim() || "";
    const password = document.querySelector("#auth-password")?.value || "";
    await runAuthAction(() => signInWithEmail(identifier, password));
  });
  document.querySelector("#signup-email-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = document.querySelector("#signup-email")?.value.trim().toLowerCase() || "";
    if (!/^[^\s@]+@ufl\.edu$/i.test(email)) {
      state.authError = "Use your UF email ending in @ufl.edu.";
      render();
      return;
    }
    state.signupEmail = email;
    state.signupStep = 2;
    state.authError = "";
    render();
  });
  document.querySelector("#signup-back-email")?.addEventListener("click", () => {
    state.signupStep = 1;
    state.authError = "";
    render();
  });
  document.querySelector("#signup-username-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.querySelector("#signup-username")?.value.trim().toLowerCase() || "";
    state.signupUsername = username;
    if (!/^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])$/.test(username)) {
      state.authError = "Use 3–24 letters, numbers, periods, or underscores.";
      render();
      return;
    }
    const result = await runAuthAction(() => checkUsername(username));
    if (!result) return;
    if (!result.available) {
      state.authError = "That username is already taken. Try another.";
      render();
      return;
    }
    state.signupUsername = result.username;
    state.signupStep = 3;
    state.authError = "";
    render();
  });
  document.querySelector("#signup-back-username")?.addEventListener("click", () => {
    state.signupStep = 2;
    state.authError = "";
    render();
  });
  document.querySelectorAll('input[name="signup-method"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.signupMethod = input.value;
      state.authError = "";
      render();
    });
  });
  document.querySelector("#signup-security-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#signup-password")?.value || "";
    if (state.signupMethod === "password" && password.length < 10) {
      state.authError = "Use a private password with at least 10 characters.";
      render();
      return;
    }
    const profile = await runAuthAction(
      () => createEmailAccount({ username: state.signupUsername, email: state.signupEmail, password, method: state.signupMethod }),
      state.signupMethod === "passkey" ? "Account and passkey created." : "Account created securely."
    );
    if (profile) {
      applyMemberProfile(profile);
      state.signupOpen = false;
      state.signupStep = 1;
      state.signupEmail = "";
      state.signupUsername = "";
      render();
    }
  });
  document.querySelector("#forgot-password")?.addEventListener("click", async () => {
    const identifier = document.querySelector("#auth-identifier")?.value.trim() || "";
    if (!identifier) {
      state.authError = "Enter your username or UF email first, then choose Forgot password.";
      render();
      return;
    }
    await runAuthAction(
      () => requestPasswordReset(identifier),
      "If an FQC account matches that, a link to set a password is on its way to the UF inbox."
    );
  });

  document.querySelector("#sign-in-passkey")?.addEventListener("click", () => runAuthAction(signInWithPasskey));
  document.querySelector("#profile-logout")?.addEventListener("click", () => runAuthAction(logOut));
  document.querySelector("#send-password-link")?.addEventListener("click", async () => {
    const email = state.memberEmail || "your UF inbox";
    await runAuthAction(sendPasswordSetupEmail, `Password link sent to ${email}. Open it to set your password.`);
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
    const button = document.querySelector("#check-in-now");
    const label = button?.querySelector("span");
    if (button) {
      button.disabled = true;
      button.classList.add("is-working");
    }
    if (label) label.textContent = state.checkInRequireLocation ? "Checking location…" : "Saving check-in…";
    showActionFeedback("working", state.checkInRequireLocation ? "Checking that you’re within two miles…" : "Saving your attendance…");
    let result = null;
    try {
      const location = state.checkInRequireLocation ? await currentCheckInLocation() : null;
      if (state.checkInRequireLocation) {
        if (label) label.textContent = "Saving attendance…";
        showActionFeedback("working", "Location confirmed — saving attendance…");
      }
      result = await recordCheckIn(location);
    } catch (error) {
      state.authError = readableAuthError(error);
      showActionFeedback("error", state.authError);
      if (button?.isConnected) {
        button.disabled = false;
        button.classList.remove("is-working");
      }
      if (label?.isConnected) label.textContent = "I’m Here";
      return;
    }
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
      showActionFeedback("success", result.awarded === false ? "You were already checked in." : "Checked in — 1 point added.");
      render();
    }
  });

  document.querySelectorAll("[data-disclosure]").forEach((details) => {
    details.addEventListener("toggle", () => {
      state.openDisclosures[details.dataset.disclosure] = details.open;
      if (details.open && details.dataset.officerEvent) state.selectedOfficerEventId = details.dataset.officerEvent;
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
      await refreshOfficerOperations(true, { silent: true });
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
      await refreshOfficerOperations(true, { silent: true });
      await refreshEventData("officer budget save");
    });
  });

  document.querySelectorAll("[data-remove-budget-item]").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = Number(button.dataset.removeBudgetItem);
      const name = button.dataset.budgetItemName || "this line";
      const confirmed = await confirmDestructiveAction({
        title: "Remove this budget line?",
        message: `${name} will be cleared from the Treasurer Breakdown sheet. The event totals recalculate immediately.`,
        confirmLabel: "Remove Line"
      });
      if (!confirmed) return;
      const removed = await runAuthAction(() => deleteOfficerBudgetItem(row), "Budget line removed from Google Sheets.");
      if (!removed) return;
      state.officerOperationsLoaded = false;
      await refreshOfficerOperations(true, { silent: true });
      await refreshEventData("officer budget removal");
    });
  });

  document.querySelectorAll("[data-start-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (state.memberRole !== "officer") return;
      const eventId = button.dataset.startEvent;
      await runAuthAction(
        () => updateActiveCheckIn(eventId, true),
        "Check-in is open in the middle tab.",
        "Starting event check-in…"
      );
    });
  });
  document.querySelectorAll("[data-close-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (state.memberRole !== "officer") return;
      await runAuthAction(
        () => updateActiveCheckIn(button.dataset.closeEvent, false),
        "Event check-in is closed.",
        "Closing event check-in…"
      );
    });
  });

  document.querySelector("#save-profile")?.addEventListener("click", async () => {
    const name = document.querySelector("#member-name").value.trim();
    if (name.length < 2 || name.length > MAX_DISPLAY_NAME) {
      state.authError = `Use 2 to ${MAX_DISPLAY_NAME} characters for your display name.`;
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
  document.querySelectorAll("[data-open-leadership]").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = Number(button.dataset.openLeadership);
      const seat = state.leadershipRoster.find((entry) => entry.row === row);
      const uid = document.querySelector(`[data-leadership-holder="${row}"]`)?.value || button.dataset.holderUid || "";
      const confirmed = await confirmDestructiveAction({
        title: "Open this leadership seat?",
        message: `${seat?.name || "This officer"} stops holding ${seat?.title || "this seat"} and stays a plain officer. The seat returns to the roster so another account can be linked.`,
        confirmLabel: "Open seat"
      });
      if (!confirmed) return;
      const opened = await runAuthAction(() => openLeadershipSeat(row, uid), "Leadership seat opened.");
      if (opened) await refreshMemberDirectory();
    });
  });
  document.querySelectorAll("[data-assign-leadership]").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = Number(button.dataset.assignLeadership);
      const uid = document.querySelector(`[data-leadership-member="${row}"]`)?.value || "";
      if (!uid) {
        state.authError = "Choose the signed-in member account for that leadership role.";
        render();
        return;
      }
      const updated = await runAuthAction(() => assignLeadershipRole(uid, row), "Leadership role linked to that account.");
      if (updated) await refreshMemberDirectory();
    });
  });

  document.querySelector("#open-full-leaderboard")?.addEventListener("click", () => {
    state.leaderboardExpanded = true;
    render();
  });
  document.querySelector("#close-full-leaderboard")?.addEventListener("click", closeFullLeaderboard);
  document.querySelector("#leaderboard-backdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "leaderboard-backdrop") closeFullLeaderboard();
  });

  document.querySelectorAll("[data-open-member]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.memberRole !== "officer") return;
      // Swap the standings popup for the member's profile rather than stacking them.
      state.leaderboardExpanded = false;
      state.memberProfileUid = button.dataset.openMember;
      render();
      if (!state.members.length && !state.membersLoading) queueMicrotask(refreshMemberDirectory);
    });
  });
  document.querySelector("#close-member-profile")?.addEventListener("click", closeMemberProfile);
  document.querySelector("#member-profile-backdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "member-profile-backdrop") closeMemberProfile();
  });
  document.querySelectorAll("[data-remove-member]").forEach((button) => {
    button.addEventListener("click", async () => {
      const uid = button.dataset.removeMember;
      const member = state.members.find((entry) => entry.uid === uid);
      const name = member?.displayName || "This member";
      const confirmed = await confirmDestructiveAction({
        title: `Remove ${name}?`,
        message: `This permanently deletes ${name}’s FQC account, passkeys, points, check-in history, and RSVPs. They would have to create a brand-new account to return. This cannot be undone.`,
        confirmLabel: "Remove Member"
      });
      if (!confirmed) return;
      const removed = await runAuthAction(() => removeClubMember(uid), `${name} was removed from FQC.`);
      if (!removed) return;
      closeMemberProfile();
      state.leaderboardLoaded = false;
      await refreshMemberDirectory();
      await refreshLeaderboard(true);
    });
  });

  document.querySelector("#install-app")?.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    installPrompt = null;
    if (choice?.outcome === "accepted") showActionFeedback("success", "FQC is installing to your home screen.");
    render();
  });

  document.querySelector("#nuke-reload")?.addEventListener("click", nukeAndReload);
}

navItems.forEach((item) => item.addEventListener("click", () => setView(item.dataset.view)));
quickProfile.addEventListener("click", () => setView("profile"));
settingsToggle.addEventListener("click", () => setView("settings"));
themeToggle.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  if (state.view === "settings") render();
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  showActionFeedback("success", "FQC is on your home screen. Open it there for the full-screen app.");
  if (state.view === "settings") render();
});

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

async function resumePendingIntent() {
  const intent = state.pendingIntent;
  if (!intent || !state.loggedIn) return;
  state.pendingIntent = null;
  if (intent.type === "rsvp" && intent.eventId) {
    state.view = "home";
    saveState();
    render();
    await toggleRsvp(intent.eventId);
    return;
  }
  if (intent.type === "checkin") setView("checkin");
}

observeSession((session) => {
  state.authReady = true;
  state.authUser = session?.user || null;
  state.loggedIn = Boolean(session?.user);
  if (session?.profile) {
    applyMemberProfile(session.profile);
  } else {
    state.memberName = "Future Member";
    state.memberUsername = "";
    state.memberEmail = "";
    state.memberPhotoURL = "";
    state.memberRole = "member";
    state.leadership = "";
    state.officerTitle = "";
    state.canManageOfficers = false;
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
  if (state.view === "profile" && state.loggedIn) queueMicrotask(() => refreshLeaderboard());
  if (state.memberRole === "officer" && !state.members.length && !state.membersLoading) queueMicrotask(refreshMemberDirectory);
  if (state.memberRole === "officer" && !state.officerResourcesLoaded && !state.officerResourcesLoading) queueMicrotask(refreshOfficerResources);
  if (state.memberRole === "officer" && !state.officerOperationsLoaded && !state.officerOperationsLoading) queueMicrotask(refreshOfficerOperations);
  if (state.loggedIn && state.pendingIntent) queueMicrotask(resumePendingIntent);
}, (error) => {
  state.authReady = true;
  state.authError = readableAuthError(error);
  render();
});

observeCheckIn((checkIn) => {
  state.activeCheckInEventId = events.some((event) => event.id === checkIn.eventId) ? checkIn.eventId : events[0].id;
  state.checkInOpen = checkIn.open === true;
  state.checkInRequireLocation = checkIn.requireLocation !== false;
  if (state.authReady) render();
}, (error) => {
  state.authError = readableAuthError(error);
  if (state.authReady) render();
});

applyTheme(state.theme, false);
render();
// If the first screen has no map to wait on, reveal right after paint; otherwise
// initEventMap() reveals once the map is up. Hard cap so the splash never sticks.
requestAnimationFrame(() => {
  if (state.view !== "home" || !window.L) revealApp();
});
window.setTimeout(revealApp, 4500);
refreshEventData("initial Google Sheet load");
