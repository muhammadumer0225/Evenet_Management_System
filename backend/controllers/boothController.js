const mongoose = require("mongoose");
const { recordAdminActivity } = require("../services/adminActivityService");
const { emitExpoDataUpdated } = require("../services/expoRealtimeService");

const Booth = require("../models/Booth");
const Expo = require("../models/Expo");
const Application = require("../models/Application");

// Create Booth
const createBooth = async (req, res) => {
  try {
    const { expo, size, price, position, zone = "Main Hall" } = req.body;
const boothNumber = req.body.boothNumber?.replace(/\s*-\s*/g, "-").trim();

    if (!expo || !boothNumber || !size || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const expoExists = await Expo.findById(expo);

    if (!expoExists) {
      return res.status(404).json({
        success: false,
        message: "Expo not found",
      });
    }

    const boothData = {
  expo,
  boothNumber,
  zone: typeof zone === "string" && zone.trim() ? zone.trim() : "Main Hall",
  size,
  price,
};

// Add position only when provided
if (position !== undefined) {
  boothData.position = position;
}


const existingBooth = await Booth.findOne({
  expo,
  boothNumber,
});

if (existingBooth) {
  return res.status(409).json({
    success: false,
    message: "This booth number already exists in this Expo",
  });
}

const booth = await Booth.create(boothData);
    emitExpoDataUpdated(req, "booth_created", booth.expo, booth._id);

    res.status(201).json({
      success: true,
      message: "Booth created successfully",
      booth,
    });

  } catch (error) {
    if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "This booth number already exists in this Expo",
    });
  }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Booths
const getAllBooths = async (req, res) => {
  try {
    if (
  req.query.expo &&
  !mongoose.isValidObjectId(req.query.expo)
) {
  return res.status(400).json({
    success: false,
    message: "Invalid Expo ID",
  });
}

    const filter = {};

if (req.query.expo) {
  filter.expo = req.query.expo;
}

const booths = await Booth.find(filter)
  .populate("expo", "title category startDate endDate")
  .populate("exhibitor", "name email company");

    res.status(200).json({
      success: true,
      count: booths.length,
      booths,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get My Reservations (Exhibitor Only)
const getMyReservations = async (req, res) => {
  try {
    const booths = await Booth.find({
      exhibitor: req.user.id,
      status: "reserved",
    }).populate("expo");

    res.status(200).json({
      success: true,
      count: booths.length,
      booths,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// Get logged-in exhibitor's approved booth showcase

const getMyShowcase = async (req, res) => {
  try {
    const booths = await Booth.find({
      exhibitor: req.user.id,
      status: { $in: ["reserved", "occupied"] },
    }).populate("expo");

    return res.status(200).json({
      success: true,
      booths,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// Save logged-in exhibitor's booth showcase
const updateMyShowcase = async (req, res) => {
  try {
    const { id } = req.params;
    const { tagline, offer, hours, products, staff } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Booth ID",
      });
    }

    if (
      (products !== undefined && !Array.isArray(products)) ||
      (staff !== undefined && !Array.isArray(staff))
    ) {
      return res.status(400).json({
        success: false,
        message: "Products and staff must be arrays",
      });
    }

   const booth = await Booth.findOne({
  _id: id,
  exhibitor: req.user.id,
  status: { $in: ["reserved", "occupied"] },
});

    if (!booth) {
      return res.status(404).json({
        success: false,
        message: "Confirmed booth not found",
      });
    }

    booth.showcase = {
      tagline: tagline ?? "",
      offer: offer ?? "",
      hours: hours ?? "09:00 – 18:00",
      products: (products || []).map((item) => String(item).trim()).filter(Boolean),
      staff: (staff || []).map((person) => ({
        name: String(person.name || "").trim(),
        role: String(person.role || "").trim(),
        email: String(person.email || "").trim().toLowerCase(),
      })),
    };

    await booth.save();

    return res.status(200).json({
      success: true,
      message: "Showcase saved successfully",
      booth,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




// Get Expo Floor Plan
const getExpoFloorPlan = async (req, res) => {
  try {
    const { expoId } = req.params;

    // Validate Expo ID
    if (!mongoose.isValidObjectId(expoId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Expo ID",
      });
    }

    // Find published Expo
    const expo = await Expo.findOne({
      _id: expoId,
      status: "published",
    }).select("title category location startDate endDate floorPlan");

    if (!expo) {
      return res.status(404).json({
        success: false,
        message: "Published Expo not found",
      });
    }

    // Get all booths of this Expo
    const booths = await Booth.find({
      expo: expoId,
    })
      .select("boothNumber zone size price status exhibitor position")
      .populate("exhibitor", "name")
      .sort({ boothNumber: 1 });

    return res.status(200).json({
      success: true,
      message: "Expo floor plan fetched successfully",
      expo,
      floorPlan: expo.floorPlan || null,
      count: booths.length,
      booths,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


// Get Single Booth
const getBoothById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Booth ID",
      });
    }

    const booth = await Booth.findById(id).populate(
  "expo",
  "title category startDate endDate"
);

    if (!booth) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    res.status(200).json({
      success: true,
      booth,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Booth
const updateBooth = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid Booth ID" });
    }

    const currentBooth = await Booth.findById(id);
    if (!currentBooth) {
      return res.status(404).json({ success: false, message: "Booth not found" });
    }

    const { boothNumber, size, price, status, exhibitor, position, zone } = req.body;

    if (status === "blocked") {
      return res.status(400).json({
        success: false,
        message: "Use the booth availability endpoint to mark a booth unavailable",
      });
    }

    if (status === "available" && currentBooth.status === "blocked") {
      return res.status(400).json({
        success: false,
        message: "Use the booth availability endpoint to restore this booth",
      });
    }

    // A booth can only become confirmed after a valid exhibitor reservation
    // is linked to an approved application for the same Expo.
    let linkedApplication = null;
    if (status === "occupied") {
      if (!["reserved", "occupied"].includes(currentBooth.status) || !currentBooth.exhibitor) {
        return res.status(409).json({
          success: false,
          message: "Only a reserved booth with an exhibitor can be confirmed",
        });
      }

      linkedApplication = await Application.findOne({
        expo: currentBooth.expo,
        exhibitor: currentBooth.exhibitor,
        status: "approved",
        $or: [{ booth: currentBooth._id }, { booth: null }],
      });

      if (!linkedApplication) {
        return res.status(409).json({
          success: false,
          message: "An approved application must be linked before confirming this booth",
        });
      }
    }

    // Reservation is created through reserve/assign endpoints only.
    if (status === "reserved" && currentBooth.status !== "reserved") {
      return res.status(400).json({
        success: false,
        message: "Use the reservation or assignment workflow to reserve a booth",
      });
    }

    const updateData = {};
    if (boothNumber !== undefined) updateData.boothNumber = boothNumber;
    if (size !== undefined) updateData.size = size;
    if (price !== undefined) updateData.price = price;
    if (status !== undefined) updateData.status = status;
    if (zone !== undefined) updateData.zone = String(zone).trim() || "Main Hall";
    if (position !== undefined) updateData.position = position;
    if (exhibitor !== undefined && status !== "available") updateData.exhibitor = exhibitor;
    if (status === "available") {
      updateData.exhibitor = null;
      updateData.showcase = {};
    }

    const booth = await Booth.findByIdAndUpdate(id, { $set: updateData }, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!booth) {
      return res.status(404).json({ success: false, message: "Booth not found" });
    }

    // Keep Application.booth consistent when an admin confirms or releases a booth.
    if (status === "occupied" && linkedApplication && !linkedApplication.booth) {
      const linked = await Application.updateOne(
        { _id: linkedApplication._id, status: "approved", booth: null },
        { $set: { booth: booth._id } }
      );
      if (!linked.modifiedCount && !linked.matchedCount) {
        await Booth.updateOne(
          { _id: booth._id, status: "occupied", exhibitor: currentBooth.exhibitor },
          { $set: { status: currentBooth.status } }
        );
        return res.status(409).json({
          success: false,
          message: "Application changed while confirming. Refresh and try again.",
        });
      }
    }

    if (status === "available" && currentBooth.exhibitor) {
      try {
        await Application.updateMany(
          { booth: booth._id },
          { $set: { booth: null } }
        );
      } catch (error) {
        await Booth.updateOne(
          { _id: booth._id, status: "available", exhibitor: null },
          { $set: { status: currentBooth.status, exhibitor: currentBooth.exhibitor, showcase: currentBooth.showcase || {} } }
        );
        throw error;
      }
    }

    emitExpoDataUpdated(req, status === "available" ? "booth_released" : status === "occupied" ? "booth_confirmed" : "booth_updated", booth.expo, booth._id);
    return res.status(200).json({
      success: true,
      message: status === "occupied" ? "Booth confirmed successfully" : status === "available" ? "Booth released successfully" : "Booth updated successfully",
      booth,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "This booth number already exists in this Expo" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Block or restore booth availability (Admin Only)
const setBoothAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Booth ID",
      });
    }

    if (!["blocked", "available"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be blocked or available",
      });
    }

    const expectedStatus = status === "blocked" ? "available" : "blocked";

    const booth = await Booth.findOneAndUpdate(
      { _id: id, status: expectedStatus },
      { $set: { status } },
      { returnDocument: "after", runValidators: true }
    );

    if (!booth) {
      const existingBooth = await Booth.findById(id);

      if (!existingBooth) {
        return res.status(404).json({
          success: false,
          message: "Booth not found",
        });
      }

      return res.status(409).json({
        success: false,
        message:
          status === "blocked"
            ? "Only available booths can be marked unavailable"
            : "Only unavailable booths can be restored",
      });
    }

    emitExpoDataUpdated(req, "booth_availability_updated", booth.expo, booth._id);
    return res.status(200).json({
      success: true,
      message:
        status === "blocked"
          ? "Booth marked unavailable"
          : "Booth restored to available",
      booth,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Booth
const deleteBooth = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Booth ID",
      });
    }

    const existingBooth = await Booth.findById(id);

    if (!existingBooth) {
      return res.status(404).json({ success: false, message: "Booth not found" });
    }

    if (["reserved", "occupied"].includes(existingBooth.status) || existingBooth.exhibitor) {
      return res.status(409).json({
        success: false,
        message: "Release the assigned booth before deleting it",
      });
    }

    const booth = await Booth.findByIdAndDelete(id);
    if (!booth) {
      return res.status(404).json({ success: false, message: "Booth not found" });
    }

    await Application.updateMany({ booth: booth._id }, { $set: { booth: null } });
    emitExpoDataUpdated(req, "booth_deleted", booth.expo, booth._id);
    res.status(200).json({
      success: true,
      message: "Booth deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Reserve Booth
const reserveBooth = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Booth ID",
      });
    }

    const requestedBooth = await Booth.findById(id).select("expo status");

    if (!requestedBooth) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    // An exhibitor may reserve a booth only after an admin approves their
    // application for the same Expo.
    const application = await Application.findOne({
      expo: requestedBooth.expo,
      exhibitor: req.user.id,
      status: "approved",
    });

    if (!application) {
      return res.status(403).json({
        success: false,
        message: "Your application for this Expo must be approved before reserving a booth",
      });
    }

    if (application.booth) {
      return res.status(409).json({
        success: false,
        message: "You already have a booth assigned for this Expo",
      });
    }

    const booth = await Booth.findOneAndUpdate(
      {
        _id: id,
        expo: requestedBooth.expo,
        status: "available",
      },
      {
        $set: {
          status: "reserved",
          exhibitor: req.user.id,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!booth) {
      return res.status(409).json({
        success: false,
        message: "Booth is unavailable or has already been reserved",
      });
    }

    // Link the reservation to the approved application so the dashboard,
    // application history and booth inventory all show the same assignment.
    let updatedApplication;
    try {
      updatedApplication = await Application.findOneAndUpdate(
        {
          _id: application._id,
          status: "approved",
          booth: null,
        },
        { $set: { booth: booth._id } },
        { returnDocument: "after", runValidators: true }
      );
    } catch (error) {
      await Booth.updateOne(
        { _id: booth._id, exhibitor: req.user.id, status: "reserved" },
        { $set: { status: "available", exhibitor: null } }
      );
      throw error;
    }

    if (!updatedApplication) {
      await Booth.updateOne(
        { _id: booth._id, exhibitor: req.user.id, status: "reserved" },
        { $set: { status: "available", exhibitor: null } }
      );
      return res.status(409).json({
        success: false,
        message: "Your application already has a booth or changed while reserving. Refresh and try again.",
      });
    }

    emitExpoDataUpdated(req, "booth_reserved", booth.expo, booth._id);
    return res.status(200).json({
      success: true,
      message: "Booth reserved successfully",
      booth,
      application: updatedApplication,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const releaseBooth = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Booth ID",
      });
    }

    const currentBooth = await Booth.findOne({
      _id: id,
      exhibitor: req.user.id,
      status: "reserved",
    }).select("showcase");

    if (!currentBooth) {
      return res.status(404).json({
        success: false,
        message: "Reserved booth not found or does not belong to you",
      });
    }

    const booth = await Booth.findOneAndUpdate(
      { _id: id, exhibitor: req.user.id, status: "reserved" },
      { $set: { status: "available", exhibitor: null, showcase: {} } },
      { returnDocument: "after", runValidators: true }
    );

    if (!booth) {
      return res.status(409).json({
        success: false,
        message: "Booth status changed. Refresh and try again.",
      });
    }

    try {
      await Application.updateMany(
        { booth: booth._id },
        { $set: { booth: null } }
      );
    } catch (error) {
      await Booth.updateOne(
        { _id: booth._id, status: "available", exhibitor: null },
        { $set: { status: "reserved", exhibitor: req.user.id, showcase: currentBooth.showcase || {} } }
      );
      throw error;
    }

    emitExpoDataUpdated(req, "booth_released", booth.expo, booth._id);
    return res.status(200).json({
      success: true,
      message: "Booth released successfully",
      booth,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Admin assigns an available booth to an approved application
const assignBoothToApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { applicationId } = req.body;

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(applicationId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Booth ID or Application ID",
      });
    }

    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    if (application.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Only approved applications can receive a booth",
      });
    }

    if (application.booth) {
      return res.status(409).json({
        success: false,
        message: "This application already has an assigned booth",
      });
    }

    const existingAssignment = await Application.findOne({
      expo: application.expo,
      exhibitor: application.exhibitor,
      booth: { $ne: null },
    });

    if (existingAssignment) {
      return res.status(409).json({
        success: false,
        message: "This exhibitor already has a booth in this Expo",
      });
    }

    const booth = await Booth.findOneAndUpdate(
      {
        _id: id,
        expo: application.expo,
        status: "available",
      },
      {
        $set: {
          status: "reserved",
          exhibitor: application.exhibitor,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!booth) {
      return res.status(409).json({
        success: false,
        message: "Booth is unavailable or does not belong to this Expo",
      });
    }

    application.booth = booth._id;

    try {
      await application.save();
    } catch (error) {
      await Booth.updateOne(
        {
          _id: booth._id,
          exhibitor: application.exhibitor,
          status: "reserved",
        },
        {
          $set: {
            status: "available",
            exhibitor: null,
          },
        }
      );

      throw error;
    }

    await recordAdminActivity({
      req,
      action: "booth_assigned",
      entityType: "booth",
      entityId: booth._id,
      expo: application.expo,
      expoTitle: "",
      description: `Assigned booth ${booth.boothNumber || ""} to an exhibitor`,
    });

    emitExpoDataUpdated(req, "booth_assigned", booth.expo, booth._id);
    return res.status(200).json({
      success: true,
      message: "Booth assigned successfully",
      booth,
      application,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { createBooth, getAllBooths, getBoothById, updateBooth, setBoothAvailability, deleteBooth, reserveBooth, getMyReservations, getMyShowcase,updateMyShowcase, getExpoFloorPlan, releaseBooth, assignBoothToApplication };
