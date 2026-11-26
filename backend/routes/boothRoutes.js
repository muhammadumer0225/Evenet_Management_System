
const express = require("express");
const router = express.Router();

const {
  createBooth,
  getAllBooths,
  getBoothById,
  updateBooth,
  setBoothAvailability,
  deleteBooth,
  reserveBooth,
  getMyReservations,
  getMyShowcase,
updateMyShowcase,
  getExpoFloorPlan,
  releaseBooth,
  assignBoothToApplication,
} = require("../controllers/boothController");

const { recordBoothVisit } = require("../controllers/boothVisitController");

const { authMiddleware } = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Create Booth (Admin Only)
router.post(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  createBooth
);

// Get All Booths
router.get("/", getAllBooths);

// Get My Reservations (Exhibitor Only)
// Keep this before /:id
router.get(
  "/my-reservations",
  authMiddleware,
  roleMiddleware("exhibitor"),
  getMyReservations
);


// GET /my-showcase (exhibitor only)
router.get(
  "/my-showcase",
  authMiddleware,
  roleMiddleware("exhibitor"),
  getMyShowcase
);

// PATCH /:id/showcase (exhibitor only)
router.patch(
  "/:id/showcase",
  authMiddleware,
  roleMiddleware("exhibitor"),
  updateMyShowcase
);

// Get Expo Floor Plan
router.get(
  "/floor-plan/:expoId",
  getExpoFloorPlan
);

// Record a verified attendee visit at a booth (Admin/staff only)
router.post(
  "/:id/visits",
  authMiddleware,
  roleMiddleware("admin"),
  recordBoothVisit
);

// Get Single Booth
router.get("/:id", getBoothById);

// Block or restore booth availability (Admin Only)
router.patch(
  "/:id/availability",
  authMiddleware,
  roleMiddleware("admin"),
  setBoothAvailability
);

// Update Booth (Admin Only)
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  updateBooth
);

// Delete Booth (Admin Only)
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("admin"),
  deleteBooth
);

// Assign Booth to Approved Application (Admin Only)
router.patch(
  "/:id/assign",
  authMiddleware,
  roleMiddleware("admin"),
  assignBoothToApplication
);

// Reserve Booth (Exhibitor Only)
router.post(
  "/:id/reserve",
  authMiddleware,
  roleMiddleware("exhibitor"),
  reserveBooth
);

router.patch(
  "/:id/release",
  authMiddleware,
  roleMiddleware("exhibitor"),
  releaseBooth
);

module.exports = router;
