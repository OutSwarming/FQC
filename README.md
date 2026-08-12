# Florida Quantum Computing App

A responsive web app prototype for Florida Quantum Computing. It is designed for GitHub Pages hosting and focuses on two audiences:

- Members: one synchronized event list, calendar, and interactive map; RSVP tracking; light and dark themes; leaderboard; and profile progress.
- Officers: attendance, budget, permits, rooms, advertising, socials, and quick planning records.

## Event Data Workflow

The public event explorer reads from the native Google Sheet [FQC Events](https://docs.google.com/spreadsheets/d/1z6CAfx2xDEfnIdG3FXm1aLc9s_ane5wnbDBywToQK_Y/edit). The `Events` table contains the event name, date, start time, venue, room, description, publish status, and a stable event ID. The `UF Locations` table contains map coordinates and ranks venue choices by historical FQC usage.

- Set `Published` to `Yes` to include a valid row in the app; `No` rows stay private to the planning sheet.
- Choose a venue from the Location dropdown so the event can be placed on the map.
- Keep each Event ID unique and unchanged after publication so member RSVPs remain attached to the right event.
- The app refreshes the Sheet when it opens, when the tab becomes active, and every five minutes while online.
- A last-good local copy and a bundled copy of the verified Spring 2026 schedule keep the UI usable if Google Sheets is unavailable.

## Milestone Plan

1. Static app foundation
   - Mobile app shell with bottom navigation.
   - GitHub Pages-compatible file structure.
   - Project roadmap and deployment notes.

2. Member experience
   - Unified Events home with list and calendar tabs.
   - Leaflet map synchronized with event selection.
   - Responsive event detail card with directions and RSVP actions.
   - Persistent light and dark themes.
   - Profile and leaderboard preview.

3. Officer portal
   - Officer mode sign-in prototype.
   - Budget, attendance, permits, rooms, advertising, and socials cards.
   - Local demo data persistence.

4. Testing and deployment
   - Playwright smoke tests.
   - GitHub Pages workflow.
   - Repository published under `OutSwarming`.

## Local Development

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```

## GitHub Pages

This repo includes `.github/workflows/pages.yml`, which publishes the static site whenever `main` is pushed.

In GitHub, set Pages source to `GitHub Actions` if it is not already selected.
