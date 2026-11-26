require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function main() {
  const { MONGO_URI, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
  if (!MONGO_URI) throw new Error("MONGO_URI is required in backend/.env");
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in backend/.env before running the seed.");
  }
  if (SEED_ADMIN_PASSWORD.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters long.");
  }

  await mongoose.connect(MONGO_URI);
  const email = SEED_ADMIN_EMAIL.trim().toLowerCase();
  const password = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        name: (SEED_ADMIN_NAME || "EventSphere Admin").trim(),
        email,
        password,
        role: "admin",
        status: "active",
      },
      $setOnInsert: { phone: "", company: "" },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  console.log(`Admin seed ready: ${user.email} (${user._id})`);
}

main()
  .catch((error) => {
    console.error("Admin seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
