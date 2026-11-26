
const express = require("express");
const router = express.Router();

const {
    registerForExpo,
    getMyExpoRegistrations,
    verifyMyRegistration,
    checkInAttendee,
    cancelExpoRegistration
} = require("../controllers/expoRegistrationController");

const { authMiddleware } = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Registration verification for the attendee who owns the pass.
router.get("/verify/:registrationId", authMiddleware, roleMiddleware("attendee"), verifyMyRegistration);

// Check-in is performed by authorized admins only.
router.post("/check-in", authMiddleware, roleMiddleware("admin"), checkInAttendee);

// Register for Expo
router.post("/:expoId/register", authMiddleware, roleMiddleware("attendee"), registerForExpo);

// Get my Expo registrations
router.get("/my", authMiddleware, roleMiddleware("attendee"), getMyExpoRegistrations);

// Cancel Expo registration
router.patch("/:id/cancel", authMiddleware, roleMiddleware("attendee"), cancelExpoRegistration);

module.exports = router;
