# EventSphere bug-fix implementation summary

## Implemented

- Admin attendee check-in now accepts a valid Registration ID, a valid `ES-XXXXXXXXXX` ticket code, and a Mongo ObjectId sent by a legacy client in the ticket-code field.
- The ticket-code migration is dry-run by default and updates only missing `ExpoRegistration.ticketCode` values when explicitly invoked with `--apply`.
- Signup/signin responses now include persisted profile fields, including phone and bio. Profile updates normalize the returned user before storing it in the browser session.
- The chatbot has a deterministic attendee Expo-registration answer and keeps failed messages in the composer so the user can edit/retry while the service is unavailable. Existing authentication and rate-limit middleware were not changed.
- The QR scanner uses `jsQR` as a compatibility decoder when the native `BarcodeDetector` is missing or fails. Camera permission, secure-context, retry and manual-entry messages are clearer.
- Booth visitor check-in now explains the required Expo check-in → choose Expo/booth → enter registration ID/ticket code → record visit workflow.
- Exhibitor dashboard loads its applications, booth analytics, published Expos, company profile and unread-message count from backend APIs rather than relying on the local demo store.
- My Applications has a details modal with status, submission date, Expo details, booth assignment, organizer remarks and submitted document names.
- Neighbours loads the exhibitor's real booths and nearby booth occupants from the backend; adjacency now uses actual booth rectangles (including width/height) rather than fixed row/column buckets, and contact sharing waits for the message API result before showing success.
- Company profile tagline and LinkedIn fields are now stored in MongoDB and included in public exhibitor profile data; failed profile loads can be retried in place.
- Booth analytics explains how overall and per-day unique attendee counts differ and shows daily unique attendees alongside daily visits. Announcements, Messages and Notifications now expose in-page retry/refresh states instead of requiring a browser reload.
- Added a manual booth sample-inventory reference. No sample records were inserted.

## Ticket-code migration (optional database write)

1. Back up MongoDB.
2. Run `cd backend && npm run migrate:tickets` for a dry run.
3. Only after reviewing the count and confirming the backup, run `npm run migrate:tickets -- --apply`.

This migration changes only missing ticket-code fields on Expo registrations. It is not run automatically by the app or this package.

## Verification performed in the supplied project snapshot

- Backend tests: 90 passed, 0 failed, 2 skipped because Mongoose dependencies were not installed in this isolated workspace (92 total).
- Frontend tests: 63 passed, 0 failed in the latest local run; includes booth-neighbour geometry and exhibitor-page retry coverage.
- JavaScript/JSX syntax parsing: all 36 frontend JSX files passed a TypeScript parser check; backend JavaScript syntax checks passed. Vite production build remains pending because frontend dependencies are not installed in this isolated workspace.
- The Vite production build could not be run in this isolated workspace because frontend dependencies are not installed and the package registry is unavailable. Install frontend dependencies in the local project before running `npm run build`.

## Manual verification still required

- Run the ticket-code migration only after a MongoDB backup, then test one existing registration by ID and by its new ticket code.
- Test camera scanning on the target Chrome laptop using `https://` or `localhost` and allow camera permission.
- Test chatbot retry with the configured AI provider and simulate an outage.
- Manually test the exhibitor pages against the live database and confirm booth-neighbour positioning on the actual Expo floor plan.

## Additional implementation batch — 2026-11-25

- Added deterministic EventSphere introduction and Admin Dashboard, Expo creation and User Management answers. These common help questions no longer depend on an external AI provider returning non-empty text. Existing chatbot authentication, role checks and rate limits remain in place.
- Added profile-picture upload to Account Settings for all authenticated roles. JPG, PNG and WebP are accepted up to 5 MB; server-side file-signature checks reject spoofed MIME types. The saved image path is persisted on the User record and used by shared avatars. Replacing a previous local upload attempts to remove the old file. Existing account fields are preserved.
- Added message-level `hiddenFor` state and a Conversation collection so message deletion can be scoped to the current user while retaining empty conversations. Added Delete for Me, sender-only Delete for Everyone, Clear All Messages (current user's view only), and Delete Selected Chat (current user's conversation list only). Existing messages remain visible to the other participant when deleted/cleared only for the current user. User deletion also removes associated Conversation records.
- Replaced the message list's page-level `scrollIntoView` with scrolling inside the conversation panel; Enter submission explicitly prevents default browser behavior.
- Redesigned admin and recipient announcement cards with clearer audience labels, published/announcement markers, dates, spacing and responsive card layouts. The current data model has no Draft status, so this update does not invent a Draft workflow.
- Added server-side error logging and validation/duplicate-key handling for feedback submission. This improves diagnosis of the previously observed HTTP 500; the original live database failure has not been reproduced in this isolated workspace, so its exact root cause remains unconfirmed pending local retest.
- Replaced deprecated Mongoose `new: true` query options in controllers/services with `returnDocument: "after"` where applicable.

### Verification for this batch

- Backend: 104 passed, 0 failed, 2 skipped (106 total).
- Frontend unit tests: 83 passed, 0 failed.
- Modified frontend JSX files passed TypeScript JSX transpile/syntax checks; modified backend files passed `node --check`.
- Vite production build was not run: frontend dependencies are absent in this isolated workspace and `npm ci` could not complete because the package registry/cache was unavailable.
- Live MongoDB, image upload, two-account Socket.IO deletion behavior, feedback submission and browser UI acceptance remain to be tested in the user's local environment. No seed, migration, reset, or database write was run during this work.
