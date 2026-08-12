const allowedViews = new Set(["home", "officers", "profile"]);
const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";

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
  calendarMonth: localStorage.getItem("fqc:calendar-month") || "2026-08",
  selectedEventId: localStorage.getItem("fqc:selected-event") || "kickoff",
  memberName: localStorage.getItem("fqc:name") || "Future Member",
  officerMode: localStorage.getItem("fqc:officer") === "true",
  rsvps: readJson("fqc:rsvps", []),
  notes: readJson("fqc:notes", [])
};

const locations = {
  innovation: {
    id: "innovation",
    name: "Innovation Lab 204",
    lat: 28.60088,
    lng: -81.1989,
    room: "Projector, 36 seats, whiteboards"
  },
  library: {
    id: "library",
    name: "Library Makerspace",
    lat: 28.60066,
    lng: -81.20161,
    room: "Laptops, worktables, 24 seats"
  },
  union: {
    id: "union",
    name: "Student Union Room B",
    lat: 28.60155,
    lng: -81.20028,
    room: "Open floor, 70 seats, permit needed"
  },
  research: {
    id: "research",
    name: "Research Center Lobby",
    lat: 28.5975,
    lng: -81.1978,
    room: "Meet at the main lobby check-in desk"
  }
};

const events = [
  {
    id: "kickoff",
    date: "2026-08-29",
    title: "Fall Quantum Kickoff",
    time: "2:00 PM",
    locationId: "innovation",
    food: "Pizza and sparkling water",
    focus: "Qubits, club roadmap, and team signups"
  },
  {
    id: "workshop",
    date: "2026-09-05",
    title: "Beginner Circuit Workshop",
    time: "11:00 AM",
    locationId: "library",
    food: "Bagels, fruit, and coffee",
    focus: "Hands-on circuit building for new members"
  },
  {
    id: "social",
    date: "2026-09-12",
    title: "Quantum Games Social",
    time: "5:30 PM",
    locationId: "union",
    food: "Tacos and vegetarian bowls",
    focus: "Member mixer, games, and leaderboard points"
  },
  {
    id: "tour",
    date: "2026-10-07",
    title: "Lab Visit and Demo Day",
    time: "3:30 PM",
    locationId: "research",
    food: "Snacks after the tour",
    focus: "Research demos; attendance is capped"
  }
];

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
      <section class="event-explorer" aria-label="FQC events and locations">
        <div class="event-planner">
          <div class="event-intro">
            <p class="section-kicker">Explore together</p>
            <h2>What’s happening</h2>
            <p>Choose an event to see exactly where it meets.</p>
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
            <div class="event-list" aria-label="Upcoming events">
              ${events.map(renderEventCard).join("")}
            </div>
          </div>

          <div class="event-mode-panel" data-event-panel="calendar" ${state.eventMode === "calendar" ? "" : "hidden"}>
            <div id="event-calendar">${renderCalendarMonth()}</div>
          </div>
        </div>

        <div class="event-map-shell">
          <div class="map-status"><span></span>${events.length} upcoming locations</div>
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
  const monthEvents = events.filter((event) => event.date.startsWith(state.calendarMonth));
  const eventByDay = new Map(monthEvents.map((event) => [Number(event.date.slice(8, 10)), event]));
  const cells = [];

  for (let index = 0; index < leadingDays; index += 1) cells.push('<span class="calendar-day outside" aria-hidden="true"></span>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const event = eventByDay.get(day);
    if (event) {
      const selected = event.id === state.selectedEventId;
      cells.push(`
        <button class="calendar-day has-event${selected ? " selected" : ""}" type="button" data-select-event="${event.id}" aria-pressed="${selected}" aria-label="${escapeHtml(event.title)}, ${escapeHtml(formatEventDate(event, { month: "long", day: "numeric" }))}">
          <span>${day}</span><i></i>
        </button>
      `);
    } else {
      cells.push(`<span class="calendar-day"><span>${day}</span></span>`);
    }
  }

  return `
    <div class="calendar-heading">
      <button type="button" data-calendar-shift="-1" aria-label="Previous month"><svg><use href="#icon-chevron-left"></use></svg></button>
      <div>
        <strong>${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(firstDay)}</strong>
        <span>${monthEvents.length} ${monthEvents.length === 1 ? "event" : "events"}</span>
      </div>
      <button type="button" data-calendar-shift="1" aria-label="Next month"><svg><use href="#icon-chevron-right"></use></svg></button>
    </div>
    <div class="calendar-weekdays" aria-hidden="true">
      ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<span>${day}</span>`).join("")}
    </div>
    <div class="calendar-grid">${cells.join("")}</div>
    ${monthEvents.length ? `
      <div class="calendar-agenda">
        ${monthEvents.map((event) => {
          const location = getEventLocation(event);
          return `<button type="button" data-select-event="${event.id}"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.time)} · ${escapeHtml(location.name)}</span></button>`;
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
          <span>${escapeHtml(event.food)}</span>
          <span>${escapeHtml(location.room)}</span>
        </div>
        <p class="event-detail-focus">${escapeHtml(event.focus)}</p>
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
  if (!events.some((event) => event.id === eventId)) return;
  state.selectedEventId = eventId;
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

  if (options.focusMap !== false) focusSelectedEvent();
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
    scrollWheelZoom: false
  });

  window.L.control.zoom({ position: "topright" }).addTo(eventMap);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(eventMap);

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
      })
    }).addTo(eventMap);
    marker.on("click", () => selectEvent(event.id));
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

applyTheme(state.theme, false);
render();
