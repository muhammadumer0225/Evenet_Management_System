const mongoose = require("mongoose");

const adminActivitySchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorName: { type: String, required: true, trim: true, maxlength: 120 },
    action: {
      type: String,
      enum: ["expo_created", "expo_updated", "expo_deleted", "application_approved", "application_rejected", "booth_assigned"],
      required: true,
    },
    entityType: { type: String, enum: ["expo", "application", "booth"], required: true },
    entityId: { type: String, default: "", maxlength: 80 },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: "Expo", default: null },
    expoTitle: { type: String, default: "", trim: true, maxlength: 180 },
    description: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

adminActivitySchema.index({ createdAt: -1 });
adminActivitySchema.index({ expo: 1, createdAt: -1 });

module.exports = mongoose.model("AdminActivity", adminActivitySchema);
