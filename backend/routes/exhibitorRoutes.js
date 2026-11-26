
const express = require("express");
const router = express.Router();

const {
  createExhibitorProfile,
  getMyExhibitorProfile,
  updateMyExhibitorProfile,
  getPublicExhibitorProfile,
} = require("../controllers/exhibitorController");
const { getMyBoothAnalytics, exportMyBoothAnalyticsPdf } = require("../controllers/exhibitorAnalyticsController");

const { authMiddleware } = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");



// Create Exhibitor Profile
router.post(
  "/me",
  authMiddleware,
  roleMiddleware("exhibitor"),
  createExhibitorProfile
);

// Download a privacy-safe PDF report for booths assigned to the logged-in exhibitor.
router.get(
  "/me/booth-analytics/report.pdf",
  authMiddleware,
  roleMiddleware("exhibitor"),
  exportMyBoothAnalyticsPdf
);

// Get aggregate analytics for booths assigned to the logged-in exhibitor.
router.get(
  "/me/booth-analytics",
  authMiddleware,
  roleMiddleware("exhibitor"),
  getMyBoothAnalytics
);

// Get My Exhibitor Profile
router.get(
  "/me",
  authMiddleware,
  roleMiddleware("exhibitor"),
  getMyExhibitorProfile
);

// Update My Exhibitor Profile
router.put(
  "/me",
  authMiddleware,
  roleMiddleware("exhibitor"),
  updateMyExhibitorProfile
);

// Get Public Exhibitor Profile
router.get("/:id", getPublicExhibitorProfile);

module.exports = router;
