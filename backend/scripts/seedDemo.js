require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Expo = require("../models/Expo");
const Booth = require("../models/Booth");
const Session = require("../models/Session");
const Speaker = require("../models/Speaker");

const daysFromNow = (days) => {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

/**
 * Seeds reusable EventSphere content only.
 * IMPORTANT: This script intentionally never writes to the User collection.
 * It requires an existing admin account for required ownership references.
 */
async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");

  await mongoose.connect(process.env.MONGO_URI);

  const admin = await User.findOne({ role: "admin" }).select("_id").lean();
  if (!admin) {
    throw new Error(
      "No existing admin account found. Create/sign in with your own admin account first; this seed will never create or modify users."
    );
  }

  const expoDefinitions = [
    { title: "Pakistan FutureTech & AI Summit 2027", category: "Technology", offset: 45 },
    { title: "Green Energy & Climate Solutions Expo 2027", category: "Sustainability", offset: 90 },
    { title: "Pakistan HealthTech & Medical Innovation Forum 2027", category: "Healthcare", offset: 135 },
  ];

  const expos = [];
  for (const item of expoDefinitions) {
    const startDate = daysFromNow(item.offset);
    const endDate = daysFromNow(item.offset + 2);
    const titleSlug = item.title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const expo = await Expo.findOneAndUpdate(
      { title: item.title },
      {
        $setOnInsert: {
          title: item.title,
          slug: titleSlug,
          description: `A three-day showcase of ${item.category.toLowerCase()} ideas, products and expert sessions.`,
          category: item.category,
          theme: item.category,
          startDate,
          endDate,
          location: {
            venue: "Karachi Expo Centre",
            address: "University Road",
            city: "Karachi",
            country: "Pakistan",
          },
          status: "published",
          organizer: admin._id,
          capacity: 500,
          registeredCount: 0,
          ticketPrice: 0,
          currency: "PKR",
          registrationDeadline: daysFromNow(item.offset - 5),
          floorPlan: { width: 1000, height: 700, backgroundImage: "" },
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    expos.push(expo);
  }

  const speakerDefinitions = [
    ["Dr. Ayesha Khan", "AI Research Lead", "Applied AI and responsible machine learning"],
    ["Hamza Siddiqui", "Clean Energy Strategist", "Renewable energy and climate innovation"],
    ["Dr. Sara Ahmed", "Digital Health Specialist", "Healthcare technology and patient experience"],
    ["Bilal Hussain", "Technology Entrepreneur", "Building scalable technology businesses"],
    ["Mariam Raza", "Innovation Consultant", "Product design and innovation strategy"],
  ];

  const speakers = [];
  for (const [name, designation, bio] of speakerDefinitions) {
    const speaker = await Speaker.findOneAndUpdate(
      { name },
      {
        $setOnInsert: {
          name,
          email: "",
          bio,
          designation,
          company: "EventSphere Guest Speaker",
          createdBy: admin._id,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    speakers.push(speaker);
  }

  let boothCount = 0;
  let sessionCount = 0;
  for (let e = 0; e < expos.length; e++) {
    const expo = expos[e];

    for (let b = 1; b <= 15; b++) {
      const boothNumber = `${String.fromCharCode(65 + Math.floor((b - 1) / 5))}-${String(b).padStart(2, "0")}`;
      await Booth.findOneAndUpdate(
        { expo: expo._id, boothNumber },
        {
          $setOnInsert: {
            expo: expo._id,
            boothNumber,
            zone: b <= 5 ? "Zone 1 · Premier" : b <= 10 ? "Zone 2 · Standard" : "Zone 3 · Startup",
            size: b % 3 === 0 ? "6x3" : "3x3",
            price: b % 3 === 0 ? 85000 : 50000,
            status: "available",
            exhibitor: null,
            showcase: {
              tagline: "Discover innovative solutions",
              offer: "Meet the team and explore product demonstrations",
              hours: "09:00 – 18:00",
              products: [],
              staff: [],
            },
            position: {
              x: ((b - 1) % 5) * 12.5,
              y: Math.floor((b - 1) / 5) * 20,
              width: 10,
              height: 15,
              rotation: 0,
            },
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      boothCount++;
    }

    for (let s = 1; s <= 5; s++) {
      const startTime = new Date(expo.startDate.getTime() + (4 + (s - 1) * 1.5) * 3600000);
      const endTime = new Date(startTime.getTime() + 60 * 60000);
      await Session.findOneAndUpdate(
        { expo: expo._id, title: `${expo.category} Spotlight ${s}` },
        {
          $setOnInsert: {
            expo: expo._id,
            title: `${expo.category} Spotlight ${s}`,
            description: `A practical ${expo.category.toLowerCase()} session with demonstrations, expert insights and audience questions.`,
            category: expo.category,
            speakers: [speakers[(s - 1 + e) % speakers.length]._id],
            room: `Hall ${s}`,
            startTime,
            endTime,
            capacity: 100,
            status: "published",
            createdBy: admin._id,
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      sessionCount++;
    }
  }

  console.log("EventSphere content seed completed (idempotent; insert-only for existing sample records).");
  console.log(`Existing admin used for ownership: ${admin._id}`);
  console.log(`Expos: ${expos.length}; speakers: ${speakers.length}; booths: ${boothCount}; sessions: ${sessionCount}`);
  console.log("User accounts, roles, passwords and profile records were not created, updated or deleted.");
}

main()
  .catch((error) => {
    console.error("Content seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
