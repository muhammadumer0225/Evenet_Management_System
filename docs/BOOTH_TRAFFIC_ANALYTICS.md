# Booth Traffic & Attendee Engagement

EventSphere records a booth visit when an admin scans or manually enters an attendee's Expo ticket at a selected booth.

## Validation rules

- The booth must exist.
- The ticket/registration must belong to the same Expo as the selected booth.
- The registration must be active and its payment state must be `free` or `paid`.
- The attendee must already have completed the Expo-level check-in.
- A unique database index allows one recorded visit per attendee, booth, and Expo. Repeated scans return a conflict response and do not inflate counts.
- Visit records keep the Expo, booth, attendee, registration, staff account, timestamp, and whether the record came from QR scanning or manual entry.
- The write endpoint is restricted to authenticated admins.

## Analytics

The Admin Analytics page reports:

- Total recorded attendee-to-booth visits.
- Number of distinct Expo attendees who visited at least one booth.
- Top booths by unique visitors.
- Daily booth visits in the Expo's configured timezone.

The CSV and PDF exports include booth engagement metrics. These are verified scan-based engagement figures, not an automatic physical footfall counter. No historical visits are fabricated or backfilled.

## API

`POST /api/booths/:id/visits`

Body accepts either `ticketCode` or `registrationId`, plus an optional source (`ticket_scan` or `manual_entry`). Admin authentication is required.
