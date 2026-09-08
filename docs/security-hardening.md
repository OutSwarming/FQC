# Security hardening — 2.27.0

This change addresses public workbook exposure, stale officer privileges, username-to-email disclosure, and automated callable abuse. Email verification is outside this release.

## Data boundaries

Events and UF locations are served through `/api/public-events`. The server reads only two fixed ranges and emits an explicit column allowlist. It excludes budgets, notes, attendance, member identities and leadership records. Responses are cached for five minutes; simultaneous cold requests share one fetch. Arbitrary sheet names are rejected before a Sheets request. The browser no longer downloads treasury data, and clears its older event/budget caches.

The Google logistics workbook must remain Restricted, with named collaborators and the existing backend service-account editor retained. Public event access does not require sharing the workbook. App officer demotion does not remove separately granted Google Drive collaborator access; those are distinct permission systems.

## Current access and login

Every authenticated callable checks the Firebase Auth account is active, the session is newer than token revocation, and no deletion marker exists. Officer and manager operations then read the current server-owned profile. Stale token claims cannot restore a removed role. Firestore rules likewise read current role fields and reject deleted-account markers.

The old username lookup never returns an email. Username/password login verifies the password through Firebase Authentication on the server, then returns only a custom sign-in token. Unknown usernames and incorrect passwords return the same error. Password reset returns a uniform acknowledgement. Passwords and identity-provider response tokens are not logged or stored by the application.

## Abuse controls and retention

Production callables and direct Firestore client requests enforce Firebase App Check using a domain-restricted reCAPTCHA Enterprise provider. App Check is an abuse signal, not a substitute for authentication or role checks. Direct Firebase email/password authentication retains Firebase's own limits.

Atomic Firestore counters enforce ten-minute request limits: 240 sign-in/recovery requests per IP, 12 per IP/identifier, and 240 authenticated requests per user. Other callable traffic has an IP allowance of 1,800 requests. IP counters use 16 bounded shards to avoid serializing a meeting's shared Wi-Fi; near the allowance, a full shard may reject slightly early. Stored keys are hashes; records contain only counts and expiry. TTL policies clean request counters, expired passkey challenges and abandoned username reservations. TTL cleanup is asynchronous; enforcement itself checks time windows and challenge/reservation expiry.

## Regression checks

- 34 backend tests and 10 Firestore rules tests passed with real Auth/Firestore emulators
- 70 concurrent signups and profile setup: 3.8 seconds; attendance plus duplicate retries/profile checks: 0.47 seconds, with exactly 70 check-ins and no Sheets requests
- 10,000 queued members exported in 40 batches
- 69 browser checks across mobile, compact desktop and desktop passed
- Live public feed: 21 events and 11 locations; member sheet requests return 400
- Anonymous workbook member, leadership and treasury CSV exports, full XLSX export and published HTML return 401 after sharing restriction
- Live App Check exchange succeeds in Android-style Chromium and iPhone WebKit; invalid credentials receive the generic login error
- Requests without App Check receive 401 from protected callables and 403 from direct Firestore reads
- Six session-recovery tests include retaining a valid login when app attestation fails

These emulator timings validate correctness and contention handling, not production latency or Firebase Auth quota increases. Existing account data is unchanged. Old loaded pages need a refresh to use the App Check-enabled client.
