
const mongoose = require("mongoose");
const Feedback = require("../models/Feedback");
const ExpoRegistration = require("../models/ExpoRegistration");
const Notification = require("../models/Notification");

// Submit feedback (attendee only)
const createFeedback = async (req, res) => {
  try {
    const { type, name, email, subject, message, rating, expo } = req.body;

    if (!type || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Type, subject and message are required"
      });
    }

    if (!["suggestion", "issue", "question"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid feedback type"
      });
    }

    let expoId = null;
    if (expo) {
      if (!mongoose.isValidObjectId(expo)) {
        return res.status(400).json({ success: false, message: "Invalid Expo ID" });
      }
      const activeRegistration = await ExpoRegistration.exists({
        expo,
        attendee: req.user.id,
        status: "registered",
        paymentStatus: { $in: ["free", "paid"] }
      });
      if (!activeRegistration) {
        return res.status(403).json({ success: false, message: "You can only submit Expo-specific feedback for an active registration" });
      }
      expoId = expo;
    }

    const ratingNumber = Number(rating || 0);

    if (!Number.isInteger(ratingNumber) || ratingNumber < 0 || ratingNumber > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 0 and 5"
      });
    }

    const feedback = await Feedback.create({
      attendee: req.user.id,
      expo: expoId,
      name: name?.trim() || req.user.name || "",
      email: email?.trim() || req.user.email || "",
      type,
      subject: subject.trim(),
      comment: message.trim(),
      rating: ratingNumber
    });

    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      feedback
    });
  } catch (error) {
    // Keep the API response safe, but log the real server-side cause for diagnosis.
    console.error("Feedback submission failed:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Please check the feedback fields and try again" });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "This feedback has already been submitted" });
    }
    return res.status(500).json({ success: false, message: "Failed to submit feedback" });
  }
};

// Get logged-in attendee's feedback
const getMyFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({
      attendee: req.user.id
    }).populate("expo", "title").sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: feedbacks.length,
      feedbacks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch your feedback",
      error: error.message
    });
  }
};

// Admin: get all feedback
const getAllFeedback = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (type) {
      if (!["suggestion", "issue", "question"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid feedback type"
        });
      }
      filter.type = type;
    }

    if (status) {
      if (!["open", "in_progress", "resolved"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid feedback status"
        });
      }
      filter.status = status;
    }

    const currentPage = Math.max(1, Number(page) || 1);
    const pageLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (currentPage - 1) * pageLimit;

    const [feedbacks, total] = await Promise.all([
      Feedback.find(filter)
        .populate("attendee", "name email")
        .populate("expo", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit),
      Feedback.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      count: feedbacks.length,
      total,
      currentPage,
      totalPages: Math.ceil(total / pageLimit),
      feedbacks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch feedback",
      error: error.message
    });
  }
};

// Admin: update feedback status and internal note
const updateFeedbackStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    if (!["open", "in_progress", "resolved"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be open, in_progress or resolved"
      });
    }

    if (note !== undefined && typeof note !== "string") {
      return res.status(400).json({
        success: false,
        message: "Note must be a string"
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid feedback ID"
      });
    }

    const update = { status };

    if (note !== undefined) {
      update.note = note.trim();
    }

    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      update,
      {
        returnDocument: "after",
        runValidators: true
      }
    ).populate("attendee", "name email").populate("expo", "title");

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found"
      });
    }

    try {
      const notification = await Notification.create({
        recipient: feedback.attendee?._id || feedback.attendee,
        type: "feedback_update",
        title: "Your feedback was updated",
        message: `Your feedback “${feedback.subject}” is now ${feedback.status}.${feedback.note ? ` Team note: ${feedback.note}` : ""}`,
        link: "/dashboard/feedback",
        key: `feedback:${feedback._id}:${feedback.updatedAt.getTime()}`
      });
      req.app.get("io")?.to(`user:${feedback.attendee?._id || feedback.attendee}`).emit("new-notification", notification);
    } catch (notificationError) {
      console.error("Feedback notification failed:", notificationError.message);
    }

    res.status(200).json({
      success: true,
      message: "Feedback updated successfully",
      feedback
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update feedback",
      error: error.message
    });
  }
};

module.exports = {
  createFeedback,
  getMyFeedback,
  getAllFeedback,
  updateFeedbackStatus
};
