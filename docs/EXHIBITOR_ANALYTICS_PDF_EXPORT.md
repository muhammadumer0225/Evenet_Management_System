# Exhibitor Booth Analytics PDF Export

The Exhibitor Dashboard → Booth analytics page includes **Export PDF**. The authenticated `GET /api/exhibitors/me/booth-analytics/report.pdf` endpoint creates a downloadable summary for the signed-in exhibitor only.

The report contains assigned booth count, total recorded visits, unique attendees, per-booth visit totals, and daily aggregate engagement in Asia/Karachi time. It contains no attendee names, emails, registration IDs, ticket codes, or attendee-level history.

The endpoint is protected by authentication and the `exhibitor` role and scopes its booth query to the authenticated user. PDF generation reuses the project's existing PDF utility.
