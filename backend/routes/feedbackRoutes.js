
const express = require("express");
const router = express.Router();

const {
  createFeedback,
  getMyFeedback,
  getAllFeedback,
  updateFeedbackStatus
} = require("../controllers/feedbackController");

const { authMiddleware } = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Attendee: submit feedback
router.post(
  "/",
  authMiddleware,
  roleMiddleware("attendee"),
  createFeedback
);

// Attendee: view own feedback
router.get(
  "/my",
  authMiddleware,
  roleMiddleware("attendee"),
  getMyFeedback
);

// Admin: view all feedback
router.get(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  getAllFeedback
);

// Admin: update feedback status and note
router.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware("admin"),
  updateFeedbackStatus
);

module.exports = router;
