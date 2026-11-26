# Backfill missing ticket codes safely

The admin check-in screen accepts either a MongoDB Registration ID or an `ES-XXXXXXXXXX` ticket code. Existing registrations without a ticket code can still be looked up by their Registration ID; the migration below adds ticket codes so their digital passes can also display a code and QR.

The migration is intentionally **dry-run by default**. It updates only `ExpoRegistration.ticketCode` values that are missing, null or empty. It does not update users, payments, session registrations, Expo counts, or any other fields.

1. Back up the MongoDB database first.
2. In the backend folder, run `npm run migrate:tickets` to preview how many registrations need a code. This does not write anything.
3. Only after reviewing the dry-run and confirming the backup, run `npm run migrate:tickets -- --apply`.
4. Reopen the affected attendee passes and verify that ticket codes/QR values now appear.

Do not run `npm run seed` or `npm run seed:demo` for this task. This migration does not need either seed script.
