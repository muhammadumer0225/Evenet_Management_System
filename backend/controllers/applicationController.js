
const mongoose = require("mongoose");
const { recordAdminActivity } = require("../services/adminActivityService");
const fs = require("fs");
const path = require("path");

const Application = require("../models/Application");
const Expo = require("../models/Expo");
const Booth = require("../models/Booth");
const ExhibitorProfile = require("../models/ExhibitorProfile");
const User = require("../models/User");
const Notification = require("../models/Notification");
const transporter = require("../config/mailer");
const { isExpoRegistrationClosed } = require("../utils/expoSchedule");
const { emitExpoDataUpdated } = require("../services/expoRealtimeService");




const sendApplicationNotification = async (
  application,
  type,
  title,
  message,
  io
) => {
  const exhibitorId = application.exhibitor?._id || application.exhibitor;
  const profileId = application.exhibitorProfile?._id || application.exhibitorProfile;
  const expoId = application.expo?._id || application.expo;
  const boothId = application.booth?._id || application.booth;

  // Send a complete, useful decision email without assuming the populated fields are present.
  try {
    const [recipient, profile, expo, booth] = await Promise.all([
      application.exhibitor?.email
        ? Promise.resolve(application.exhibitor)
        : User.findById(exhibitorId).select("name email").lean(),
      application.exhibitorProfile?.companyName
        ? Promise.resolve(application.exhibitorProfile)
        : ExhibitorProfile.findById(profileId).select("companyName").lean(),
      application.expo?.title && application.expo?.startDate
        ? Promise.resolve(application.expo)
        : Expo.findById(expoId).select("title startDate endDate startTime endTime timezone location").lean(),
      application.booth?.boothNumber
        ? Promise.resolve(application.booth)
        : boothId ? Booth.findById(boothId).select("boothNumber zone size status").lean() : Promise.resolve(null),
    ]);

    if (recipient?.email) {
      const timezone = expo?.timezone || "Asia/Karachi";
      const formatDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : "To be confirmed";
      const venue = expo?.location || {};
      const venueLines = [venue.venue, venue.address, venue.city, venue.country].filter(Boolean);
      const boothLabel = booth?.boothNumber
        ? `${booth.boothNumber}${booth.zone ? ` (${booth.zone})` : ""}`
        : "Not assigned yet";
      const status = application.status || (type === "application_approved" ? "approved" : type === "application_rejected" ? "rejected" : "pending");
      const nextSteps = status === "approved"
        ? [
            "Sign in to EventSphere and open Dashboard > My applications.",
            booth?.boothNumber ? "Review your assigned booth and prepare your showcase." : "Your booth is not assigned yet. Check My applications for organizer updates.",
          ]
        : status === "rejected"
          ? ["Open Dashboard > My applications to review the decision and organizer remarks.", "Contact the Expo organizer if you need clarification."]
          : ["Open Dashboard > My applications to track the review status.", "The organizer will notify you when a decision is made."];

      const subject = `${title} | EventSphere`;
      const emailBody = [
        `Hello ${recipient.name || "Exhibitor"},`,
        "",
        message,
        "",
        "APPLICATION DETAILS",
        "------------------------------",
        `Company: ${profile?.companyName || "Your Company"}`,
        `Expo: ${expo?.title || application.expo?.title || "EventSphere Expo"}`,
        `Expo dates: ${formatDate(expo?.startDate)} to ${formatDate(expo?.endDate)}`,
        `Daily Expo hours: ${expo?.startTime || "09:00"}–${expo?.endTime || "18:00"} (${timezone})`,
        `Venue: ${venueLines.length ? venueLines.join(", ") : "See Expo details in EventSphere"}`,
        `Application status: ${status}`,
        `Preferred booth size: ${application.preferredBoothSize || "Not specified"}`,
        `Assigned booth: ${boothLabel}`,
        application.remarks ? `Organizer remarks: ${application.remarks}` : "",
        "",
        "NEXT STEPS",
        "------------------------------",
        ...nextSteps.map((step, index) => `${index + 1}. ${step}`),
        "",
        "Thank you,",
        "EventSphere Team",
      ].filter((line) => line !== undefined).join("\n");

      await transporter.sendMail({
        from: `"EventSphere" <${process.env.EMAIL_USER}>`,
        to: recipient.email,
        subject,
        text: emailBody,
      });
    }
  } catch (error) {
    console.error("Application email failed:", error.message);
  }

  try {
    if (exhibitorId) {
      const notification = await Notification.create({
        recipient: exhibitorId,
        type,
        title,
        message,
        application: application._id,
        link: "/dashboard/applications",
      });
      io?.to(`user:${exhibitorId}`).emit("new-notification", notification);
    }
  } catch (error) {
    console.error("Application notification save failed:", error.message);
  }
};




// Submit Expo Application
const createApplication = async (req, res) => {
  try {
    const { expoId } = req.params;
    const { preferredBoothSize } = req.body;

    // Validate Expo ID
    if (!mongoose.isValidObjectId(expoId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Expo ID",
      });
    }

    // Validate preferred booth size
    if (
      typeof preferredBoothSize !== "string" ||
      !preferredBoothSize.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Preferred booth size is required",
      });
    }

    // Find published Expo
    const expo = await Expo.findOne({
      _id: expoId,
      status: "published",
    });

    if (!expo) {
      return res.status(404).json({
        success: false,
        message: "Expo not found or not available for applications",
      });
    }

    // Check registration deadline
    const now = new Date();

    if (isExpoRegistrationClosed(expo, now)) {
      return res.status(400).json({
        success: false,
        message: "Applications are closed for this Expo",
      });
    }

    // Find logged-in Exhibitor's company profile
    const profile = await ExhibitorProfile.findOne({
      user: req.user.id,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Please create your exhibitor profile first",
      });
    }

    // Check duplicate application
    const existingApplication = await Application.findOne({
      expo: expoId,
      exhibitor: req.user.id,
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: "You have already applied for this Expo",
      });
    }

        // Copy valid profile documents into application
    const profileDocuments = profile.documents
      .filter(
        (doc) => doc.name && doc.fileUrl && doc.fileType
      )
      .map((doc) => ({
        name: doc.name,
        fileUrl: doc.fileUrl,
        fileType: doc.fileType,
      }));


    // Validate uploaded application documents
    const uploadedDocuments = [];

    if (req.body.documents !== undefined) {
      if (
        !Array.isArray(req.body.documents) ||
        req.body.documents.length > 5
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid documents list. Maximum 5 documents allowed.",
        });
      }

      const allowedTypes = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
      };

      const uploadDirectory = path.resolve(
        __dirname,
        "../uploads/application-documents"
      );

      for (const doc of req.body.documents) {
        if (
          !doc ||
          typeof doc.name !== "string" ||
          typeof doc.fileUrl !== "string" ||
          typeof doc.fileType !== "string"
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid document information.",
          });
        }

        let documentUrl;

        try {
          documentUrl = new URL(doc.fileUrl);
        } catch {
          return res.status(400).json({
            success: false,
            message: "Invalid document URL.",
          });
        }

        const fileName = path.basename(documentUrl.pathname);
        const fileExtension = path.extname(fileName).toLowerCase();

        const expectedPath =
          `/uploads/application-documents/${fileName}`;

        if (
          documentUrl.origin !== `${req.protocol}://${req.get("host")}` ||
          documentUrl.pathname !== expectedPath ||
          documentUrl.search ||
          documentUrl.hash ||
          !/^\d+-\d+\.(pdf|jpg|jpeg|png|webp)$/i.test(fileName) ||
          allowedTypes[fileExtension] !== doc.fileType
        ) {
          return res.status(400).json({
            success: false,
            message: "Document is not an authorized upload.",
          });
        }

        const filePath = path.resolve(uploadDirectory, fileName);

        if (
          !filePath.startsWith(uploadDirectory + path.sep) ||
          !fs.existsSync(filePath) ||
          !fs.statSync(filePath).isFile()
        ) {
          return res.status(400).json({
            success: false,
            message: "Uploaded document was not found on the server.",
          });
        }

        uploadedDocuments.push({
          name: doc.name,
          fileUrl: `${req.protocol}://${req.get("host")}${expectedPath}`,
          fileType: doc.fileType,
        });
      }
    }


    const documents = [
      ...profileDocuments,
      ...uploadedDocuments,
    ];

    // Create Application
    const application = await Application.create({
      expo: expo._id,
      exhibitor: req.user.id,
      exhibitorProfile: profile._id,
      preferredBoothSize: preferredBoothSize.trim(),
      documents,
    });

    try {
      const admins = await User.find({ role: "admin", status: "active" }).select("_id");
      const notifications = await Notification.insertMany(admins.map((admin) => ({
        recipient: admin._id,
        type: "new_application",
        title: "New exhibitor application",
        message: `${req.user.name || "An exhibitor"} applied for ${expo.title}.`,
        application: application._id,
        link: "/dashboard/applications",
        key: `new-application:${application._id}`
      })), { ordered: false });
      const io = req.app.get("io");
      for (const notification of notifications) io?.to(`user:${notification.recipient}`).emit("new-notification", notification);
    } catch (notificationError) {
      console.error("New application notification failed:", notificationError.message);
    }

    emitExpoDataUpdated(req, "application_submitted", expo._id, application._id);

    return res.status(201).json({
      success: true,
      message: "Expo application submitted successfully",
      application,
    });

  } catch (error) {
    // Handle duplicate application race condition
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already applied for this Expo",
      });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};



const getMyApplications = async (req, res) => {
  try {
    // Find applications submitted by logged-in exhibitor
    const applications = await Application.find({
      exhibitor: req.user.id,
    })
      .populate(
        "expo",
        "title slug category startDate endDate startTime endTime timezone registrationDeadline location banner"
      )

      .populate("booth", "boothNumber zone size price status")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Your applications fetched successfully",
      count: applications.length,
      applications,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const getAllApplications = async (req, res) => {
  try {
    const { status, expoId, search } = req.query;

    // Pagination
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid page or limit",
      });
    }

    const filter = {};

    // Filter by application status
    if (status) {
      const allowedStatuses = [
        "pending",
        "approved",
        "rejected",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid application status",
        });
      }

      filter.status = status;
    }

    // Filter by Expo ID
    if (expoId) {
      if (!mongoose.isValidObjectId(expoId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Expo ID",
        });
      }

      filter.expo = expoId;
    }

    // Search by Expo title, company name or exhibitor
    if (search?.trim()) {
      const keyword = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const regex = new RegExp(keyword, "i");

      const [expos, profiles, users] = await Promise.all([
        Expo.find({ title: regex }).select("_id"),

        ExhibitorProfile.find({
          companyName: regex,
        }).select("_id"),

        User.find({
          role: "exhibitor",
          $or: [
            { name: regex },
            { email: regex },
          ],
        }).select("_id"),
      ]);

      filter.$or = [
        { expo: { $in: expos.map((item) => item._id) } },
        {
          exhibitorProfile: {
            $in: profiles.map((item) => item._id),
          },
        },
        {
          exhibitor: {
            $in: users.map((item) => item._id),
          },
        },
      ];
    }

    // Total matching applications
    const total = await Application.countDocuments(filter);

    // Fetch applications
    const applications = await Application.find(filter)
      .populate("expo", "title category startDate endDate startTime endTime timezone registrationDeadline location")
      .populate("exhibitor", "name email")
      .populate("booth", "boothNumber zone size price status")
      .populate(
        "exhibitorProfile",
        "companyName industry logo contactPhone"
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "Applications fetched successfully",
      count: applications.length,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      applications,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const approveApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    // Validate Application ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Application ID",
      });
    }

    // Validate remarks
    if (
      remarks !== undefined &&
      typeof remarks !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Remarks must be a string",
      });
    }

    // Approve only pending applications
    const application = await Application.findOneAndUpdate(
      {
        _id: id,
        status: "pending",
      },
      {
        $set: {
          status: "approved",
          remarks: remarks?.trim() || "",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    )
      .populate("expo", "title category startDate endDate startTime endTime timezone location")
      .populate("exhibitor", "name email")
      .populate("exhibitorProfile", "companyName industry")
      .populate("booth", "boothNumber zone size price status");

    if (!application) {
      const existingApplication = await Application.findById(id);

      if (!existingApplication) {
        return res.status(404).json({
          success: false,
          message: "Application not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Application has already been reviewed",
      });
    }

    await sendApplicationNotification(
  application,
  "application_approved",
  "Application Approved!",
  `Your application for ${application.expo.title} has been approved. Welcome to EventSphere!`,
  req.app.get("io")
);
    emitExpoDataUpdated(req, "application_approved", application.expo?._id || application.expo, application._id);

    await recordAdminActivity({
      req,
      action: "application_approved",
      entityType: "application",
      entityId: application._id,
      expo: application.expo?._id,
      expoTitle: application.expo?.title,
      description: `Approved ${application.exhibitor?.name || "exhibitor"} for ${application.expo?.title || "an Expo"}`,
    });

    return res.status(200).json({
      success: true,
      message: "Application approved successfully",
      application,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};



const rejectApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    // Validate Application ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Application ID",
      });
    }

    // Rejection remarks are required
    if (
      typeof remarks !== "string" ||
      !remarks.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Rejection remarks are required",
      });
    }

    // Reject only pending applications
    const application = await Application.findOneAndUpdate(
      {
        _id: id,
        status: "pending",
      },
      {
        $set: {
          status: "rejected",
          remarks: remarks.trim(),
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      {
        returnDocument: true,
        runValidators: true,
      }
    )
      .populate("expo", "title category startDate endDate startTime endTime timezone location")
      .populate("exhibitor", "name email")
      .populate("exhibitorProfile", "companyName industry")
      .populate("booth", "boothNumber zone size price status");

    if (!application) {
      const existingApplication = await Application.findById(id);

      if (!existingApplication) {
        return res.status(404).json({
          success: false,
          message: "Application not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Application has already been reviewed",
      });
    }

    await sendApplicationNotification(
  application,
  "application_rejected",
  "Application Rejected",
  `Your application for ${application.expo.title} has been rejected. Remarks: ${application.remarks}`,
  req.app.get("io")
);
    emitExpoDataUpdated(req, "application_rejected", application.expo?._id || application.expo, application._id);

    await recordAdminActivity({
      req,
      action: "application_rejected",
      entityType: "application",
      entityId: application._id,
      expo: application.expo?._id,
      expoTitle: application.expo?.title,
      description: `Rejected ${application.exhibitor?.name || "exhibitor"} for ${application.expo?.title || "an Expo"}`,
    });

    return res.status(200).json({
      success: true,
      message: "Application rejected successfully",
      application,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};



module.exports = { createApplication, getMyApplications, getAllApplications, approveApplication, rejectApplication };
