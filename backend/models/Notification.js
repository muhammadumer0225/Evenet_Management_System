
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "application_approved",
        "application_rejected",
        "new_application",
        "new_announcement",
        "feedback_update",
        "new_message",
        "session_reminder",
        "session_update",
        "session_cancelled"
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null,
    },

sender: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},

link: {
  type: String,
  default: null,
},

key: {
  type: String,
  default: null,
  trim: true,
},

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Notification listing index
notificationSchema.index({
  recipient: 1,
  isRead: 1,
  createdAt: -1,
});

// Idempotency for scheduled/event notifications; ordinary notifications have no key.
notificationSchema.index(
  { recipient: 1, key: 1 },
  { unique: true, partialFilterExpression: { key: { $type: "string" } } }
);

const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

module.exports = Notification;
