# Firebase onboarding and ten-minute member export

Release 2.19.0, September 7, 2026.

Firebase Authentication owns email/password credentials and recovery. Existing accounts, optional usernames, and passkeys continue working. New members need only their UF email and a password; there is no username reservation, Sheet lookup, or officer approval in signup. A callable initializes the private Firestore profile idempotently. Retrying setup cannot overwrite attendance or roles. Ordinary repeat logins do not rewrite the member profile or maintain a login timestamp.

Attendance is saved immediately in a Firestore transaction, with one check-in document per event/member and one point per event. The transaction validates that check-in is open, the profile exists, and the configured location requirement is met. Duplicate requests do not award points again. Signup and attendance atomically queue the member for export. A retrying Firestore trigger covers profile edits, role changes, deletions, and older app versions. The trigger only writes a queue marker; it never calls Sheets.

One scheduled job runs every **10 minutes**. It reads changed member IDs, fetches current authoritative profiles, and writes up to 250 members in each Sheets batch (up to 10,000 queue records per run). It coalesces changes per member instead of downloading all accounts each time. An empty queue makes no Sheets requests. A resumable initial migration adds 250 existing members per run, including members who have never checked in. New changes are immediately queued independently of this migration.

Exports use the existing Master Members tab: stable opaque member key, display name, role, points, last check-in, and event attendance. Credentials, passkeys, and email addresses are not added to this shared workbook. Firebase remains the source of truth. Leadership-seat assignment and event/treasury editing still use their existing Sheet workflows.

The worker reads the entire member-key column, so rows beyond 1,000 are supported. Stable row assignments and RAW values prevent duplicate appends on retries and prevent member names becoming formulas. Deletions clear exported member data and attendance while retaining the opaque row key. A lease prevents overlapping exports. Queue records are acknowledged only when the exact version exported is still current; a change arriving during an export remains queued. Failed batches remain queued, and the officer workspace reports the retry state. Old attendance queue records are accepted during migration. The next ten-minute run retries failures; a Sheets outage can delay export but cannot undo a saved check-in.

## Cost and capacity

Costs track active changes rather than registered membership. Member records are independent, attendance history in profiles is bounded to 250 event IDs, the leaderboard is one compact top-100 snapshot, and functions have no reserved warm instances. This release adds one trigger invocation per relevant profile change, plus small Firestore queue writes/reads/deletes. It avoids shared-counter contention, full-directory reads during signup, and per-member Sheets requests.

A run with 10,000 changed members uses 40 Sheets value batches plus a small number of workbook/schema requests. A typical 70-person meeting fits in one value batch. This is within Sheets' published per-user limit of 60 writes/minute when the workbook is otherwise quiet; quota errors remain retryable. See [Sheets quotas](https://developers.google.com/workspace/sheets/api/limits). Total cloud cost also depends on hosting traffic, function execution, database location, and other app usage; this is not a fixed-price or zero-cost guarantee. See [Firestore billing](https://firebase.google.com/docs/firestore/pricing) and [scheduled function pricing](https://firebase.google.com/docs/functions/schedule-functions).

Firebase's default account-creation limit is **100 new accounts per hour per public IP**. Seventy people in ten minutes fits that limit only if the shared network has sufficient quota left. For a larger campus-network rush, schedule a temporary increase in Firebase Authentication before the event. See [Firebase Auth limits](https://firebase.google.com/docs/auth/limits). The app does not bypass this protection.

## Validation

- Real Firebase Auth and Firestore emulators: 70 concurrent email signups and profile initializations in 3.742 seconds; check-ins, duplicate retries, and profile reloads in 0.329 seconds, with no Sheets requests and exactly 70 attendance records.
- A Sheets failure preserved all queued work. Changes arriving during export were retained and exported on retry. Removed members were represented as deletions, and could not check in without a profile.
- 10,000 synthetic profiles exported through 40 bounded batches; the real row planner verified row 10,002, stable retries, formula-like names, and deletion cleanup.
- Signup passed in iPhone SE, iPhone 13, large iPhone, landscape iPhone, and Pixel browser emulation. Live attendance updates did not erase entered credentials.

Emulator timings do not measure production cold starts, actual Sheets latency, campus Wi-Fi, or physical phones. No synthetic accounts were created in production.
