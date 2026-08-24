# Florida Quantum Computing App

A responsive Firebase web app for Florida Quantum Computing with a unified events experience and secure member accounts:

- Members: one synchronized event list, calendar, and interactive map; RSVP tracking; light and dark themes; leaderboard; and profile progress.
- Settings: account editing, passkeys, officer management, explicit update checking, collapsed version history, and a destructive device reset hidden under Advanced settings.
- Officers: one event-centered operations workspace containing logistics, room and backup status, event notes, RSVPs, budget items, purchases, and live check-in controls.
- Officer resources: a secure Firebase endpoint returns the current FQC Drive library only to verified officers. The Profile screen places the signed-in officer's role guide and most relevant files first, with the complete document library in a responsive dropdown.
- President and Treasurer: protected leadership seats, officer demotion, and member removal from the Firebase-backed account directory in Settings.

## Authentication and access

- Email/password, Google, and Apple use Firebase Authentication. The login screen has separate Log In and Create Account tabs plus password reset.
- Members can register a device passkey and later sign in with Face ID, Touch ID, Windows Hello, or another WebAuthn authenticator.
- Every new account is created as a Member. Nothing entered during sign-up can grant a role, and there is no self-service path to officer access.
- Any officer can promote a member to Officer from the member directory. Only the President and Treasurer can demote an officer, remove an account, or link a leadership seat, and the President, Vice President, and Treasurer accounts are protected from all of it.
- Roles live in Firestore (`leadership` and `roleOverride`) and are mirrored into Firebase custom claims by Cloud Functions. Firestore rules make every `users` document read-only to clients, so no browser can write itself a role.
- The `Current Leadership` tab records who holds each seat and which account is linked to it. It is a record, not an authentication input: nothing in the sheet can grant access on its own.
- Role claims and attendance writes are enforced server-side and are never trusted from the browser.
- Real Google Drive file IDs are not embedded in the public web bundle. Officers receive direct Drive links only after Firebase verifies their officer claim; Google Drive permissions remain the final access control for every file.
- Firestore security rules keep profiles private, passkey credentials server-only, and check-in mutations restricted to Cloud Functions.

## Event Data Workflow

The organization-owned native Google Sheet [2026 Event Logistics](https://docs.google.com/spreadsheets/d/1xB4q--RsY7girF9JumjbUKKRu9lFQ8XHRlkCHttbgd0/edit) is the single source of truth for both the public app and its secure officer-role backend. It contains exactly four live workflow tabs:

- `Events`: the club's logistics schedule plus each event's planned budget, actual spend, remaining budget, funding source, event status, officer RSVPs, and notes.
- `Treasurer Breakdown`: itemized quantities, unit costs, planned and actual costs, purchase status, notes, and club funding totals.
- `UF Locations`: verified UF campus buildings and coordinates, ranked by historical event use.
- `Current Leadership`: current leadership titles, the account linked to each seat, and active flags. Read for display and written when a leadership seat is linked; it never grants access by itself.

Earlier FQC spreadsheets are retained only as archives and are not read by the app or Firebase backend.

- Every populated logistics row with a valid date, time, and event type appears in the app. Blank or campus-wide locations remain visible as “Location to be announced” on the UF campus map.
- Events remain in List and Calendar for 24 hours after their scheduled start, then move automatically into the newest-first `Past` archive.
- Use `Reitz`, `Larsen`, or `Marston` followed by the room number; the app maps the abbreviation to the correct UF building automatically.
- Event IDs are generated consistently from the meeting date and type so RSVPs stay attached to the right event.
- Verified officers can create events and edit each event's logistics, notes, status, and itemized budget from the app. Secure Cloud Functions write those changes directly to this workbook; spreadsheet edits return to the app on refresh and on the five-minute sync cycle.
- Dollar amounts remain itemized in `Treasurer Breakdown`. The `Events` totals are formulas, so app edits and direct Sheet edits use the same calculations instead of maintaining competing totals.
- RSVP membership is stored as one aggregate Firebase document to avoid one database read per club member. The officer RSVP summary is mirrored into the corresponding `Events` row.
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

The deployed Cloud Functions service account must remain an editor of `2026 Event Logistics`, and the Google Sheets API must be enabled for the Firebase project. All workbook writes are re-authorized server-side; the public app never receives edit credentials.

GitHub Pages retains a small redirect so existing links under `outswarming.github.io/FQC/` continue to reach the Firebase-hosted app.

## Role cutover (one time)

Officer status used to be recomputed on every login by hashing an eight-digit UFID and matching it against the `Current Leadership` tab, which meant a guessed hash inherited that seat's title. Roles now come from Firestore only.

The cutover needs no migration script. The old login path already wrote `leadership` into each user document, so President, Vice President, and Treasurer carry over untouched. Accounts that were officers *only* because of a UFID match have no stored `roleOverride`, so they resolve to Member the next time their profile is read.

To revoke those accounts immediately rather than waiting for their next sign-in, open the member directory as President or Treasurer and set each one to Member. `setMemberRole` rewrites their Firebase custom claims on the spot.

Afterwards, clear or delete column B of the `Current Leadership` tab. The stored hashes are no longer read, but they should not be left sitting in a shared sheet. Delete the `OFFICER_UFID_PEPPER` Functions secret once the new functions are deployed.

## Leadership seats

The `Current Leadership` tab stays the working record of who holds which post, and the app reads and writes it live.

- **Add a post:** add a row with the officer name and title, leave `Active` blank or `No`, and leave column B empty. It appears in Officer controls as a pending seat, and the President or Treasurer links an account to it.
- **Remove a post:** use **Open seat** in Officer controls. That clears column B, sets `Active` to `No`, and drops the holder to a plain officer, so the seat can be re-linked. Deleting the row by hand in the sheet removes the seat from the app but leaves the person's stored role alone, so open the seat first.
- The last President or Treasurer cannot be unseated; link a replacement first.
