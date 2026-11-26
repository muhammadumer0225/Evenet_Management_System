
const mongoose = require("mongoose");
const Announcement = require("../models/Announcement");
const Expo = require("../models/Expo");
const User = require("../models/User");
const Application = require("../models/Application");
const ExpoRegistration = require("../models/ExpoRegistration");
const Notification = require("../models/Notification");

const getAnnouncementRecipients = async ({ targetAudience, expoId }) => {
  const roles = targetAudience === "attendees" ? ["attendee"]
    : targetAudience === "exhibitors" ? ["exhibitor"]
      : ["attendee", "exhibitor", "admin"];
  if (!expoId) return User.find({ role: { $in: roles }, status: "active" }).distinct("_id");

  const ids = [];
  if (roles.includes("attendee")) {
    const attendeeIds = await ExpoRegistration.distinct("attendee", {
      expo: expoId,
      status: "registered",
      paymentStatus: { $in: ["free", "paid"] }
    });
    ids.push(...attendeeIds);
  }
  if (roles.includes("exhibitor")) {
    const exhibitorIds = await Application.distinct("exhibitor", { expo: expoId, status: { $in: ["pending", "approved"] } });
    ids.push(...exhibitorIds);
  }
  if (roles.includes("admin")) {
    const adminIds = await User.find({ role: "admin", status: "active" }).distinct("_id");
    ids.push(...adminIds);
  }
  return [...new Map(ids.map((id) => [id.toString(), id])).values()];
};

const notifyAnnouncementRecipients = async (announcement, req) => {
  const recipients = await getAnnouncementRecipients({
    targetAudience: announcement.targetAudience || "all",
    expoId: announcement.expo
  });
  if (!recipients.length) return;

  const notifications = recipients.map((recipient) => ({
    recipient,
    type: "new_announcement",
    title: announcement.title,
    message: announcement.message,
    link: "/dashboard/announcements",
    key: `announcement:${announcement._id}:${new Date(announcement.updatedAt || Date.now()).getTime()}`
  }));

  const created = await Notification.insertMany(notifications, { ordered: false });
  const io = req.app.get("io");
  for (const notification of created) {
    io?.to(`user:${notification.recipient}`).emit("new-notification", notification);
  }
};

// Create Announcement
const createAnnouncement = async (req, res) => {
  try {
    const { title, message, targetAudience, expo } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required"
      });
    }

    if (
      targetAudience &&
      !["all", "attendees", "exhibitors"].includes(targetAudience)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid target audience"
      });
    }

    if (expo) {
      if (!mongoose.isValidObjectId(expo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Expo ID"
        });
      }

      const existingExpo = await Expo.findById(expo);

      if (!existingExpo) {
        return res.status(404).json({
          success: false,
          message: "Expo not found"
        });
      }
    }

    const announcement = await Announcement.create({
      title,
      message,
      targetAudience,
      expo: expo || null,
      createdBy: req.user.id
    });

    try {
      await notifyAnnouncementRecipients(announcement, req);
    } catch (notificationError) {
      console.error("Announcement notification delivery failed:", notificationError.message);
    }

    res.status(201).json({
      success: true,
      message: "Announcement created successfully",
      announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create announcement",
      error: error.message
    });
  }
};


const getAllAnnouncements = async (req, res) => {
  try {
    const {
      search,
      targetAudience,
      expo,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    if (targetAudience) {
      filter.targetAudience = targetAudience;
    }

    if (expo) {
      filter.expo = expo;
    }

    if (search?.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { message: { $regex: search.trim(), $options: "i" } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [announcements, total] = await Promise.all([
      Announcement.find(filter)
        .populate("expo", "title")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),

      Announcement.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      count: announcements.length,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      announcements
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch announcements",
      error: error.message
    });
  }
};




const getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate("expo", "title")
      .populate("createdBy", "name email");

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found"
      });
    }

    res.status(200).json({
      success: true,
      announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch announcement",
      error: error.message
    });
  }
};

// Update Announcement
const updateAnnouncement = async (req, res) => {
  try {
    const { title, message, targetAudience, expo } = req.body;

    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found"
      });
    }

    if (title !== undefined) announcement.title = title;
    if (message !== undefined) announcement.message = message;
    if (targetAudience !== undefined) {
      announcement.targetAudience = targetAudience;
    }

    if (expo !== undefined) {
      if (expo && !mongoose.isValidObjectId(expo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Expo ID"
        });
      }

      if (expo) {
        const existingExpo = await Expo.findById(expo);

        if (!existingExpo) {
          return res.status(404).json({
            success: false,
            message: "Expo not found"
          });
        }
      }

      announcement.expo = expo || null;
    }

    await announcement.save();
    try {
      await notifyAnnouncementRecipients(announcement, req);
    } catch (notificationError) {
      console.error("Updated announcement notification delivery failed:", notificationError.message);
    }

    res.status(200).json({
      success: true,
      message: "Announcement updated successfully",
      announcement
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update announcement",
      error: error.message
    });
  }
};

// Delete Announcement
const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Announcement deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete announcement",
      error: error.message
    });
  }
};


const getMyAnnouncements = async (req, res) => {
  try {
    const audienceFilter = req.user.role === "admin"
      ? ["all", "attendees", "exhibitors"]
      : req.user.role === "attendee" ? ["all", "attendees"] : ["all", "exhibitors"];

    let relevantExpoIds = [];
    if (req.user.role === "attendee") {
      relevantExpoIds = await ExpoRegistration.distinct("expo", {
        attendee: req.user.id,
        status: "registered",
        paymentStatus: { $in: ["free", "paid"] }
      });
    } else if (req.user.role === "exhibitor") {
      relevantExpoIds = await Application.distinct("expo", {
        exhibitor: req.user.id,
        status: { $in: ["pending", "approved"] }
      });
    }

    const filter = {
      targetAudience: { $in: audienceFilter },
      ...(req.user.role === "admin" ? {} : {
        $or: [
          { expo: null },
          { expo: { $in: relevantExpoIds } }
        ]
      })
    };

    const announcements = await Announcement.find(filter)
      .populate("expo", "title")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: announcements.length, announcements });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch your announcements" });
  }
};



module.exports = {
  createAnnouncement,
  getAllAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  getMyAnnouncements
};
