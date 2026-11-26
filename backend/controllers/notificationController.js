
const mongoose = require("mongoose");
const Notification = require("../models/Notification");

// Get logged-in user's notifications
const getMyNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({
        recipient: req.user.id,
      })
        .populate("application", "status remarks preferredBoothSize")
.populate("sender", "name email role")
        .sort({ createdAt: -1 }),

      Notification.countDocuments({
        recipient: req.user.id,
        isRead: false,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      count: notifications.length,
      unreadCount,
      notifications,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// Mark all notifications for the authenticated user as read.
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    req.app.get("io")?.to(`user:${req.user.id}`).emit("notifications-read-all", { readAt: new Date() });
    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to mark notifications as read" });
  }
};

// Mark notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: req.user.id,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      {
        returnDocument: "after",
      }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    req.app.get("io")?.to(`user:${req.user.id}`).emit("notification-read", { notificationId: id, readAt: notification.readAt });
    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
