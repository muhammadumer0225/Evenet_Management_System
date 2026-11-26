# EventSphere demo video script (target 8–12 minutes)

## Preparation

- Start MongoDB, backend and frontend; verify `/api/health` reports Connected.
- Prepare separate admin, exhibitor and attendee accounts in separate browser profiles.
- Use sample expo data only. Hide `.env`, passwords, tokens, private email inboxes and personal data from the recording.

## Recording sequence

1. **Introduction (30 sec):** Explain that EventSphere is a MERN-based expo management platform for organizers, exhibitors and attendees.
2. **Authentication (60 sec):** Demonstrate sign-in and role-specific navigation. Show forgot/reset password only with a disposable test mailbox.
3. **Admin expo management (90 sec):** Create or edit an expo and show key event details.
4. **Exhibitor workflow (90 sec):** Open exhibitor profile, browse expos, submit an application and show its status.
5. **Booths/floor plan (60 sec):** Show Available, Reserved (awaiting confirmation), Confirmed and Unavailable statuses, the status counters, and the exhibitor reserve → admin confirm workflow. Use the optional safe demo inventory seeder only on a disposable demo database.
6. **Schedule and attendee (90 sec):** Show sessions, schedule browsing, attendee registration/bookmark/ticket views where enabled.
7. **Messaging and notifications (90 sec):** In two separate browser profiles, send a message and demonstrate live message arrival, notification bell count, persistence after refresh, mark-read and conversation navigation.
8. **Analytics and feedback (60 sec):** Show available dashboard charts/reports and submit/review feedback.
9. **Closing (30 sec):** Summarize implemented workflows and disclose any features still marked pending in the requirements status document.

## Evidence to capture

- Successful `/api/health` response.
- API/role denial example for unauthorized access.
- Message + notification live flow in two profiles.
- Build and test command outputs.
- Any known limitation clearly shown in the final report rather than hidden.


## Generated presentation video

`EventSphere_Submission_Walkthrough.mp4` is a narrated, illustrative feature overview. It is not a screen recording of a live deployment. Record a separate live browser walkthrough after connecting the submission database and testing the role accounts.
