const express = require("express");
const router = express.Router();

const { completeDemoPaymentController } = require("../controllers/paymentController");
const { authMiddleware } = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Premium/VIP payment is intentionally simulated for this project.
router.post(
    "/demo/complete/:registrationId",
    authMiddleware,
    roleMiddleware("attendee"),
    completeDemoPaymentController
);

module.exports = router;
