# EventSphere Management — Frontend (React)

Complete responsive frontend for the **MERN EventSphere Management** eProject (expo / trade-show management).

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build -> dist/
```

## Demo accounts
| Role | Email | Password |
|---|---|---|
| Organizer (admin) | admin@eventsphere.com | admin123 |
| Exhibitor | exhibitor@demo.com | demo123 |
| Attendee | attendee@demo.com | demo123 |

Organizer registration needs invitation code `EVENTSPHERE-ORG`.

## What is included (maps to the project document)
- **Auth**: register with role (organizer / exhibitor / attendee), login, forgot + reset password, password strength, hashed passwords, GDPR-style consent.
- **Organizer dashboard**: expo CRUD, exhibitor applications (approve / reject, assign booth), floor-plan booth allocation, schedule with clash detection, analytics + CSV reports (live visitor counter), users, feedback inbox.
- **Exhibitor portal**: apply with documents, profile/logo, interactive booth selection, booth showcase (products, staff, offers), neighbours + contact exchange, messaging.
- **Attendee interface**: expo registration with digital pass (QR), exhibitor search/filter, schedule browse, bookmark/register sessions, reminders, calendar export, appointments/chat.
- **General**: real-time updates (cross-tab sync + live notifications), feedback/support, help centre, privacy page, light/dark theme, accessible (keyboard, ARIA, reduced motion), responsive.

## Backend integration
There is no backend in this package: `src/lib/store.js` + `src/lib/api.js` emulate MongoDB/Express using `localStorage`.
Every exported function in `api.js` maps to one REST endpoint (e.g. `login` → `POST /api/auth/login`, `saveExpo` → `POST/PUT /api/expos`).
Replace those function bodies with `axios` calls and the UI stays unchanged. Use Socket.IO to replace the cross-tab sync for real-time updates.
The QR on passes is a visual placeholder; generate real codes server-side.
