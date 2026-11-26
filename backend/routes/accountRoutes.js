const express = require("express");
const fs = require("fs");
const path = require("path");
const { authMiddleware } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const User = require("../models/User");
const { exportMyData, updateMyProfile, changeMyPassword, deleteMyAccount } = require("../controllers/accountController");
const router = express.Router();
router.use(authMiddleware);
router.get("/export", exportMyData);
router.patch("/profile", updateMyProfile);
router.post("/profile-image", (req, res) => {
  upload.single("image")(req, res, async (uploadError) => {
    if (uploadError) return res.status(400).json({ success: false, message: uploadError.message });
    if (!req.file) return res.status(400).json({ success: false, message: "Please select an image to upload" });
    try {
      const { fileTypeFromFile } = await import("file-type");
      const detected = await fileTypeFromFile(req.file.path);
      const reportedMime = req.file.mimetype === "image/jpg" ? "image/jpeg" : req.file.mimetype;
      const extension = path.extname(req.file.filename).toLowerCase();
      const allowed = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] };
      if (!detected || detected.mime !== reportedMime || !allowed[detected.mime]?.includes(extension)) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ success: false, message: "The uploaded file is not a valid JPG, PNG or WebP image." });
      }
      const user = await User.findById(req.user.id).select("profileImage");
      if (!user) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(404).json({ success: false, message: "Account not found" });
      }
      const previous = user.profileImage;
      const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
      user.profileImage = imageUrl;
      await user.save();
      if (previous) {
        try {
          const oldUrl = new URL(previous);
          const oldName = path.basename(oldUrl.pathname);
          if (oldName && oldName !== req.file.filename && oldUrl.pathname.startsWith("/uploads/")) {
            await fs.promises.unlink(path.join(__dirname, "../uploads", oldName)).catch(() => {});
          }
        } catch { /* Ignore non-local legacy image URLs. */ }
      }
      const fullUser = await User.findById(req.user.id).select("name email role phone company bio profileImage interests consent status createdAt");
      return res.status(200).json({ success: true, message: "Profile picture updated", user: fullUser });
    } catch (error) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      console.error("Profile image upload failed:", error);
      return res.status(500).json({ success: false, message: "Unable to upload profile picture" });
    }
  });
});
router.patch("/password", changeMyPassword);
router.delete("/", deleteMyAccount);
module.exports = router;
