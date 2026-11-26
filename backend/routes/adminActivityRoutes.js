const express = require("express");
const router = express.Router();
const { getAdminActivities } = require("../controllers/adminActivityController");
const { authMiddleware } = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", authMiddleware, roleMiddleware("admin"), getAdminActivities);

module.exports = router;
