
const express = require("express");
const router = express.Router();

const {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../controllers/notificationController");

const { authMiddleware } = require("../middleware/authMiddleware");

// Get logged-in user's notifications
router.get(
  "/",
  authMiddleware,
  getMyNotifications
);

// Mark all notifications as read
router.patch("/read-all", authMiddleware, markAllNotificationsAsRead);

// Mark notification as read
router.patch(
  "/:id/read",
  authMiddleware,
  markNotificationAsRead
);

module.exports = router;
