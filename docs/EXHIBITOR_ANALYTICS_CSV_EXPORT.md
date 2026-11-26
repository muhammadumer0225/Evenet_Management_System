# Exhibitor Booth Analytics CSV Export

The Exhibitor Dashboard's Booth analytics page includes an **Export CSV** action.

The downloaded `eventsphere-my-booth-analytics.csv` contains:

- A summary row with total recorded visits and unique attendees.
- One row per booth assigned to the signed-in exhibitor, including Expo, booth number, status, visits, and unique visitors.
- Daily aggregate visit and unique visitor counts.

The export uses UTF-8 with BOM and CRLF line endings for spreadsheet compatibility. CSV fields are quoted, embedded quotes are escaped, and formula-like text values are neutralized to reduce spreadsheet formula-injection risk.

No attendee names, email addresses, registration IDs, or ticket codes are included. The source analytics API remains authenticated and exhibitor-role restricted, and scopes results to the signed-in exhibitor's assigned booths.
