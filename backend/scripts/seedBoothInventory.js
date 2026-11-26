require("dotenv").config();
const mongoose = require("mongoose");
const Expo = require("../models/Expo");
const Booth = require("../models/Booth");

const confirm = process.env.CONFIRM_DEMO_BOOTH_SEED;
const expoIds = String(process.env.DEMO_BOOTH_EXPO_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const inventory = Array.from({ length: 8 }, (_, index) => {
  const row = Math.floor(index / 4);
  const col = index % 4;
  return {
    boothNumber: `A-${String(index + 1).padStart(2, "0")}`,
    zone: "Main Hall",
    size: index < 4 ? "10x10 ft" : "10x20 ft",
    price: index < 4 ? 45000 : 80000,
    status: "available",
    position: {
      x: 5 + col * 23,
      y: 12 + row * 45,
      width: 18,
      height: 28,
      rotation: 0,
    },
  };
});

async function main() {
  if (confirm !== "true") {
    throw new Error("Safety stop: set CONFIRM_DEMO_BOOTH_SEED=true to add sample booth inventory.");
  }
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Configure the intended demo database in backend/.env.");
  }
  if (!expoIds.length || expoIds.some((id) => !mongoose.isValidObjectId(id))) {
    throw new Error("Set DEMO_BOOTH_EXPO_IDS to a comma-separated list of valid Expo IDs. No Expo is selected by default.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  let created = 0;
  let skipped = 0;

  try {
    for (const expoId of expoIds) {
      const expo = await Expo.findById(expoId).select("title status").lean();
      if (!expo) {
        console.log(`SKIP ${expoId}: Expo not found.`);
        skipped += 1;
        continue;
      }

      const existingCount = await Booth.countDocuments({ expo: expoId });
      if (existingCount > 0) {
        console.log(`SKIP ${expo.title}: ${existingCount} booth(s) already exist; inventory left untouched.`);
        skipped += 1;
        continue;
      }

      await Booth.insertMany(inventory.map((booth) => ({ ...booth, expo: expoId })));
      console.log(`CREATED ${inventory.length} available booths for ${expo.title}.`);
      created += inventory.length;
    }
  } finally {
    await mongoose.disconnect();
  }

  console.log(`Finished. Created ${created} booth(s); skipped ${skipped} Expo(s). Existing inventory was never updated or deleted.`);
}

main().catch(async (error) => {
  console.error(error.message);
  if (mongoose.connection.readyState) await mongoose.disconnect();
  process.exitCode = 1;
});
