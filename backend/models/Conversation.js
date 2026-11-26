const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  userA: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userB: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

conversationSchema.index({ userA: 1, userB: 1 }, { unique: true });
conversationSchema.index({ userA: 1, hiddenFor: 1 });
conversationSchema.index({ userB: 1, hiddenFor: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
