# Florida Quantum Computing App

A responsive web app prototype for Florida Quantum Computing. It is designed for GitHub Pages hosting and focuses on two audiences:

- Members: one synchronized event list, calendar, and interactive map; RSVP tracking; light and dark themes; leaderboard; and profile progress.
- Officers: attendance, budget, permits, rooms, advertising, socials, and quick planning records.

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
