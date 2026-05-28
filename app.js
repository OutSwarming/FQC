const state = {
  view: localStorage.getItem("fqc:view") || "home",
  memberName: localStorage.getItem("fqc:name") || "Future Member",
  officerMode: localStorage.getItem("fqc:officer") === "true",
  rsvps: JSON.parse(localStorage.getItem("fqc:rsvps") || "[]"),
  notes: JSON.parse(localStorage.getItem("fqc:notes") || "[]")
};

const events = [
  {
    id: "kickoff",
    month: "may",
    day: "31",
    weekday: "Sun",
    title: "Summer Quantum Kickoff",
    time: "2:00 PM",
    place: "Innovation Lab 204",
    food: "Pizza and sparkling water",
    focus: "Qubits, club roadmap, team signups"
  },
  {
    id: "workshop",
    month: "jun",
    day: "06",
    weekday: "Sat",
    title: "Beginner Circuit Workshop",
    time: "11:00 AM",
    place: "Library Makerspace",
    food: "Bagels, fruit, coffee",
    focus: "Hands-on circuit building"
  },
  {
    id: "social",
    month: "jun",
    day: "13",
    weekday: "Sat",
    title: "Quantum Games Social",
    time: "5:30 PM",
    place: "Student Union Room B",
    food: "Tacos and vegetarian bowls",
    focus: "Member mixer and leaderboard points"
  },
  {
    id: "tour",
    month: "jul",
    day: "08",
    weekday: "Wed",
    title: "Lab Visit and Demo Day",
    time: "3:30 PM",
    place: "Research Center Lobby",
    food: "Snacks after the tour",
    focus: "Permits required, attendance capped"
  }
];

const locations = [
  {
    name: "Innovation Lab 204",
    use: "Workshops and officer meetings",
    food: "Best for pizza, boxed lunches, or snack trays",
    room: "Projector, 36 seats, whiteboards"
  },
  {
    name: "Library Makerspace",
    use: "Beginner lessons and demos",
    food: "Quiet food only: bagels, fruit, bottled drinks",
    room: "Laptops, soldering tables, 24 seats"
  },
  {
    name: "Student Union Room B",
    use: "Socials and larger member nights",
    food: "Catering-friendly with nearby pickup",
    room: "Open floor, 70 seats, permit needed"
  }
];

const officerStats = [
  ["$1,840", "Budget available"],
  ["82%", "Average attendance"],
  ["3", "Permits pending"],
  ["5", "Ad posts scheduled"]
];

const tasks = [
  ["Budget", "Confirm food spend for kickoff", "Ready"],
  ["Permits", "Submit Student Union room request", "Due"],
  ["Rooms", "Reserve Makerspace for June workshop", "Ready"],
  ["Advertising", "Post kickoff flyer and reminder", "Draft"],
  ["Socials", "Choose July mixer format", "Vote"]
];

const leaders = [
  ["Maya", "Circuit Builder", 1280],
  ["Alex", "Event Captain", 1145],
  ["Jordan", "Quantum Explorer", 980],
  ["Sam", "Lab Helper", 840]
];

const titles = {
  home: "Home",
  calendar: "Calendar",
  map: "Map",
  officers: "Officers",
  profile: "Profile"
};

const app = document.querySelector("#app");
const title = document.querySelector("#screen-title");
const navItems = [...document.querySelectorAll(".nav-item")];
const quickProfile = document.querySelector("#quick-profile");
const profileInitial = document.querySelector("#profile-initial");

function saveState() {
  localStorage.setItem("fqc:view", state.view);
  localStorage.setItem("fqc:name", state.memberName);
  localStorage.setItem("fqc:officer", String(state.officerMode));
  localStorage.setItem("fqc:rsvps", JSON.stringify(state.rsvps));
  localStorage.setItem("fqc:notes", JSON.stringify(state.notes));
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

  Object.assign(state, {
    view: "home",
    memberName: "Future Member",
    officerMode: false,
    rsvps: [],
    notes: []
  });

  window.setTimeout(() => window.location.reload(), 80);
}

function stopZoomGesture(event) {
  event.preventDefault();
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

function setView(view) {
  state.view = view;
  saveState();
  render();
}

function render() {
  title.textContent = titles[state.view] || "Home";
  profileInitial.textContent = state.memberName.trim().charAt(0).toUpperCase() || "F";
  navItems.forEach((item) => {
    const active = item.dataset.view === state.view;
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });

  const views = {
    home: renderHome,
    calendar: renderCalendar,
    map: renderMap,
    officers: renderOfficers,
    profile: renderProfile
  };

  app.innerHTML = views[state.view]?.() || renderHome();
  bindViewEvents();
  app.focus({ preventScroll: true });
}

function renderMetrics(metrics) {
  return metrics.map(([value, label]) => `
    <article class="metric-card">
      <strong>${value}</strong>
      <span>${label}</span>
    </article>
  `).join("");
}

function renderHome() {
  const nextEvent = events[0];
  return `
    <section class="view" data-screen="home">
      <article class="hero wordmark-hero">
        <img class="opening-wordmark" src="./assets/fqc-wordmark.jpg" alt="FQC wordmark" />
        <div class="hero-content">
          <h2>Florida Quantum Computing</h2>
          <p>Track events, meetups, food plans, locations, points, and officer work from one app.</p>
          <div class="action-row">
            <button class="primary-button" type="button" data-jump="calendar">
              <svg><use href="#icon-calendar"></use></svg>
              <span>Next Event</span>
            </button>
            <button class="secondary-button" type="button" data-jump="officers">
              <svg><use href="#icon-lock"></use></svg>
              <span>Officer Portal</span>
            </button>
          </div>
        </div>
      </article>

      <section class="metric-grid" aria-label="Club snapshot">
        ${renderMetrics([["4", "Upcoming events"], ["3", "Active locations"], ["12", "Officer tasks"]])}
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>Coming Up</h2>
            <p>${nextEvent.weekday}, ${nextEvent.month.toUpperCase()} ${nextEvent.day} at ${nextEvent.time}</p>
          </div>
          <button class="chip-button" type="button" data-rsvp="${nextEvent.id}">
            <svg><use href="#icon-check"></use></svg>
            <span>${state.rsvps.includes(nextEvent.id) ? "Going" : "RSVP"}</span>
          </button>
        </div>
        <h3>${nextEvent.title}</h3>
        <div class="tag-row">
          <span class="tag">${nextEvent.place}</span>
          <span class="tag gold">${nextEvent.food}</span>
        </div>
        <p>${nextEvent.focus}</p>
      </section>

      <section class="section">
        <h2>Member Principles</h2>
        <div class="principle-grid">
          <article class="principle">
            <strong>Explore</strong>
            <p>Visit club spaces, try demos, and ask practical questions.</p>
          </article>
          <article class="principle">
            <strong>Learn</strong>
            <p>Build circuits, share notes, and turn confusion into progress.</p>
          </article>
          <article class="principle">
            <strong>Help</strong>
            <p>Make events smoother through attendance, setup, and cleanup.</p>
          </article>
          <article class="principle">
            <strong>Lead</strong>
            <p>Earn points by hosting workshops and supporting new members.</p>
          </article>
        </div>
      </section>
    </section>
  `;
}

function renderCalendar() {
  return `
    <section class="view" data-screen="calendar">
      <section class="section">
        <div class="section-header">
          <div>
            <h2>Events</h2>
            <p>Calendar, room, food, and attendance notes for members.</p>
          </div>
          <div class="segmented" role="tablist" aria-label="Month filter">
            <button class="active" type="button" data-month="all">All</button>
            <button type="button" data-month="jun">June</button>
            <button type="button" data-month="jul">July</button>
          </div>
        </div>
        <div class="event-list" id="event-list">
          ${events.map(renderEvent).join("")}
        </div>
      </section>
    </section>
  `;
}

function renderEvent(event) {
  const going = state.rsvps.includes(event.id);
  return `
    <article class="event-card" data-event-month="${event.month}">
      <div class="date-block">
        <span>${event.month}</span>
        <strong>${event.day}</strong>
      </div>
      <div>
        <h3>${event.title}</h3>
        <div class="event-meta">
          <span class="tag">${event.weekday} ${event.time}</span>
          <span class="tag">${event.place}</span>
          <span class="tag gold">${event.food}</span>
        </div>
        <p>${event.focus}</p>
        <button class="${going ? "secondary-button" : "primary-button"}" type="button" data-rsvp="${event.id}">
          <svg><use href="#icon-check"></use></svg>
          <span>${going ? "Going" : "RSVP"}</span>
        </button>
      </div>
    </article>
  `;
}

function renderMap() {
  return `
    <section class="view" data-screen="map">
      <section class="section">
        <div class="section-header">
          <div>
            <h2>Locations and Food</h2>
            <p>Fast planning notes for where each event should happen and what food fits.</p>
          </div>
        </div>
        <div class="map-panel" aria-label="Prototype event map">
          <div class="map-route"></div>
          <div class="pin one"><span>1</span></div>
          <div class="pin two"><span>2</span></div>
          <div class="pin three"><span>3</span></div>
        </div>
      </section>

      <section class="location-grid">
        ${locations.map((location) => `
          <article class="location-card">
            <h3>${location.name}</h3>
            <p>${location.use}</p>
            <div class="tag-row">
              <span class="tag gold">${location.food}</span>
              <span class="tag">${location.room}</span>
            </div>
          </article>
        `).join("")}
      </section>
    </section>
  `;
}

function renderOfficers() {
  if (!state.officerMode) {
    return `
      <section class="view" data-screen="officers">
        <section class="section officer-gate">
          <div>
            <h2>Officer Portal</h2>
            <p>Sign in for budget, permits, rooms, advertising, socials, and attendance tracking.</p>
          </div>
          <div class="form-row">
            <label for="officer-code">Officer code</label>
            <input id="officer-code" type="password" inputmode="text" autocomplete="off" placeholder="Try officer" />
          </div>
          <button class="primary-button" id="officer-login" type="button">
            <svg><use href="#icon-lock"></use></svg>
            <span>Unlock Portal</span>
          </button>
        </section>
      </section>
    `;
  }

  return `
    <section class="view" data-screen="officers">
      <section class="metric-grid" aria-label="Officer metrics">
        ${renderMetrics(officerStats)}
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>Officer Command Center</h2>
            <p>Budget, attendance, permits, rooms, advertising, and socials.</p>
          </div>
          <button class="danger-button" id="officer-logout" type="button">Lock</button>
        </div>
        <div class="portal-grid">
          ${officerStats.map(([value, label]) => `
            <article class="officer-card">
              <strong>${value}</strong>
              <p>${label}</p>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="section">
        <h2>Planning Tasks</h2>
        <div class="task-list">
          ${tasks.map(([area, task, status]) => `
            <article class="task-item">
              <div>
                <h3>${area}</h3>
                <p>${task}</p>
              </div>
              <span class="task-status">${status}</span>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>Officer Notes</h2>
            <p>Saved locally for the prototype.</p>
          </div>
        </div>
        <div class="form-row">
          <label for="note-area">Area</label>
          <select id="note-area">
            <option>Budget</option>
            <option>Attendance</option>
            <option>Permits</option>
            <option>Rooms</option>
            <option>Advertising</option>
            <option>Socials</option>
          </select>
        </div>
        <div class="form-row">
          <label for="note-text">Note</label>
          <textarea id="note-text" placeholder="Add the next action or decision"></textarea>
        </div>
        <button class="primary-button" id="add-note" type="button">
          <svg><use href="#icon-plus"></use></svg>
          <span>Add Note</span>
        </button>
        <div class="task-list" id="notes-list">
          ${renderNotes()}
        </div>
      </section>
    </section>
  `;
}

function renderNotes() {
  if (!state.notes.length) {
    return `<p class="empty-state">No officer notes yet.</p>`;
  }

  return state.notes.map((note) => `
    <article class="task-item">
      <div>
        <h3>${escapeHtml(note.area)}</h3>
        <p>${escapeHtml(note.text)}</p>
      </div>
      <span class="task-status">${escapeHtml(note.date)}</span>
    </article>
  `).join("");
}

function renderProfile() {
  const rsvpPoints = state.rsvps.length * 50;
  const points = 730 + rsvpPoints;
  return `
    <section class="view" data-screen="profile">
      <section class="section">
        <div class="profile-summary">
          <div class="avatar">${profileInitial.textContent}</div>
          <div>
            <h2>${escapeHtml(state.memberName)}</h2>
            <p>${points} points earned</p>
            <div class="progress" aria-label="Progress to next badge">
              <span style="width: ${Math.min(92, 48 + state.rsvps.length * 12)}%"></span>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Profile</h2>
        <div class="form-row">
          <label for="member-name">Display name</label>
          <input id="member-name" value="${escapeHtml(state.memberName)}" />
        </div>
        <button class="primary-button" id="save-profile" type="button">
          <svg><use href="#icon-check"></use></svg>
          <span>Save</span>
        </button>
      </section>

      <section class="section">
        <h2>Fix and Troubleshooting</h2>
        <p>Reset local app data, clear the offline cache, and reload a fresh copy.</p>
        <button class="danger-button" id="nuke-reload" type="button">
          <svg><use href="#icon-plus"></use></svg>
          <span>Nuke and Reload</span>
        </button>
      </section>

      <section class="section">
        <h2>Leaderboard</h2>
        <div class="leaderboard">
          ${leaders.map(([name, badge, score], index) => `
            <article class="leader-card">
              <span class="leader-rank">${index + 1}</span>
              <div>
                <h3>${name}</h3>
                <p>${badge}</p>
              </div>
              <strong>${score}</strong>
            </article>
          `).join("")}
        </div>
      </section>
    </section>
  `;
}

function bindViewEvents() {
  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.jump));
  });

  document.querySelectorAll("[data-rsvp]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.rsvp;
      state.rsvps = state.rsvps.includes(id)
        ? state.rsvps.filter((eventId) => eventId !== id)
        : [...state.rsvps, id];
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-month]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-month]").forEach((monthButton) => monthButton.classList.remove("active"));
      button.classList.add("active");
      const month = button.dataset.month;
      document.querySelectorAll("[data-event-month]").forEach((card) => {
        card.hidden = month !== "all" && card.dataset.eventMonth !== month;
      });
    });
  });

  document.querySelector("#officer-login")?.addEventListener("click", () => {
    const code = document.querySelector("#officer-code").value.trim().toLowerCase();
    if (code === "officer" || code === "fqc") {
      state.officerMode = true;
      saveState();
      render();
      return;
    }
    document.querySelector("#officer-code").setAttribute("aria-invalid", "true");
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
    state.notes = [
      {
        area,
        text,
        date: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date())
      },
      ...state.notes
    ].slice(0, 8);
    saveState();
    render();
  });

  document.querySelector("#save-profile")?.addEventListener("click", () => {
    const name = document.querySelector("#member-name").value.trim();
    state.memberName = name || "Future Member";
    saveState();
    render();
  });

  document.querySelector("#nuke-reload")?.addEventListener("click", () => {
    nukeAndReload();
  });
}

navItems.forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view));
});

quickProfile.addEventListener("click", () => setView("profile"));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
  document.addEventListener(eventName, stopZoomGesture, { passive: false });
});

render();
