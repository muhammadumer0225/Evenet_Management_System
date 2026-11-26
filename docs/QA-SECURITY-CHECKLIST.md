# QA and security checklist

Record each result as Pass/Fail/Not tested with date, tester and evidence. Do not mark an item Pass based only on the presence of a source file.

## Local smoke test

- [ ] `GET http://localhost:5000/api/health` returns HTTP 200 and `database: Connected`.
- [ ] Frontend loads at `http://localhost:5173` without console errors.
- [ ] Admin, exhibitor and attendee accounts can sign in and reach only their permitted pages.
- [ ] Invalid credentials return a safe error; protected API calls without a token return 401.
- [ ] A user cannot read or modify another user's private records by changing an ID.
- [ ] Expo create/update/delete and date validation work.
- [ ] Application submit, approve and reject flows work with correct role permissions.
- [ ] Booth reservation/assignment prevents two users reserving the same booth concurrently.
- [ ] Session create/update/delete and hall/speaker overlap rules work.
- [ ] Expo/session registration respects capacity and duplicate-registration rules.
- [ ] Back up the database, run `npm run migrate:tickets` once on an upgraded DB, and verify ticket codes and Expo registered counts are backfilled.
- [ ] Verify a user's own registration by registration ID and ticket code; another user's registration must not be exposed.
- [ ] Admin check-in works by registration ID, manual ticket code and QR camera scan where supported; unpaid/cancelled/wrong-Expo/already-checked-in tickets are rejected.
- [ ] Cancelling an Expo pass also cancels that attendee's session registrations; Premium/VIP demo-paid cancellations record 70% of paid price after the fixed 30% deduction. Checked-in passes cannot be cancelled.
- [ ] Approved exhibitor is the only role able to reserve a booth; an exhibitor cannot hold two booths for one expo; releasing a booth clears the application assignment.
- [ ] Message permissions are enforced; conversation history, emoji text, delivered/read timestamps and unread counts persist.
- [ ] Message notification appears live, persists after refresh, marks read and opens correct conversation; test with two browser profiles.
- [ ] Application decision, audience/Expo-targeted announcement and session update/cancellation notifications persist and appear live; mark one/all read.
- [ ] Session reminder endpoint creates one reminder per session within 24 hours and does not duplicate it on repeated calls.
- [ ] Feedback submission and admin review/update work.
- [ ] Analytics totals reconcile against source records; CSV/PDF export is tested where implemented.
- [ ] Image/document upload validates type and size and rejects unsafe files.

## Automated tests

- [ ] Run `npm test` in `backend` and save output.
- [ ] Add auth/RBAC, expo CRUD, booth race-condition, application approval, session conflict, analytics and notification integration tests.
- [ ] Add frontend tests for protected routes, forms, floor plan and notification UI.
- [ ] Add E2E flows for attendee registration/reminders, exhibitor application-to-booth, and live schedule updates.
- [ ] Generate coverage report and verify critical backend modules meet the brief's 70% target.

## Security review

- [ ] `JWT_SECRET` is long, random, unique per environment and never committed.
- [ ] Refresh token storage/transport is reviewed; prefer secure, httpOnly, sameSite cookies for production.
- [ ] Login, password reset, registration, uploads and other sensitive endpoints have appropriate rate limits.
- [ ] Helmet/security headers are configured.
- [ ] Validate all request bodies, params and query strings; sanitize MongoDB operators and untrusted HTML.
- [ ] CORS allows only known deployment origins.
- [ ] Passwords use bcrypt with an appropriate work factor; password policy is enforced server-side.
- [ ] Reset tokens are hashed, short-lived, single-use and do not reveal whether an email exists.
- [ ] Uploads enforce size/type limits, generate safe filenames and are stored outside executable paths.
- [ ] Logs do not contain passwords, JWTs, reset tokens, SMTP credentials or private message content.
- [ ] Role and ownership checks are enforced server-side for every private resource.
- [ ] Run `npm audit` in backend and frontend; review and document all high/critical findings.
- [ ] Perform an OWASP Top 10 review and a basic penetration test before public deployment.

## Reliability, privacy and performance

- [ ] Configure automated MongoDB backups with `scripts/installBackupTask.ps1` (Windows) and test restore instructions in a separate database.
- [ ] Implement graceful shutdown and structured application/request logging.
- [ ] Verify health endpoint and monitoring/alerting.
- [ ] Test responsive layouts on mobile and desktop; test Chrome, Firefox, Safari and Edge.
- [ ] Complete keyboard navigation, focus, labels, contrast and screen-reader checks (WCAG 2.1 AA target).
- [ ] Load-test representative APIs and document results for hundreds of concurrent users.
- [ ] Implement and test privacy consent, data export, account deletion/anonymisation and privacy/terms pages as required.
- [ ] Verify data retention and backup access controls.

## Release evidence

- [ ] Fresh clone setup succeeds on a clean Windows machine.
- [ ] `npm run dev`, `npm run seed`, `npm test` and frontend `npm run build` succeed.
- [ ] Demo data is available without exposing real credentials.
- [ ] User guide, developer guide, API contract, final report and demo script are current.
- [x] Android APK packaging is explicitly excluded from this delivery at the user's request.

## Additional checks for the expanded implementation

- [ ] Admin can list/search/filter database users, change roles, suspend/reactivate an account, and delete a user other than themselves.
- [ ] Last active admin cannot be demoted; self-role change is rejected.
- [ ] Suspended user cannot sign in, refresh a token, or continue using an existing access token.
- [ ] User deletion releases booth assignments and removes the linked registrations/messages/notifications/feedback/profile/applications.
- [ ] Admin can download all three CSV and PDF reports; verify row counts against MongoDB and open them in a spreadsheet/PDF reader.
- [ ] CSV cells containing commas, quotes, newlines and formula-like prefixes remain safe.
- [ ] Rate limit returns HTTP 429 after configured request threshold.
- [ ] CORS allows only configured frontend origins.
- [ ] Oversized, multiple, unsupported and MIME/extension-mismatched uploads are rejected.
- [ ] `npm run seed:demo` can be run twice without duplicate content; verify it does not create/update/delete any User account or modify passwords/roles.
- [ ] `npm run backup` creates a timestamped MongoDB dump; perform a restore test in a separate database.
- [ ] Docker Compose starts all services and data remains after container restart.

- [ ] Profile edits, email uniqueness, interest validation and consent changes persist to MongoDB and appear after re-login.
- [ ] Data export contains the user's stored records and never includes password hashes, refresh-token hashes or reset-token hashes.
- [ ] Password change rejects incorrect current password, revokes refresh token and requires sign-in again.
- [ ] Account deletion removes the user's linked data, disconnects their socket and transfers organizer-owned events to another active admin.

## Expo cover, venue, timezone and zone checks
- [ ] Create/edit an Expo with a JPG, PNG and WebP cover image (each under 5 MB); verify preview, replace, remove and persistence after refresh.
- [ ] Reject an unsupported extension, a spoofed image MIME/signature and files larger than 5 MB; verify invalid files are not retained in uploads.
- [ ] Confirm Expo cards and details display the saved cover image, full venue address, registration deadline, daily hours and timezone.
- [ ] Reject an invalid timezone, malformed daily hours, closing time not after opening, invalid registration deadline and deadline after Expo start.
- [ ] Create sessions at the opening/closing boundaries and outside the Expo daily hours; verify valid sessions save and invalid sessions are rejected in the Expo timezone.
- [ ] Create/edit booths in each zone; verify zone labels persist and booth positions map correctly to the 5x8 floor plan.

## Agenda and analytics exports
- [ ] Confirm My Agenda displays session dates/times in the Expo timezone, detects overlapping registered sessions and exports correct UTC calendar instants.
- [ ] Export the selected Expo analytics as CSV and PDF; verify the PDF route rejects non-admin users and the downloaded files open correctly.

## EventSphere AI assistant
- [ ] Confirm guest/attendee/exhibitor/admin answers follow the matching role guide and never reveal another role's controls.
- [ ] Confirm Roman Urdu questions receive natural Roman Urdu answers and instructions use the current page/button names.
- [ ] Confirm the assistant never invents live records, prices, assignments, payments, check-ins or actions.
- [ ] Confirm chat history survives refresh, is separated by account/role, and New conversation clears it.
- [ ] Trigger a failed reply and retry; verify the message is not duplicated in conversation history.
- [ ] Verify safe Markdown links open only HTTP(S) URLs in a new tab; plain text is never rendered as HTML.
- [ ] Verify status changes from Ready to Available after a successful provider response and Temporarily unavailable after a provider failure; confirm no API key/provider credential is returned.
- [ ] Verify AI message rate limit remains enabled and status polling uses its separate low-cost limiter.
- [ ] Verify Tab focus remains inside the open panel, Escape closes it, focus returns to launcher, and screen readers announce new messages/errors.
- [ ] Test tablet and small-mobile viewport with virtual keyboard, high-contrast mode and reduced-motion preferences.

## Exhibitor application email details
- [ ] Verify exhibitor application approval/rejection emails contain Expo dates, daily hours/timezone, full venue, booth assignment (or pending state), organizer remarks and accurate next steps.
