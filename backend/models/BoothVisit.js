const mongoose = require("mongoose");

const boothVisitSchema = new mongoose.Schema(
  {
    expo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expo",
      required: true,
      index: true,
    },
    booth: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booth",
      required: true,
    },
    attendee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpoRegistration",
      required: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    visitedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    source: {
      type: String,
      enum: ["ticket_scan", "manual_entry"],
      default: "ticket_scan",
    },
  },
  { timestamps: true }
);

// One unique visitor per booth per Expo; repeated scans cannot inflate traffic.
boothVisitSchema.index({ expo: 1, booth: 1, attendee: 1 }, { unique: true });
boothVisitSchema.index({ expo: 1, visitedAt: 1 });
boothVisitSchema.index({ booth: 1, visitedAt: -1 });

module.exports = mongoose.model("BoothVisit", boothVisitSchema);
