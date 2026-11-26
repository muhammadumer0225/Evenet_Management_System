
const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");
const { authMiddleware } = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const fs = require("fs");
const path = require("path");

// Upload image — Admin only
router.post(
  "/upload",
  authMiddleware,
  roleMiddleware("admin", "exhibitor"),
  (req, res) => {
    upload.single("image")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select an image to upload",
        });
      }

      try {
        const { fileTypeFromFile } = await import("file-type");
        const detected = await fileTypeFromFile(req.file.path);
        const reportedMime = req.file.mimetype === "image/jpg" ? "image/jpeg" : req.file.mimetype;
        const extension = path.extname(req.file.filename).toLowerCase();
        const allowedExtensions = {
          "image/jpeg": [".jpg", ".jpeg"],
          "image/png": [".png"],
          "image/webp": [".webp"],
        };

        if (!detected || detected.mime !== reportedMime || !allowedExtensions[detected.mime]?.includes(extension)) {
          await fs.promises.unlink(req.file.path).catch(() => {});
          return res.status(400).json({ success: false, message: "The uploaded file is not a valid JPG, PNG or WebP image." });
        }
      } catch (validationError) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        console.error("Image signature validation failed:", validationError.message);
        return res.status(500).json({ success: false, message: "Unable to validate the uploaded image." });
      }

      const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

      return res.status(201).json({
        success: true,
        message: "Image uploaded successfully",
        image: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: imageUrl,
        },
      });
    });
  }
);

module.exports = router;
