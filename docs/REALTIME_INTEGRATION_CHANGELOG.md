# Real-time Integration Update — 2026-11-24

- Added validated per-Expo Socket.IO rooms alongside the global refresh room.
- Added client subscribe/unsubscribe handling and reconnect-safe subscriptions in `useExpoRealtimeVersion`.
- Added real-time refresh subscriptions to Admin booth/session operations, Admin announcements/check-in lists, Exhibitor Expo discovery, and Exhibitor booth booking.
- Kept Socket.IO JWT authentication and the lightweight refresh-only event payload.
- Added regression coverage for scoped rooms, subscription validation, reconnect handling, and page subscriptions.

Verification: backend test suite 82 passed, 2 skipped, 0 failed; frontend unit suite 55 passed, 0 failed. Backend syntax checks passed for the modified server and realtime service. No production build, live MongoDB test, or multi-browser Socket.IO test was run.
