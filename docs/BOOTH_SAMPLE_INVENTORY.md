# Booth sample inventory (manual, no database changes)

Use this example when creating a realistic booth layout for a single Expo through **Admin > Booth Management**. This file is a reference only; it does not create records or run a seed operation.

| Booth | Zone | Size | Example price (PKR) | Intended state | Stored booth status |
|---|---|---:|---:|---|---|
| A-01 | Zone 1 · Premier | 10x10 ft | 45,000 | Available | `available` |
| A-02 | Zone 1 · Premier | 10x20 ft | 80,000 | Reserved by an approved exhibitor | `reserved` |
| A-03 | Zone 2 · Standard | 10x10 ft | 30,000 | Confirmed by organizer | `occupied` |
| A-04 | Zone 2 · Standard | 10x10 ft | 30,000 | Available | `available` |
| A-05 | Zone 3 · Startup | 8x8 ft | 15,000 | Unavailable / blocked | `blocked` |
| A-06 | Zone 3 · Startup | 8x8 ft | 15,000 | Available | `available` |
| B-01 | Zone 2 · Standard | 10x20 ft | 55,000 | Reserved by an approved exhibitor | `reserved` |
| B-02 | Zone 1 · Premier | 10x10 ft | 45,000 | Available | `available` |

## Status mapping

The database currently stores four booth states:

- **Available** → `available`
- **Reserved** → `reserved` (an exhibitor has reserved the booth and is awaiting organizer confirmation)
- **Confirmed** → `occupied` (the organizer has confirmed the allocation)
- **Unavailable** → `blocked`

Create booths only in the intended Expo. Use the exhibitor portal to reserve a booth and the admin booth-management page to confirm or block it. For the reserved and confirmed examples, use real approved applications and their exhibitors; do not assign a booth to an arbitrary account.

No sample records are inserted by this document. Existing registrations, accounts, applications and booth records remain untouched.
