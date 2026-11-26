# Developer guide

## Architecture

- `backend/`: Express API, Mongoose models, controllers, routes, middleware, mail configuration and Socket.IO server.
- `frontend/`: React 18 + Vite application, route/page components, contexts, API service module, socket helper and CSS.
- MongoDB stores users, expos, booths, applications, sessions, registrations, messages, notifications, feedback and related records.
- `frontend/src/lib/api.js` is the API boundary; `hydrateAppData()` loads server records into `frontend/src/lib/store.js`, which is only a reactive UI cache. Production mode does not initialize bundled demo records.

## Local development

Use the root README's Windows setup steps. The Vite server runs on port 5173 and proxies `/api` to the backend at port 5000. Backend configuration is loaded from `backend/.env`.

## Backend conventions

- Models live in `backend/models`.
- Controllers live in `backend/controllers`.
- Route declarations live in `backend/routes` and are mounted in `backend/server.js`.
- Protected endpoints use `authMiddleware`; role-restricted endpoints additionally use `roleMiddleware`.
- Add request validation and ownership checks to every new endpoint. Never trust a user ID supplied in a request body when the authenticated identity is available as `req.user.id`.

## Socket.IO

The backend verifies the JWT in `socket.handshake.auth.token`. Authenticated sockets join `user:<id>`. Use the same room convention when emitting user-private events. Do not broadcast private message content to a public room. Frontend socket connection lifecycle is managed by `frontend/src/lib/socket.js` and the auth context. `backend/services/sessionReminderScheduler.js` scans every five minutes and persists one reminder per attendee/session using a unique notification key.

## Database changes

Update the relevant Mongoose model, controller, route, API client and UI together. Add indexes for frequently filtered/sorted fields. For reservation-like operations, use an atomic update or transaction to prevent concurrent double allocation. Avoid destructive migrations without a backup.

## Adding tests

Backend tests use Node's built-in test runner (`node:test`) and assertions. Run `npm test` from `backend`. Add model validation tests for schema constraints and integration tests for authenticated endpoints once a disposable test database is configured. Never run destructive tests against production data.

## Seed data and backups

Run `npm run seed:demo` from `backend` to insert missing sample Expos, Speakers, Booths and Sessions. It requires an existing admin account for ownership references and never writes to the User collection. It does not need `SEED_DEMO_PASSWORD`, and it does not create demo users, applications, or attendee registrations. The separate `npm run seed` command invokes `scripts/seedAdmin.js` and can create/update an admin account; do not run it unless you explicitly intend that account operation.

Install MongoDB Database Tools and run `npm run backup`. The Windows Task Scheduler installer is `scripts/installBackupTask.ps1`. Restore with `$env:RESTORE_CONFIRM="YES"; npm run restore -- "C:\path\to\backup-folder"` only after verifying the target database; restore is destructive. After deploying the ticket-code schema change to an existing DB, run `npm run migrate:tickets` once.

## Pull request workflow

Work on the assigned feature branch, pull latest `main`, keep `.env`, node_modules, uploads containing private files and local database dumps out of commits. Each PR should include a summary, changed routes/components, test commands and screenshots/API evidence. Do not push directly to `main`.

## Production-readiness verification still required

Review `REQUIREMENTS-STATUS.md` and `QA-SECURITY-CHECKLIST.md`. Run the app against a disposable MongoDB database, verify SMTP and Socket.IO with separate accounts, run the frontend production build, expand controller/E2E coverage to the brief's target, complete accessibility/performance checks, and perform a backup restore drill. Configure HTTPS, protected secrets and offsite backups before public deployment.
