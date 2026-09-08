# FQC security review — 2.28.0

Reviewed the deployed 2.27.0 boundaries and the account, officer, passkey, RSVP, attendance, offline storage, and Sheets synchronization code. This is a targeted code review with regression tests, not a claim that the app is attack-proof. No confirmed critical unauthenticated account takeover was found.

## Findings and disposition

| Severity | Finding | Change / disposition |
| --- | --- | --- |
| High | Any ordinary officer could grant officer access to another account | Only the current President or Treasurer may grant or remove access; the server checks the current profile and ignores stale/forged role claims |
| High availability / medium privacy | Member RSVP responses disclosed other attendees, accepted invented event IDs, and shared one growing write document | Validate against the published event catalog, use per-member records, return only the caller's result and own RSVP list; preserve legacy RSVPs |
| Medium, potentially high with a captured valid assertion | Concurrent passkey requests could reuse a verified challenge | Transactional compare-and-consume permits one success; registration also checks credential ownership and account deletion |
| Medium | Demoted officers could retain cached screens and late private responses | Observe the member's server profile; clear officer data and reject late responses after account/access changes; offline mode exposes only the member view |
| Medium | Profile/username writes racing account deletion | Transactional deletion checks prevent a late write from recreating profile or username records |
| Medium | Shared-device RSVP state and transient attendance taps | Account-specific pending-action storage, retry backoff, explicit pending/error states, and server idempotency |
| Medium | Vulnerable transitive production dependencies | Updated qs to 6.16.0 and pinned compatible CommonJS uuid 11.1.1; no Firebase downgrade. Current production audits report zero known advisories |
| Medium defense in depth | Clickjacking exposure and overly broad public settings rule | Frame restrictions for the app, trusted-origin restriction on fallback routes while supporting Firebase auth frames; only settings/checkin stays publicly readable |
| Medium integrity | RSVP names could be interpreted as spreadsheet formulas | Deferred RSVP export writes RAW text, matching the existing formula-safe member export |

The uuid advisory affects v3/v5/v6 buffer handling; inspected callers use v4, so this was precautionary dependency hardening, not a demonstrated FQC exploit. See the [maintainer advisory](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq).

## Student flow and offline behavior

- No email verification or extra student signup screen added. UF email eligibility remains server-enforced, but an unverified address is not proof of identity and never grants leadership.
- RSVP and attendance taps are saved before sending, belong to one Firebase UID, and retry while the app is open, on reconnect, and on reopening. Explicit sign-out clears that account's local queue and member caches for shared-device privacy.
- The app says a tap is waiting to sync until the server confirms it. Permanent failures remain visible; failed RSVPs offer retry. GPS is removed after successful sync or a permanent rejection.
- Opening an active check-in preauthorizes a two-hour reconnect window. The permission is server-issued, bound to that member and event, and preserves the location requirement. Expired late attendance needs officer confirmation. Retrying an already accepted check-in after closing succeeds without another point.
- The offline permission proves eligibility during an open check-in, not when a person tapped or their physical presence. Client GPS remains spoofable. This is appropriate for club attendance, not exams or financial access.
- Only the public app shell/build files are cached by the service worker. The small member cache contains a display name and their own attendance IDs; no officer documents, membership directory, or account API responses enter the service-worker cache. Firebase Auth retains its normal sign-in persistence.
- Closed mobile web apps cannot reliably poll indefinitely. Reopening resumes retries; clearing browser data loses unsynced taps. First-time signup still requires a connection.
- Members, attendance, and officer RSVP names continue to sync to Sheets on the existing ten-minute schedule. Member taps do not wait for a Sheets write.

## Abuse limits and cost

Ten-minute callable allowances: 2,400 login/recovery requests per IP; 30 per IP plus login identifier; 24,000 other requests per IP; 1,200 authenticated requests per UID within each login/app group. Sixteen bounded IP shards avoid a shared-Wi-Fi bottleneck and can reject slightly early near capacity. App Check and function instance limits remain enabled. Expiring counters store hashes, counts, and expiry instead of raw IPs.

Firebase's [100 new accounts/hour/IP](https://firebase.google.com/docs/auth/limits) is useful, but it does not stop distributed attackers. Accepting some signup abuse is a reasonable club tradeoff; it is not a guarantee against cost abuse or denial of service. Emulator burst timings do not increase Firebase's production quota.

## Highest-value remaining work

1. **High operational priority: offboarding across systems.** App demotion removes app privileges. It cannot remove separate Drive sharing, Firebase/Google Cloud IAM, or GitHub collaborator access. Review those when someone leaves. “Open seat” intentionally keeps ordinary officer access; change that person's club role to Member as well when they leave the team.
2. **High value: MFA for project owners and club managers.** Protect administrator recovery and deployment accounts first. No need to make every student wait for email verification. Owner MFA status was not verified or changed in this review. Confirm a person’s identity in person before granting a leadership account; a typed UF address alone is not identity verification.
3. **Medium: monitoring and recovery.** Billing alerts, unusual-error alerts, and a tested backup/restore process are worthwhile. Budgets are alerts, not a guaranteed spending cap. Account deletion cannot erase an export someone already downloaded.
4. **Medium: stricter script CSP and sensitive-action reauthentication.** A script allowlist/reporting rollout and fresh sign-in for high-impact manager changes are useful next layers. Do this with Firebase/reCAPTCHA/passkey compatibility tests; no demonstrated script injection was found here.
5. **Lower value for this club: strict GPS anti-spoofing, blanket student MFA, or aggressive signup throttling.** These add friction without matching the current attendance/privacy risk.

## Validation

- 39 backend and 11 Firestore rules tests passed against real Auth/Firestore emulators, including 70 concurrent signups and attendance requests, 70 concurrent RSVPs, 10,000 queued member exports, forged/stale roles, expired and cross-account offline permissions, and simultaneous passkey replay
- 11 session/outbox tests passed: account recreation, UID isolation, reload persistence, latest RSVP intent, retry/backoff, and storage failure
- 99 browser checks passed across mobile Chromium, desktop, and compact desktop, including offline reconnection, demotion, signup, settings, and officer management
- Live 2.28.0 App Check exchanges returned 200 in both phone browser engines; incorrect passwords, unauthenticated private RSVPs, and unauthenticated offline permissions returned 401
- Live private-sheet feed returned 400; anonymous workbook export remained 401; app framing restrictions were present and the Firebase auth iframe remained available
- The offline permission expiry policy was verified ACTIVE
- Production build passed; client and server production dependency audits reported zero known advisories
- Built-app first-install offline reopening passed in Android-style Chromium and iPhone WebKit after cutting the network transport

The 70-account emulator burst took about 3.8 seconds; attendance and retry checks took about 0.48 seconds and made zero Sheets requests. These are correctness/contention measurements, not a production latency promise.

Deployed to Firebase Hosting and Cloud Functions on September 8, 2026. Live app: [FQC 2.28.0](https://flqcs.com/?release=2.28.0).
