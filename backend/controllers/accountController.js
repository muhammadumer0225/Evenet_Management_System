const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Expo = require("../models/Expo");
const Booth = require("../models/Booth");
const Application = require("../models/Application");
const ExhibitorProfile = require("../models/ExhibitorProfile");
const ExpoRegistration = require("../models/ExpoRegistration");
const SessionRegistration = require("../models/SessionRegistration");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const Notification = require("../models/Notification");
const Feedback = require("../models/Feedback");
const Announcement = require("../models/Announcement");
const Speaker = require("../models/Speaker");
const Session = require("../models/Session");

const decrementRegistrationCounts = async (attendeeId) => {
  const groups = await ExpoRegistration.aggregate([
    { $match: { attendee: new mongoose.Types.ObjectId(attendeeId), status: "registered" } },
    { $group: { _id: "$expo", count: { $sum: 1 } } },
  ]);
  await Promise.all(groups.map(({ _id, count }) => Expo.updateOne({ _id }, { $inc: { registeredCount: -count } })));
};

const exportMyData = async (req, res) => {
  try {
    const id = req.user.id;
    const [profile, exhibitorProfile, booths, applications, expoRegistrations, sessionRegistrations, messages, notifications, feedback, organizedExpos, createdSessions, createdSpeakers, createdAnnouncements] = await Promise.all([
      User.findById(id).select("name email role phone company bio profileImage interests consent status createdAt updatedAt").lean(),
      ExhibitorProfile.findOne({ user: id }).lean(),
      Booth.find({ exhibitor: id }).populate("expo", "title startDate endDate").lean(),
      Application.find({ exhibitor: id }).populate("expo", "title startDate endDate").lean(),
      ExpoRegistration.find({ attendee: id }).populate("expo", "title startDate endDate").lean(),
      SessionRegistration.find({ attendee: id }).populate({ path: "session", select: "title startTime endTime room expo", populate: { path: "expo", select: "title" } }).lean(),
      Message.find({ $or: [{ from: id }, { to: id }] }).select("from to text kind meta read createdAt updatedAt").lean(),
      Notification.find({ recipient: id }).select("type title message sender link isRead readAt createdAt").lean(),
      Feedback.find({ attendee: id }).lean(),
      Expo.find({ organizer: id }).lean(),
      Session.find({ createdBy: id }).lean(),
      Speaker.find({ createdBy: id }).lean(),
      Announcement.find({ createdBy: id }).lean(),
    ]);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="eventsphere-account-${id}.json"`);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ exportedAt: new Date().toISOString(), profile, exhibitorProfile, booths, applications, expoRegistrations, sessionRegistrations, messages, notifications, feedback, organizedExpos, createdSessions, createdSpeakers, createdAnnouncements });
  } catch (error) {
    console.error("Account data export failed:", error);
    return res.status(500).json({ success: false, message: "Unable to export account data" });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const allowed = ["name", "email", "phone", "company", "bio", "interests", "consent"];
    const updates = {};
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    if (updates.name !== undefined && (typeof updates.name !== "string" || !updates.name.trim())) return res.status(400).json({ success: false, message: "Name is required" });
    if (updates.email !== undefined) {
      if (typeof updates.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email.trim())) return res.status(400).json({ success: false, message: "Please enter a valid email address" });
      updates.email = updates.email.trim().toLowerCase();
      const existing = await User.findOne({ email: updates.email, _id: { $ne: req.user.id } }).select("_id");
      if (existing) return res.status(409).json({ success: false, message: "That email address is already in use" });
    }
    if (updates.name) updates.name = updates.name.trim();
    if (updates.phone !== undefined) updates.phone = String(updates.phone).trim();
    if (updates.company !== undefined) updates.company = String(updates.company).trim();
    if (updates.bio !== undefined) updates.bio = String(updates.bio).trim().slice(0, 1000);
    if (updates.interests !== undefined && (!Array.isArray(updates.interests) || updates.interests.length > 30 || updates.interests.some((x) => typeof x !== "string"))) return res.status(400).json({ success: false, message: "Interests must be a list of text values" });
    if (updates.consent !== undefined) {
      const allowedConsent = ["directory", "analytics", "marketing"];
      if (!updates.consent || typeof updates.consent !== "object" || Array.isArray(updates.consent) || Object.entries(updates.consent).some(([key, value]) => !allowedConsent.includes(key) || typeof value !== "boolean")) {
        return res.status(400).json({ success: false, message: "Consent preferences must contain supported boolean values" });
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { returnDocument: "after", runValidators: true }).select("name email role phone company bio profileImage interests consent status createdAt");
    if (!user) return res.status(404).json({ success: false, message: "Account not found" });
    return res.json({ success: true, user });
  } catch (error) {
    console.error("Profile update failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update profile" });
  }
};

const changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") return res.status(400).json({ success: false, message: "Current and new passwords are required" });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Account not found" });
    if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ success: false, message: "Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 12);
    user.refreshTokenHash = null;
    user.refreshTokenExpiresAt = null;
    await user.save();
    return res.json({ success: true, message: "Password changed. Please sign in again." });
  } catch (error) {
    console.error("Password change failed:", error);
    return res.status(500).json({ success: false, message: "Unable to change password" });
  }
};

const deleteMyAccount = async (req, res) => {
  try {
    const id = req.user.id;
    const user = await User.findById(id).select("_id role");
    if (!user) return res.status(404).json({ success: false, message: "Account not found" });
    let replacementAdmin = null;
    if (user.role === "admin") {
      replacementAdmin = await User.findOne({ role: "admin", status: "active", _id: { $ne: id } }).select("_id");
      if (!replacementAdmin) return res.status(409).json({ success: false, message: "Create another active admin before deleting this organizer account" });
    }
    const ownerId = replacementAdmin?._id;
    await decrementRegistrationCounts(id);
    const operations = [
      Booth.updateMany({ exhibitor: id }, { $set: { exhibitor: null, status: "available", showcase: null } }),
      Application.deleteMany({ exhibitor: id }),
      ExhibitorProfile.deleteOne({ user: id }),
      ExpoRegistration.deleteMany({ attendee: id }),
      SessionRegistration.deleteMany({ attendee: id }),
      Message.deleteMany({ $or: [{ from: id }, { to: id }] }),
      Conversation.deleteMany({ $or: [{ userA: id }, { userB: id }] }),
      Notification.deleteMany({ recipient: id }),
      Notification.updateMany({ sender: id }, { $set: { sender: null } }),
      Feedback.deleteMany({ attendee: id }),
    ];
    if (ownerId) {
      operations.push(
        Expo.updateMany({ organizer: id }, { $set: { organizer: ownerId } }),
        Session.updateMany({ createdBy: id }, { $set: { createdBy: ownerId } }),
        Announcement.updateMany({ createdBy: id }, { $set: { createdBy: ownerId } }),
        Speaker.updateMany({ createdBy: id }, { $set: { createdBy: ownerId } }),
        Application.updateMany({ reviewedBy: id }, { $set: { reviewedBy: ownerId } }),
        ExpoRegistration.updateMany({ checkedInBy: id }, { $set: { checkedInBy: ownerId } }),
      );
    } else {
      const createdSpeakers = await Speaker.find({ createdBy: id }).select("_id").lean();
      const speakerIds = createdSpeakers.map((speaker) => speaker._id);
      operations.push(
        ...(speakerIds.length ? [Session.updateMany({ speakers: { $in: speakerIds } }, { $pull: { speakers: { $in: speakerIds } } })] : []),
        Announcement.deleteMany({ createdBy: id }),
        Speaker.deleteMany({ createdBy: id }),
      );
    }
    await Promise.all(operations);
    await User.deleteOne({ _id: id });
    req.app.get("io")?.in(`user:${id}`).disconnectSockets(true);
    return res.json({ success: true, message: "Account and linked personal data deleted" });
  } catch (error) {
    console.error("Account deletion failed:", error);
    return res.status(500).json({ success: false, message: "Unable to delete account" });
  }
};

module.exports = { exportMyData, updateMyProfile, changeMyPassword, deleteMyAccount };
