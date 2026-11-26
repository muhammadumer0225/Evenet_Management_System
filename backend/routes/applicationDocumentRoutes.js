const express = require("express");
const fs = require("fs/promises");
// const path = require("path");
const router = express.Router();

const uploadApplicationDocument = require("../middleware/applicationDocumentMiddleware");
const { authMiddleware } = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.post(
  "/upload",
  authMiddleware,
  roleMiddleware("exhibitor"),
  (req, res, next) => {
    uploadApplicationDocument.array("documents", 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one document.",
        });
      }
      try {
        const { fileTypeFromFile } = await import("file-type");

        const allowedMimeTypes = [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        ];

        for (const file of req.files) {
          const detectedType = await fileTypeFromFile(file.path);

          if (
            !detectedType ||
            !allowedMimeTypes.includes(detectedType.mime) ||
            detectedType.mime !== file.mimetype
          ) {
            await Promise.all(
              req.files.map((uploadedFile) =>
                fs.unlink(uploadedFile.path).catch(() => {}),
              ),
            );

            return res.status(400).json({
              success: false,
              message: "File content does not match an allowed document type.",
            });
          }
        }

        const documents = req.files.map((file) => ({
          name: file.originalname,
          fileType: file.mimetype,
          fileUrl: `${req.protocol}://${req.get("host")}/uploads/application-documents/${file.filename}`,
        }));

        return res.status(201).json({
          success: true,
          message: "Documents uploaded successfully.",
          documents,
        });
      } catch (error) {
        await Promise.all(
          (req.files || []).map((file) => fs.unlink(file.path).catch(() => {})),
        );

        return res.status(500).json({
          success: false,
          message: "Unable to verify uploaded documents.",
        });
      }
    });
  },
);

module.exports = router;
