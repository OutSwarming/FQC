# Florida Quantum Computing App

A responsive Firebase web app for Florida Quantum Computing with a unified events experience and secure member accounts:

- Members: one synchronized event list, calendar, and interactive map; RSVP tracking; light and dark themes; leaderboard; and profile progress.
- Officers: live event check-in controls and an officer-specific profile workspace.
- President and Treasurer: protected ordinary-officer promotion and removal from the Firebase-backed account directory.

## Authentication and access

- Google and Apple use Firebase Authentication.
- Members can register a device passkey and later sign in with Face ID, Touch ID, Windows Hello, or another WebAuthn authenticator.
- After social sign-in, a new account enters an eight-digit UFID once. The raw UFID is HMAC-hashed inside a Cloud Function and is never stored in the browser, Firestore, logs, or the website-readable spreadsheet.
- The `Officer Access` tab in the events workbook contains only HMAC fingerprints, active flags, and officer titles. Firebase refreshes it on a five-minute cache cycle. A match receives the listed title; no match becomes a Member.
- Any officer can recommend a member. Only the President and Treasurer can complete promotions or remove ordinary officers, and their own leadership roles are protected.
- Role claims and attendance writes are enforced server-side and are never trusted from the browser.
- Firestore security rules keep profiles private, passkey credentials server-only, and check-in mutations restricted to Cloud Functions.

## Event Data Workflow

The public event explorer reads from the organization-owned native Google Sheet [FQC Events – Website Schedule](https://docs.google.com/spreadsheets/d/1USQju8bWHgXu6X95-NVh6PAGp6GyjCNPqecfTPBTx50/edit). The `Events` table contains the event name, date, start time, venue, room, description, publish status, and a stable event ID. The `UF Locations` table contains map coordinates and ranks venue choices by historical FQC usage.

- Set `Published` to `Yes` to include a valid row in the app; `No` rows stay private to the planning sheet.
- Choose a venue from the Location dropdown so the event can be placed on the map.
- Keep each Event ID unique and unchanged after publication so member RSVPs remain attached to the right event.
- The app refreshes the Sheet when it opens, when the tab becomes active, and every five minutes while online.
- A last-good local copy and a bundled copy of the verified Spring 2026 schedule keep the UI usable if Google Sheets is unavailable.

## Local Development

```bash
npm install
npm install --prefix functions
npm run dev
```

## Tests

```bash
npm test
npm run test:rules
```

The Firestore emulator requires Java 21 or newer.

## Deployment

The production app deploys to Firebase Hosting with `npm run deploy`. The default Firebase project is `florida-quantum-computing`. Cloud Functions run on Node.js 22 in `us-central1`.

The `OFFICER_UFID_PEPPER` Firebase Functions secret must match the local FQC keychain value used to generate spreadsheet fingerprints. Never commit or place that secret in Google Sheets.

GitHub Pages retains a small redirect so existing links under `outswarming.github.io/FQC/` continue to reach the Firebase-hosted app.
