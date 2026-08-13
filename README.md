# Florida Quantum Computing App

A responsive Firebase web app for Florida Quantum Computing with a unified events experience and secure member accounts:

- Members: one synchronized event list, calendar, and interactive map; RSVP tracking; light and dark themes; leaderboard; and profile progress.
- Settings: explicit update checking, an in-app version history, and a destructive device reset hidden under Advanced settings.
- Officers: live event check-in controls and an officer-specific profile workspace.
- President and Treasurer: protected ordinary-officer promotion and removal from the Firebase-backed account directory.

## Authentication and access

- Email/password, Google, and Apple use Firebase Authentication. The login screen has separate Log In and Create Account tabs plus password reset.
- Members can register a device passkey and later sign in with Face ID, Touch ID, Windows Hello, or another WebAuthn authenticator.
- Email accounts enter an eight-digit UFID during account creation; new social accounts enter it immediately afterward. The raw UFID is HMAC-hashed inside a Cloud Function and is never stored in the browser, Firestore, logs, or the website-readable spreadsheet.
- The `Current Leadership` tab in the events workbook contains only HMAC fingerprints, active flags, and officer titles. Firebase refreshes it on a five-minute cache cycle. A match receives the listed title; no match becomes a Member.
- Any officer can recommend a member. Only the President and Treasurer can complete promotions or remove ordinary officers, and their own leadership roles are protected.
- Role claims and attendance writes are enforced server-side and are never trusted from the browser.
- Firestore security rules keep profiles private, passkey credentials server-only, and check-in mutations restricted to Cloud Functions.

## Event Data Workflow

The organization-owned native Google Sheet [2026 Event Logistics](https://docs.google.com/spreadsheets/d/1xB4q--RsY7girF9JumjbUKKRu9lFQ8XHRlkCHttbgd0/edit) is the single source of truth for both the public app and its secure officer-role backend. It contains exactly four live workflow tabs:

- `Events`: the club's logistics schedule plus each event's planned budget, actual spend, remaining budget, funding source, and status.
- `Treasurer Breakdown`: itemized quantities, unit costs, planned and actual costs, purchase status, notes, and club funding totals.
- `UF Locations`: verified UF campus buildings and coordinates, ranked by historical event use.
- `Current Leadership`: current leadership titles and secure UFID fingerprints used by Firebase role verification.

Earlier FQC spreadsheets are retained only as archives and are not read by the app or Firebase backend.

- Every populated logistics row with a valid date, time, and event type appears in the app. Blank or campus-wide locations remain visible as “Location to be announced” on the UF campus map.
- Use `Reitz`, `Larsen`, or `Marston` followed by the room number; the app maps the abbreviation to the correct UF building automatically.
- Event IDs are generated consistently from the meeting date and type so RSVPs stay attached to the right event.
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
