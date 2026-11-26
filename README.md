# EventSphere Management

MERN event/expo management application. This repository contains a React 18 + Vite frontend and an Express/Mongoose backend with JWT authentication, role middleware, expo/booth/session/application APIs, messaging, notifications, feedback, announcements and analytics endpoints.

> **Status note:** This README documents the code currently present in this delivery. It is not a claim that every requirement in the original project brief has passed acceptance testing. See [`docs/REQUIREMENTS-STATUS.md`](docs/REQUIREMENTS-STATUS.md) for implemented, unverified and outstanding items.

## Requirements

- Windows 10/11 (or another OS with Node support)
- Node.js 20 LTS or newer
- npm
- MongoDB local instance or MongoDB Atlas database

## Setup (Windows PowerShell)

1. Extract the project folder.
2. Create a file named `backend/.env`. The current ZIP does not yet contain a `backend/.env.example`; a template is planned as a separate documentation task. Add the required settings shown below. Do not put real credentials in source control.

```dotenv
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/EventSphere
JWT_SECRET=replace_with_a_long_random_secret
FRONTEND_URL=http://localhost:5173

# Optional: required only for email features such as password reset
EMAIL_USER=
EMAIL_PASS=

# Optional: required for organizer registration when that flow is used
ORGANIZER_CODE=

# Optional: configure the AI chatbot (provider: gemini or openrouter)
AI_PROVIDER=gemini
AI_API_KEY=
AI_MODEL=
```

3. Install and start the backend:

```powershell
cd backend
npm install
npm run dev
```

4. Open a second terminal and start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

5. Open `http://localhost:5173`. The Vite development server proxies `/api` requests to `http://localhost:5000`.

## Payment flow

Standard Expo tickets are free. Premium and VIP tickets use the project's clearly labelled simulated demo-payment flow; no real JazzCash/Easypaisa gateway is connected or required. The payment API only exposes the authenticated attendee demo-completion route. Historical gateway values remain in the database schema so older records are not invalidated.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `MONGODB_DNS_SERVERS` | Optional comma-separated DNS resolvers for MongoDB Atlas SRV lookups (defaults to `8.8.8.8,8.8.4.4` when using `mongodb+srv://`) |
| `JWT_SECRET` | JWT signing secret; use a unique random value |
| `EMAIL_USER` | SMTP sender account |
| `EMAIL_PASS` | SMTP app password / credential |
| `FRONTEND_URL` | Exact frontend origin used for email links and REST/Socket.IO CORS. For multiple origins, separate them with commas. |
| `ORGANIZER_CODE` | Invitation code required by organizer registration flow, if enabled |
| `BACKUP_DIR`, `BACKUP_RETENTION_DAYS` | Backup destination and retention period |
| `MONGODUMP_BIN`, `MONGORESTORE_BIN` | Optional custom MongoDB Database Tools executable paths |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | Optional AI chatbot provider configuration (`gemini` or `openrouter`); key and model are required to enable chatbot responses |
| `AI_TIMEOUT_MS`, `AI_MAX_TOKENS` | Optional AI request timeout and response token limit |
| `CHATBOT_MAX_HISTORY`, `CHATBOT_MAX_MESSAGE_CHARS` | Optional chatbot conversation-history and message-length limits |
| `CHATBOT_RATE_LIMIT`, `CHATBOT_RATE_WINDOW_MS` | Optional chatbot rate-limit configuration |

Never commit `.env`, real passwords, reset tokens, or production credentials.

## Useful commands

From `backend`:

```powershell
npm run dev       # development server with nodemon
npm start         # production-style Node start
npm run seed      # create/update the configured initial admin account
npm run seed:demo # add sample expos/booths/sessions; never creates or changes users
npm run migrate:tickets # backfill ticket codes, session-registration types and expo registration counters in an existing database
npm run backup    # create a timestamped mongodump
$env:RESTORE_CONFIRM="YES"; npm run restore -- "C:\path\to\backup-folder" # destructive restore
npm test          # backend unit tests
```

From `frontend`:

```powershell
npm run dev
npm run build
npm run preview
npm run test:unit
```

## Content seed safety

`npm run seed:demo` requires an admin account that already exists in MongoDB. It only inserts missing sample Expos, Speakers, Booths and Sessions. It does not create, update, delete, or change the password/role of any User account, and it does not require `SEED_DEMO_PASSWORD`. Existing sample records are left unchanged on subsequent runs. The separate `npm run seed` command runs `scripts/seedAdmin.js`; do not run it unless you explicitly intend to create/update the configured admin account.

## Main backend route groups

- `/api/auth`
- `/api/expos`
- `/api/booths`
- `/api/exhibitors` (public directory + private profile)
- `/api` (applications)
- `/api/notifications`
- `/api/speakers`
- `/api/sessions`
- `/api/expo-registrations`
- `/api/session-registrations`
- `/api/attendees`
- `/api/analytics`
- `/api/announcements`
- `/api/feedback`
- `/api/messages`
- `/api/health`

For the route-level inventory and current auth expectations, see [`docs/API-REFERENCE.md`](docs/API-REFERENCE.md). The API is currently mounted under `/api`; it is not `/api/v1`.

## Real-time messaging and notifications

Socket.IO authenticates the connection using the access token in `socket.handshake.auth.token` and joins the authenticated user to `user:<id>`. A sent message is persisted, a `new_message` notification is persisted, then `new-message` and `new-notification` are emitted to the recipient's room. The notification bell loads persisted notifications, listens for `new-notification`, marks individual notifications read, and supports mark-all-read. Application decisions, audience-targeted announcements, session schedule changes/cancellations and upcoming-session reminders also create persistent in-app notifications. The backend reminder scheduler scans every five minutes for sessions starting within 24 hours; reminders are deduplicated per attendee/session.

Test with two different accounts in separate browser profiles (not just two tabs sharing localStorage):

1. Sign in as account A in one profile and account B in another.
2. Send a message from A to B.
3. Verify B sees the message and unread notification count without refreshing.
4. Refresh B and verify the notification remains.
5. Open the notification and verify it navigates to the conversation and marks it read.

## Admin floor-plan editor

The Admin Dashboard > Floor plan & booths page supports drag-and-drop booth positioning, corner-handle resizing, canvas pan, zoom and reset. Booth geometry is saved in the existing `Booth.position` fields and broadcast through the existing Expo-scoped real-time update flow. Public Expo and exhibitor floor plans render saved coordinates, while older booths without saved coordinates retain the grid fallback. See [Admin Floor Plan Editor](docs/ADMIN-FLOOR-PLAN-EDITOR.md) for controls and release checks.

## Documentation

- [Admin floor-plan editor](docs/ADMIN-FLOOR-PLAN-EDITOR.md)
- [Requirements status and gaps](docs/REQUIREMENTS-STATUS.md)
- [User guide](docs/USER-GUIDE.md)
- [Developer guide](docs/DEVELOPER-GUIDE.md)
- [API reference](docs/API-REFERENCE.md)
- [QA and security checklist](docs/QA-SECURITY-CHECKLIST.md)
- [Demo video script](docs/DEMO-VIDEO-SCRIPT.md)
- [Demo booth inventory setup](docs/DEMO-BOOTH-INVENTORY.md)
- [Submission video narration](docs/SUBMISSION-VIDEO-NARRATION.md)
- [Final report outline](docs/FINAL-REPORT-OUTLINE.md)
- [OpenAPI starter specification](docs/openapi.yaml)

## Important release caveats

This code bundle has not been connected to your personal MongoDB/SMTP accounts in this environment. Do not treat successful source packaging or syntax checks as proof of production readiness. Run the local setup and the QA checklist, then address every item marked pending before submission/deployment.

## Current implementation update

This source update connects session management, attendee session registration/bookmarks, attendee registration verification, admin check-in, ticket QR passes, persistent notifications and messaging status to the MongoDB-backed APIs. The admin can check in an attendee by registration ID or ticket code, or use the browser QR scanner where supported. Attendees can verify their own registration from Dashboard > Expos & tickets. Premium/VIP demo-paid cancellation records a 70% refund after the fixed 30% deduction; this is a simulated project record, not a real payment transfer.

Before using an existing database, run the ticket/session migration once from `backend`:

```powershell
npm run migrate:tickets
```

This backfills missing ticket codes, sets legacy session registration types to `register`, and recalculates Expo registered counts. Back up your database before running migrations.

## Admin operations added in this delivery

- User administration: `GET /api/admin/users`, `PATCH /api/admin/users/:id/status`, `PATCH /api/admin/users/:id/role`, and `DELETE /api/admin/users/:id` (admin token required). Suspended accounts cannot sign in, refresh tokens, or use authenticated API routes. Deleting a user also removes linked registrations, messages, notifications, feedback, exhibitor profile/applications and releases their booth allocations.
- CSV reports (admin token required): `GET /api/analytics/export/expos`, `/registrations`, and `/exhibitors`; add `?format=pdf` for PDF (CSV is the default).
- API hardening: configurable CORS origins (`FRONTEND_URL`, comma-separated), JSON body limits, general API rate limiting, browser security headers, and a common error response.
- Image upload: one file per request, 5 MB maximum, supported image MIME/extension pairing, generated server-side filenames.

## Demo database data

Run `npm run seed:demo` from `backend` after confirming that your own admin account already exists. It inserts missing sample content only: 3 Expos, 5 Speakers, 45 Booths and 15 Sessions. It never creates, updates, deletes or changes any User account, role or password. Existing sample records are left unchanged on repeated runs. No demo password or demo account is required.

## MongoDB backup and restore

Install MongoDB Database Tools (`mongodump` and `mongorestore`) and ensure they are on PATH. Run `npm run backup` from `backend`; the script creates a timestamped dump under `backups/` and prunes backups older than `BACKUP_RETENTION_DAYS` (default 14). To schedule a daily Windows task at 2 AM, run `powershell -ExecutionPolicy Bypass -File .\scripts\installBackupTask.ps1` from `backend`. Verify the task runs under an account that can read `backend/.env` and access MongoDB.

Restore is destructive. Test only against a separate database first: run `$env:RESTORE_CONFIRM="YES"; npm run restore -- "C:\path\to\backup-folder"` from PowerShell. Copy backups to protected off-device storage and verify restore regularly.

## Docker deployment

Create `backend/.env` using the settings described in the Setup section, set a unique `JWT_SECRET` and any required SMTP settings, then run `docker compose up --build`. The app is served at `http://localhost:8080`; MongoDB data is persisted in the `eventsphere-mongo` volume. MongoDB is bound to host loopback only for local backup tooling. This compose setup is a local deployment baseline; for production, enable MongoDB authentication, TLS/reverse proxy, secure secrets, persistent upload storage, offsite backups and a restricted network before exposing it publicly.


## Account privacy endpoints

Authenticated users can manage their profile and consent through `PATCH /api/account/profile`, change their password through `PATCH /api/account/password`, download a JSON archive through `GET /api/account/export`, and request account deletion through `DELETE /api/account`. Password changes revoke refresh tokens and the UI signs the user out. Deleting an organizer requires another active admin so required event ownership can be transferred.

## Mobile scope

Android APK packaging is intentionally excluded from this delivery as requested. The web application and its non-mobile requirements are the focus.

## Known remaining work / verification limits

The source update has been checked statically and with unit tests, but it has **not** been connected to the user's live MongoDB, SMTP or AI provider in this environment. Before using an existing database, take a backup; run `npm run migrate:tickets` from `backend` only if the ticket migration has not already been applied.

Verification performed for the current submission package:
- Backend automated tests: 101 passed, 0 failed, 2 skipped (the two model tests require installed Mongoose dependencies).
- Frontend unit tests: 83 passed, 0 failed.
- Backend coverage: 87.49% lines, 79.55% branches, 89.39% functions.
- Backend JavaScript and frontend `.js` syntax checks pass; package manifests and lockfiles are valid JSON.
- ZIP integrity and MP4 audio/video decoding are checked before delivery.
- Vite production build could not run because `npm ci` timed out in this workspace and React/Vite dependencies were unavailable. On Windows, run `npm ci` and `npm run build`.

Still requiring local acceptance testing: MongoDB migration and persistence; Expo registration, demo payment, cancellation/refund totals and counters; attendee registration verification; admin manual/QR check-in; session create/register/bookmark/cancel and reminders; two-account Socket.IO message delivery/read receipts; announcement audience targeting; SMTP password reset; AI provider responses; feedback workflow; booth showcase/unavailable/reservation concurrency; Expo form focus behavior; and backup/restore. Do not treat source checks as production certification.

The `presentation/` folder contains a narrated illustrative feature walkthrough, subtitles and narration. It is not live browser footage; record a separate live walkthrough against the configured demo database for final evidence. For sample booth inventory, follow [Demo booth inventory setup](docs/DEMO-BOOTH-INVENTORY.md); the opt-in script only inserts available booths into explicitly selected empty demo Expos and never alters existing inventory.

Android APK packaging is intentionally out of scope. Remaining release verification (not APK work) is the live MongoDB/SMTP integration run, frontend production build, full controller/API/E2E test coverage (including the original 70% target), accessibility/performance review, and an actual backup restore drill.


### Docker deployment origin

The Docker Compose default is `http://localhost:8080` for local use. When deploying on a public domain, set `FRONTEND_URL` to the exact browser origin before starting Compose, for example `FRONTEND_URL=https://events.example.com`. This value is used by password-reset links and REST/Socket.IO CORS. Do not include a trailing slash or a path.


### Atlas DNS note

For `mongodb+srv://` connections, the backend configures Google Public DNS (`8.8.8.8,8.8.4.4`) by default to work around local DNS forwarders that refuse SRV queries. Set `MONGODB_DNS_SERVERS` in `backend/.env` to a comma-separated resolver list if your network requires different DNS servers. This setting affects DNS lookups made by the backend process.
