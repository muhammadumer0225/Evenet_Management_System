
const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    expo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expo",
      default: null
    },

    attendee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    name: {
      type: String,
      trim: true,
      default: ""
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },

    type: {
      type: String,
      enum: ["suggestion", "issue", "question"],
      required: true
    },

    subject: {
      type: String,
      trim: true,
      required: true,
      maxlength: 150
    },

    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },

    comment: {
      type: String,
      trim: true,
      required: true,
      maxlength: 1000
    },

    note: {
      type: String,
      trim: true,
      default: ""
    },

    status: {
      type: String,
      enum: ["open", "in_progress", "resolved"],
      default: "open"
    }
  },
  {
    timestamps: true
  }
);

feedbackSchema.index({ attendee: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
