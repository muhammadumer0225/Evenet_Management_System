# Exhibitor Booth Analytics Date Filters

Exhibitors can filter their assigned-booth engagement by an optional start and end date. The same selected range is applied to the dashboard API and PDF export; CSV uses the already-filtered dashboard dataset.

- Query parameters: `from` and `to`, each in `YYYY-MM-DD` format.
- Boundaries are interpreted in Pakistan Standard Time (`UTC+05:00`). The start is inclusive and the end date is inclusive (implemented as an exclusive next-day upper bound).
- Invalid dates and a start date later than the end date return HTTP 400.
- Booth ownership scope and aggregate-only response are unchanged. No attendee personal data is exported.
- Clearing the filter restores all-time analytics.
