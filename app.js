const allowedViews = new Set(["home", "officers", "profile"]);
const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const EVENT_SHEET_ID = "1USQju8bWHgXu6X95-NVh6PAGp6GyjCNPqecfTPBTx50";
const EVENT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const EVENT_DATA_CACHE_KEY = "fqc:event-data";
const EVENT_DATA_SOURCE = "FQC Events Google Sheet";
const MAX_EVENTS = 250;
const MAX_LOCATIONS = 250;
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
  officerMode: localStorage.getItem("fqc:officer") === "true",
  rsvps: readJson("fqc:rsvps", []),
  notes: readJson("fqc:notes", [])
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
    .filter((row) => String(row.Published || "").toLowerCase() === "yes")
    .map((row) => ({
      id: row["Event ID"],
      date: normalizeSheetDate(row["Event Date"]),
      title: row["Event Name"],
      time: normalizeSheetTime(row["Start Time"]),
      locationId: locationIdFor(row.Location),
      room: row.Room ? `Room ${row.Room.replace(/^room\s+/i, "")}` : "Room details in event post",
      description: row["Event Description"] || "See the FQC event announcement for details."
    }))
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
  if (!localStorage.getItem("fqc:calendar-month") || !/^\d{4}-\d{2}$/.test(state.calendarMonth)) {
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
    fetch(sheetCsvUrl("Events"), { cache: "no-store" }),
    fetch(sheetCsvUrl("UF Locations"), { cache: "no-store" })
  ])
    .then(async ([eventsResponse, locationsResponse]) => {
      if (!eventsResponse.ok || !locationsResponse.ok) throw new Error(`Sheet request failed (${eventsResponse.status}/${locationsResponse.status}).`);
      const nextData = buildSheetEventData(await eventsResponse.text(), await locationsResponse.text());
      const previousSource = eventDataSource;
      const changed = applyEventData(nextData, { source: EVENT_DATA_SOURCE });
      if ((changed || previousSource !== eventDataSource) && state.view === "home") render();
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

if (!events.some((event) => event.id === state.selectedEventId)) state.selectedEventId = events[0].id;
if (!/^(list|calendar)$/.test(state.eventMode)) state.eventMode = "list";
if (!/^\d{4}-\d{2}$/.test(state.calendarMonth)) state.calendarMonth = events[0].date.slice(0, 7);
if (!/^(light|dark)$/.test(state.theme)) state.theme = systemTheme;

const officerStats = [
  ["$1,840", "Budget available"],
  ["82%", "Average attendance"],
  ["3", "Permits pending"],
  ["5", "Ad posts scheduled"]
];

const tasks = [
  ["Budget", "Confirm food spend for kickoff", "Ready"],
  ["Permits", "Submit Student Union room request", "Due"],
  ["Rooms", "Reserve Makerspace for September workshop", "Ready"],
  ["Advertising", "Post kickoff flyer and reminder", "Draft"],
  ["Socials", "Choose October mixer format", "Vote"]
];

const leaders = [
  ["Maya", "Circuit Builder", 1280],
  ["Alex", "Event Captain", 1145],
  ["Jordan", "Quantum Explorer", 980],
  ["Sam", "Lab Helper", 840]
];

const titles = {
  home: "Events",
  officers: "Officers",
  profile: "Profile"
};

const app = document.querySelector("#app");
const title = document.querySelector("#screen-title");
const navItems = [...document.querySelectorAll(".nav-item")];
const quickProfile = document.querySelector("#quick-profile");
const profileInitial = document.querySelector("#profile-initial");
const themeToggle = document.querySelector("#theme-toggle");
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
  localStorage.setItem("fqc:officer", String(state.officerMode));
  localStorage.setItem("fqc:rsvps", JSON.stringify(state.rsvps));
  localStorage.setItem("fqc:notes", JSON.stringify(state.notes));
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

function formatEventDate(event, options = {}) {
  return new Intl.DateTimeFormat("en-US", options).format(eventDate(event));
}

function formatEventDataStatus() {
  if (!eventDataUpdatedAt) return eventDataSource;
  const refreshed = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(eventDataUpdatedAt));
  return `${eventDataSource} · ${refreshed}`;
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

function stopZoomGesture(event) {
  event.preventDefault();
}

function setView(view) {
  state.view = allowedViews.has(view) ? view : "home";
  saveState();
  render();
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
    officers: renderOfficers,
    profile: renderProfile
  };

  app.innerHTML = views[state.view]?.() || renderHome();
  bindViewEvents();
  app.focus({ preventScroll: true });
  if (state.view === "home") requestAnimationFrame(initEventMap);
}

function renderHome() {
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
            </div>

            <div class="event-mode-panel" data-event-panel="list" ${state.eventMode === "list" ? "" : "hidden"}>
              <div class="event-list" aria-label="Published events">
                ${events.map(renderEventCard).join("")}
              </div>
            </div>

            <div class="event-mode-panel" data-event-panel="calendar" ${state.eventMode === "calendar" ? "" : "hidden"}>
              <div id="event-calendar">${renderCalendarMonth()}</div>
            </div>
          </div>
        </div>

        <div class="event-map-shell">
          <div class="map-status"><span></span>${events.length} published ${events.length === 1 ? "event" : "events"}</div>
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

function renderEventCard(event) {
  const location = getEventLocation(event);
  const selected = event.id === state.selectedEventId;
  const going = state.rsvps.includes(event.id);
  return `
    <article class="event-card${selected ? " selected" : ""}" data-event-card="${event.id}">
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
      <button class="event-rsvp-mini${going ? " going" : ""}" type="button" data-rsvp="${event.id}" aria-label="${going ? "Cancel RSVP for" : "RSVP for"} ${escapeHtml(event.title)}">
        ${going ? "Going" : "RSVP"}
      </button>
    </article>
  `;
}

function renderCalendarMonth() {
  const [year, month] = state.calendarMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingDays = firstDay.getDay();
  const previousMonthDays = new Date(year, month - 1, 0).getDate();
  const monthEvents = events.filter((event) => event.date.startsWith(state.calendarMonth));
  const eventMonths = [...new Set(events.map((event) => event.date.slice(0, 7)))].sort();
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
      <button type="button" data-calendar-shift="-1" aria-label="Previous month" ${state.calendarMonth <= firstEventMonth ? "disabled" : ""}><svg><use href="#icon-chevron-left"></use></svg></button>
      <div>
        <strong>${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(firstDay)}</strong>
        <span>${monthEvents.length} ${monthEvents.length === 1 ? "event" : "events"} · ${events.length} this semester</span>
      </div>
      <button type="button" data-calendar-shift="1" aria-label="Next month" ${state.calendarMonth >= lastEventMonth ? "disabled" : ""}><svg><use href="#icon-chevron-right"></use></svg></button>
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
        <button class="primary-button${going ? " going" : ""}" type="button" data-rsvp="${event.id}">${going ? "Going" : "RSVP"}</button>
      </div>
    </article>
  `;
}

function setEventMode(mode) {
  state.eventMode = mode === "calendar" ? "calendar" : "list";
  saveState();
  document.querySelectorAll("[data-event-tab]").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.eventTab === state.eventMode));
  });
  document.querySelectorAll("[data-event-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.eventPanel !== state.eventMode;
  });
  if (isMobileEventSheetViewport()) {
    const nextSheetMode = state.eventMode === "calendar" || mobileEventSheetMode === "high"
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

function toggleRsvp(eventId) {
  state.rsvps = state.rsvps.includes(eventId)
    ? state.rsvps.filter((id) => id !== eventId)
    : [...state.rsvps, eventId];
  saveState();

  document.querySelectorAll(`[data-rsvp="${eventId}"]`).forEach((button) => {
    const going = state.rsvps.includes(eventId);
    button.classList.toggle("going", going);
    button.textContent = going ? "Going" : "RSVP";
    button.setAttribute("aria-label", `${going ? "Cancel RSVP for" : "RSVP for"} ${getEvent(eventId).title}`);
  });
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

function renderOfficers() {
  if (!state.officerMode) {
    return `
      <section class="view" data-screen="officers">
        <section class="section officer-gate">
          <div>
            <p class="section-kicker">Private workspace</p>
            <h2>Officer Portal</h2>
            <p>Sign in for budget, permits, rooms, advertising, socials, and attendance tracking.</p>
          </div>
          <div class="form-row">
            <label for="officer-code">Officer code</label>
            <input id="officer-code" type="password" autocomplete="off" placeholder="Try officer" />
          </div>
          <button class="primary-button" id="officer-login" type="button">
            <svg><use href="#icon-lock"></use></svg><span>Unlock Portal</span>
          </button>
        </section>
      </section>
    `;
  }

  return `
    <section class="view" data-screen="officers">
      <section class="metric-grid" aria-label="Officer metrics">${renderMetrics(officerStats)}</section>
      <section class="section">
        <div class="section-header">
          <div><p class="section-kicker">Operations</p><h2>Officer Command Center</h2><p>Budget, attendance, permits, rooms, advertising, and socials.</p></div>
          <button class="danger-button" id="officer-logout" type="button">Lock</button>
        </div>
        <div class="portal-grid">
          ${officerStats.map(([value, label]) => `<article class="officer-card"><strong>${value}</strong><p>${label}</p></article>`).join("")}
        </div>
      </section>
      <section class="section">
        <h2>Planning Tasks</h2>
        <div class="task-list">
          ${tasks.map(([area, task, status]) => `<article class="task-item"><div><h3>${area}</h3><p>${task}</p></div><span class="task-status">${status}</span></article>`).join("")}
        </div>
      </section>
      <section class="section">
        <div class="section-header"><div><h2>Officer Notes</h2><p>Saved locally for the prototype.</p></div></div>
        <div class="form-row">
          <label for="note-area">Area</label>
          <select id="note-area"><option>Budget</option><option>Attendance</option><option>Permits</option><option>Rooms</option><option>Advertising</option><option>Socials</option></select>
        </div>
        <div class="form-row"><label for="note-text">Note</label><textarea id="note-text" placeholder="Add the next action or decision"></textarea></div>
        <button class="primary-button" id="add-note" type="button"><svg><use href="#icon-plus"></use></svg><span>Add Note</span></button>
        <div class="task-list" id="notes-list">${renderNotes()}</div>
      </section>
    </section>
  `;
}

function renderNotes() {
  if (!state.notes.length) return '<p class="empty-state">No officer notes yet.</p>';
  return state.notes.map((note) => `
    <article class="task-item">
      <div><h3>${escapeHtml(note.area)}</h3><p>${escapeHtml(note.text)}</p></div>
      <span class="task-status">${escapeHtml(note.date)}</span>
    </article>
  `).join("");
}

function renderProfile() {
  const points = 730 + state.rsvps.length * 50;
  return `
    <section class="view" data-screen="profile">
      <section class="section">
        <div class="profile-summary">
          <div class="avatar">${profileInitial.textContent}</div>
          <div><h2>${escapeHtml(state.memberName)}</h2><p>${points} points earned</p><div class="progress" aria-label="Progress to next badge"><span style="width: ${Math.min(92, 48 + state.rsvps.length * 12)}%"></span></div></div>
        </div>
      </section>
      <section class="section">
        <h2>Profile</h2>
        <div class="form-row"><label for="member-name">Display name</label><input id="member-name" value="${escapeHtml(state.memberName)}" /></div>
        <button class="primary-button" id="save-profile" type="button"><svg><use href="#icon-check"></use></svg><span>Save</span></button>
      </section>
      <section class="section">
        <h2>Fix and Troubleshooting</h2><p>Reset local app data, clear the offline cache, and reload a fresh copy.</p>
        <button class="danger-button" id="nuke-reload" type="button"><svg><use href="#icon-plus"></use></svg><span>Nuke and Reload</span></button>
      </section>
      <section class="section">
        <h2>Leaderboard</h2>
        <div class="leaderboard">
          ${leaders.map(([name, badge, score], index) => `<article class="leader-card"><span class="leader-rank">${index + 1}</span><div><h3>${name}</h3><p>${badge}</p></div><strong>${score}</strong></article>`).join("")}
        </div>
      </section>
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
  bindCalendarEvents();
  bindRsvpEvents();
  bindMobileEventSheet();

  document.querySelector("#officer-login")?.addEventListener("click", () => {
    const input = document.querySelector("#officer-code");
    const code = input.value.trim().toLowerCase();
    if (code === "officer" || code === "fqc") {
      state.officerMode = true;
      saveState();
      render();
      return;
    }
    input.setAttribute("aria-invalid", "true");
  });

  document.querySelector("#officer-logout")?.addEventListener("click", () => {
    state.officerMode = false;
    saveState();
    render();
  });

  document.querySelector("#add-note")?.addEventListener("click", () => {
    const area = document.querySelector("#note-area").value;
    const text = document.querySelector("#note-text").value.trim();
    if (!text) return;
    state.notes = [{ area, text, date: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date()) }, ...state.notes].slice(0, 8);
    saveState();
    render();
  });

  document.querySelector("#save-profile")?.addEventListener("click", () => {
    const name = document.querySelector("#member-name").value.trim();
    state.memberName = name || "Future Member";
    saveState();
    render();
  });

  document.querySelector("#nuke-reload")?.addEventListener("click", nukeAndReload);
}

navItems.forEach((item) => item.addEventListener("click", () => setView(item.dataset.view)));
quickProfile.addEventListener("click", () => setView("profile"));
themeToggle.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
  document.addEventListener(eventName, stopZoomGesture, { passive: false });
});

window.addEventListener("online", () => refreshEventData("network reconnect"));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshEventData("tab became active");
});
window.setInterval(() => {
  if (!document.hidden && navigator.onLine) refreshEventData("five-minute refresh");
}, EVENT_REFRESH_INTERVAL_MS);

applyTheme(state.theme, false);
render();
refreshEventData("initial Google Sheet load");
