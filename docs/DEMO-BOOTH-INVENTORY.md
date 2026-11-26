# Demo booth inventory for presentations

All booth and ticket amounts are displayed in PKR to match the Expo setup and payment reports. The booth floor plan supports these persisted states:

- **Available** (`available`): selectable by an exhibitor whose application for that Expo is approved.
- **Reserved — awaiting confirmation** (`reserved`): an approved exhibitor has selected the booth; an admin can confirm it.
- **Confirmed** (`occupied` in MongoDB, displayed as Confirmed): the organizer has confirmed the reservation.
- **Unavailable** (`blocked`): excluded from booking.

## Add sample inventory safely

The optional seeder adds eight **available** booths to each explicitly selected Expo, but only when that Expo currently has zero booths. It never updates or deletes existing booth inventory and does not create fake users, applications, reservations, or attendee data.

1. Back up the intended **demo** database.
2. From `backend`, set `MONGO_URI` to that demo database in `.env`.
3. Copy the selected Expo ObjectId(s) from Admin → Expos. Do not use production Expo IDs.
4. Run the command below in PowerShell (replace the example ID):

```powershell
$env:CONFIRM_DEMO_BOOTH_SEED="true"
$env:DEMO_BOOTH_EXPO_IDS="REPLACE_WITH_DEMO_EXPO_OBJECT_ID"
npm run seed:booths
Remove-Item Env:CONFIRM_DEMO_BOOTH_SEED
Remove-Item Env:DEMO_BOOTH_EXPO_IDS
```

For multiple demo expos, comma-separate the IDs. The command refuses to run unless both the explicit confirmation flag and Expo IDs are supplied. If an Expo already has even one booth, it is skipped so the existing inventory is preserved.

## Demonstrate every state using the real workflow

1. Log in as Admin and show the Expo's booth floor plan and the Available count.
2. Log in as an Exhibitor in a separate browser profile. Complete the company profile, apply to that Expo, and wait for Admin approval.
3. As the approved Exhibitor, reserve one available booth. It should display **Reserved — awaiting confirmation**.
4. As Admin, open Floor plan & booths, select that reserved booth, and choose **Confirm reservation**. It should display **Confirmed**.
5. Show the remaining available booths and the status counts in both roles.

This keeps the presentation data consistent with real approved applications and prevents fabricated booth ownership. The seeder only prepares available inventory; reservation and confirmation are deliberately performed through the application UI.
