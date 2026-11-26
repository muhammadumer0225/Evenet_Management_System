# EventSphere user guide

## Sign in and account roles

Open the application at the frontend URL configured by the team. Register or sign in using the account flow presented by the application. Available roles in the backend are `admin`, `exhibitor` and `attendee`; the screens and actions shown depend on the authenticated role. Do not share passwords or reset links.

## Admin / organizer

1. Open the admin dashboard after signing in with an admin account.
2. Use Expo management to create or update event information.
3. Review exhibitor applications and record an approval/rejection decision where the interface provides that action.
4. Manage booths and the floor-plan view.
5. Manage speakers and sessions through schedule pages.
6. Review analytics, announcements, feedback and attendee/user views available in the dashboard. Use Dashboard > Attendee check-in to enter a registration ID/ticket code or scan the attendee QR pass.

Before publishing event details, verify the expo dates, venue, booth allocation and session times. Avoid assigning a booth already reserved by another exhibitor.

## Exhibitor

1. Sign in with an exhibitor account.
2. Complete the company profile and contact information.
3. Browse available expos and submit an application where enabled.
4. Check application status and booth allocation.
5. Use the messaging area to contact permitted users and the notifications bell to review updates.

Only upload documents and images that you are authorized to share. Follow the file type and size restrictions displayed by the application.

## Attendee

1. Sign in with an attendee account.
2. Browse expos and open an expo details page.
3. Review exhibitors, booths and the schedule.
4. Register for an Expo and choose Standard (free), Premium or VIP (simulated/demo payment for paid tiers). Find the pass under Dashboard > Expos & tickets.
5. Verify your own registration by entering the full registration ID or `ES-...` ticket code in the verification panel. Your pass displays a QR code and its ticket code.
6. Register for or bookmark sessions. Your selections appear in Dashboard > My agenda and remain after refresh.
7. Submit general feedback or link it to one of your active Expo registrations. Message permitted contacts using the emoji button; outgoing messages show sent/delivered/seen status where the recipient's connection state allows it.
8. Open the notification bell to view updates. Individual notifications can be opened, or all can be marked read.

## Messaging and notifications

The message inbox lists contacts/conversations allowed for the current role. A newly received message should appear in the open conversation in real time when the recipient is connected. A persistent notification is also stored and shown in the bell. The chat supports text and emoji, plus sent/delivered/seen status. Image, document and voice attachments are not part of this project version. Use “Mark all read” to clear the unread state for all notifications, or open an individual notification to mark it read.

If updates do not appear, check that both users are signed in, the backend is running, the browser has a valid access token, and the Socket.IO connection is established. Refreshing should reload persisted notifications from MongoDB.

## Troubleshooting

- **Cannot connect:** confirm MongoDB is running and `MONGO_URI` is correct; check `http://localhost:5000/api/health`.
- **Login fails:** verify the account exists and its role is correct; check backend terminal logs.
- **Email not received:** verify SMTP credentials and check spam; do not expose SMTP credentials in screenshots.
- **No real-time updates:** check browser console/network and backend Socket.IO logs; test in separate browser profiles because tabs in one profile share local storage.
- **Upload fails:** verify file type/size and that `backend/uploads` is writable.
