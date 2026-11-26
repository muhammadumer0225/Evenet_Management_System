# Exhibitor Booth Analytics

Exhibitors can open **Dashboard → Booth analytics** to review engagement for booths assigned to their own account.

The authenticated `GET /api/exhibitors/me/booth-analytics` endpoint scopes its booth lookup to `req.user.id` and returns aggregate metrics only:

- Total verified booth visits across the exhibitor's assigned booths.
- Unique attendees across those booths (deduplicated across the exhibitor's entire portfolio).
- Per-booth recorded visits and unique visitors.
- Daily recorded visits and unique visitors, grouped in Asia/Karachi time.

No attendee names, email addresses, ticket codes, registration IDs, or attendee-level visit history are exposed. The page refreshes when the existing Expo realtime update signal is received.

These are scan-recorded engagement metrics, not an automatic physical people counter. Admins record a visit only after validating the attendee's active Expo registration and prior Expo check-in.
