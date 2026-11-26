const mongoose = require("mongoose");
const User = require("../models/User");
const Booth = require("../models/Booth");
const Application = require("../models/Application");
const ExhibitorProfile = require("../models/ExhibitorProfile");
const ExpoRegistration = require("../models/ExpoRegistration");
const SessionRegistration = require("../models/SessionRegistration");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const Feedback = require("../models/Feedback");
const Announcement = require("../models/Announcement");
const Speaker = require("../models/Speaker");
const Session = require("../models/Session");
const Expo = require("../models/Expo");
const Conversation = require("../models/Conversation");

const decrementRegistrationCounts = async (attendeeId) => {
  const groups = await ExpoRegistration.aggregate([
    { $match: { attendee: new mongoose.Types.ObjectId(attendeeId), status: "registered" } },
    { $group: { _id: "$expo", count: { $sum: 1 } } },
  ]);
  await Promise.all(groups.map(({ _id, count }) => Expo.updateOne({ _id }, { $inc: { registeredCount: -count } })));
};

const listUsers = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const filter = {};
    if (["admin", "exhibitor", "attendee"].includes(req.query.role)) filter.role = req.query.role;
    if (["active", "suspended"].includes(req.query.status)) filter.status = req.query.status;
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ name: { $regex: escaped, $options: "i" } }, { email: { $regex: escaped, $options: "i" } }, { company: { $regex: escaped, $options: "i" } }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).select("name email role company profileImage status createdAt").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    return res.json({ success: true, users, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Admin list users failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load users" });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid user ID" });
    if (!["active", "suspended"].includes(status)) return res.status(400).json({ success: false, message: "Status must be active or suspended" });
    if (String(req.user.id) === id) return res.status(400).json({ success: false, message: "You cannot suspend your own account" });
    const user = await User.findByIdAndUpdate(id, { $set: { status, refreshTokenHash: null, refreshTokenExpiresAt: null } }, { returnDocument: "after", runValidators: true }).select("name email role company status createdAt");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (status === "suspended") req.app.get("io")?.in(`user:${id}`).disconnectSockets(true);
    return res.json({ success: true, user, message: `User ${status} successfully` });
  } catch (error) {
    console.error("Admin update user status failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update user status" });
  }
};


const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid user ID" });
    if (!["admin", "exhibitor", "attendee"].includes(role)) return res.status(400).json({ success: false, message: "Invalid role" });
    if (String(req.user.id) === id) return res.status(400).json({ success: false, message: "You cannot change your own role" });
    const target = await User.findById(id).select("role");
    if (!target) return res.status(404).json({ success: false, message: "User not found" });
    if (target.role === "admin" && role !== "admin") {
      const activeAdmins = await User.countDocuments({ role: "admin", status: "active" });
      if (activeAdmins <= 1) return res.status(409).json({ success: false, message: "At least one active admin account must remain" });
    }
    const user = await User.findByIdAndUpdate(id, { $set: { role, refreshTokenHash: null, refreshTokenExpiresAt: null } }, { returnDocument: "after", runValidators: true }).select("name email role company status createdAt");
    if (target.role === "exhibitor" && role !== "exhibitor") {
      const applicationIds = await Application.distinct("_id", { exhibitor: id });
      await Promise.all([
        Booth.updateMany({ exhibitor: id }, { $set: { exhibitor: null, status: "available", showcase: null } }),
        Application.deleteMany({ exhibitor: id }),
        applicationIds.length ? Notification.deleteMany({ application: { $in: applicationIds } }) : Promise.resolve(),
        ExhibitorProfile.deleteOne({ user: id }),
      ]);
    }
    if (target.role === "attendee" && role !== "attendee") {
      await decrementRegistrationCounts(id);
      await Promise.all([
        ExpoRegistration.deleteMany({ attendee: id }),
        SessionRegistration.deleteMany({ attendee: id }),
      ]);
    }
    if (target.role === "admin" && role !== "admin") {
      await Promise.all([
        Expo.updateMany({ organizer: id }, { $set: { organizer: req.user.id } }),
        Session.updateMany({ createdBy: id }, { $set: { createdBy: req.user.id } }),
        Announcement.updateMany({ createdBy: id }, { $set: { createdBy: req.user.id } }),
        Speaker.updateMany({ createdBy: id }, { $set: { createdBy: req.user.id } }),
        ExpoRegistration.updateMany({ checkedInBy: id }, { $set: { checkedInBy: req.user.id } }),
      ]);
    }
    req.app.get("io")?.in(`user:${id}`).disconnectSockets(true);
    return res.json({ success: true, user, message: "User role updated successfully" });
  } catch (error) {
    console.error("Admin update user role failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update user role" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid user ID" });
    if (String(req.user.id) === id) return res.status(400).json({ success: false, message: "You cannot delete your own account" });
    const user = await User.findById(id).select("_id role");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Keep the cached expo registration counters consistent before deleting attendee passes.
    await decrementRegistrationCounts(id);
    // Release booth allocations before removing the exhibitor account.
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
    if (user.role === "admin") {
      // Preserve event ownership and authored content under the current admin.
      operations.push(
        Expo.updateMany({ organizer: id }, { $set: { organizer: req.user.id } }),
        Session.updateMany({ createdBy: id }, { $set: { createdBy: req.user.id } }),
        Application.updateMany({ reviewedBy: id }, { $set: { reviewedBy: req.user.id } }),
        Announcement.updateMany({ createdBy: id }, { $set: { createdBy: req.user.id } }),
        Speaker.updateMany({ createdBy: id }, { $set: { createdBy: req.user.id } }),
        ExpoRegistration.updateMany({ checkedInBy: id }, { $set: { checkedInBy: req.user.id } }),
      );
    } else {
      const createdSpeakers = await Speaker.find({ createdBy: id }).select("_id").lean();
      const speakerIds = createdSpeakers.map((speaker) => speaker._id);
      operations.push(
        Announcement.deleteMany({ createdBy: id }),
        ...(speakerIds.length ? [Session.updateMany({ speakers: { $in: speakerIds } }, { $pull: { speakers: { $in: speakerIds } } })] : []),
        Speaker.deleteMany({ createdBy: id }),
      );
    }
    await Promise.all(operations);
    await User.deleteOne({ _id: id });
    req.app.get("io")?.in(`user:${id}`).disconnectSockets(true);
    return res.json({ success: true, message: "User and linked account data deleted" });
  } catch (error) {
    console.error("Admin delete user failed:", error);
    return res.status(500).json({ success: false, message: "Unable to delete user" });
  }
};

module.exports = { listUsers, updateUserStatus, updateUserRole, deleteUser };
