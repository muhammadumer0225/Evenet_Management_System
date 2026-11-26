require("dotenv").config();
const mongoose = require("mongoose");
const ExpoRegistration = require("../models/ExpoRegistration");
const { createTicketCode } = require("../utils/ticketCode");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);

  const missing = await ExpoRegistration.find({
    $or: [
      { ticketCode: { $exists: false } },
      { ticketCode: null },
      { ticketCode: "" },
    ],
  }).select("_id").lean();

  const apply = process.argv.includes("--apply");
  if (!apply) {
    console.log(`Dry run only. Found ${missing.length} registration(s) without a ticket code. No database records were changed.`);
    console.log("After taking a database backup, run: npm run migrate:tickets -- --apply");
    return;
  }

  let updated = 0;
  for (const registration of missing) {
    let ticketCode;
    do {
      ticketCode = createTicketCode();
    } while (await ExpoRegistration.exists({ ticketCode }));

    const result = await ExpoRegistration.updateOne(
      {
        _id: registration._id,
        $or: [
          { ticketCode: { $exists: false } },
          { ticketCode: null },
          { ticketCode: "" },
        ],
      },
      { $set: { ticketCode } },
    );
    updated += result.modifiedCount;
  }

  console.log(`Ticket-code migration complete. Added ${updated} ticket code(s). No other collections or registration fields were changed.`);
}

main()
  .catch((error) => {
    console.error("Ticket-code migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
