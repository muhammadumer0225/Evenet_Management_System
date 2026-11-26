
const mongoose = require("mongoose");

const Session = require("../models/Session");
const Expo = require("../models/Expo");
const Speaker = require("../models/Speaker");
const SessionRegistration = require("../models/SessionRegistration");
const Notification = require("../models/Notification");
const { validateSessionWithinExpoHours, formatExpoDateTime } = require("../utils/expoSchedule");
const { emitExpoDataUpdated } = require("../services/expoRealtimeService");

const notifySessionParticipants = async (session, type, title, message, io) => {
  const attendeeIds = await SessionRegistration.distinct("attendee", {
    session: session._id,
    status: "registered"
  });
  if (!attendeeIds.length) return;
  await Notification.deleteMany({
    recipient: { $in: attendeeIds },
    key: `session-reminder:${session._id}`
  });
  const eventKey = `session:${session._id}:${type}:${new Date(session.updatedAt || Date.now()).getTime()}`;
  try {
    const notifications = await Notification.insertMany(attendeeIds.map((recipient) => ({
      recipient,
      type,
      title,
      message,
      link: "/dashboard/agenda",
      key: eventKey
    })), { ordered: false });
    for (const notification of notifications) {
      io?.to(`user:${notification.recipient}`).emit("new-notification", notification);
    }
  } catch (error) {
    console.error("Session participant notifications failed:", error.message);
  }
};

// Validate session dates
const validateSessionDates = (startTime, endTime, expo) => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (
    isNaN(start.getTime()) ||
    isNaN(end.getTime())
  ) {
    return {
      valid: false,
      message: "Invalid session date format",
    };
  }

  if (end <= start) {
    return {
      valid: false,
      message: "Session end time must be after start time",
    };
  }

  const expoWindow = validateSessionWithinExpoHours(start, end, expo);
  if (!expoWindow.valid) return expoWindow;

  return {
    valid: true,
    start,
    end,
  };
};

// Validate Speaker IDs
const validateSpeakers = async (speakerIds) => {
  if (!Array.isArray(speakerIds)) {
    return {
      valid: false,
      message: "Speakers must be an array",
    };
  }

  const uniqueIds = [
    ...new Set(speakerIds.map(id => String(id))),
  ];

  for (const id of uniqueIds) {
    if (!mongoose.isValidObjectId(id)) {
      return {
        valid: false,
        message: "Invalid Speaker ID",
      };
    }
  }

  const count = await Speaker.countDocuments({
    _id: { $in: uniqueIds },
  });

  if (count !== uniqueIds.length) {
    return {
      valid: false,
      message: "One or more Speakers were not found",
    };
  }

  return {
    valid: true,
    speakers: uniqueIds,
  };
};

// Check Room and Speaker Schedule Conflicts
const checkScheduleConflicts = async ({
  expoId,
  room,
  startTime,
  endTime,
  speakers,
  excludeSessionId,
}) => {
  const excludeFilter = excludeSessionId
    ? { _id: { $ne: excludeSessionId } }
    : {};

  // Find overlapping Room booking
  const roomConflict = await Session.findOne({
    ...excludeFilter,
    expo: expoId,
    room: {
      $regex: `^${room.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").trim()}$`,
      $options: "i",
    },
    status: { $ne: "cancelled" },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  });

  if (roomConflict) {
    return "This room is already booked during this time";
  }

  // Check Speaker availability across sessions
  if (speakers.length > 0) {
    const speakerConflict = await Session.findOne({
      ...excludeFilter,
      speakers: { $in: speakers },
      status: { $ne: "cancelled" },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    });

    if (speakerConflict) {
      return "One or more Speakers are already assigned to another session during this time";
    }
  }

  return null;
};

// CREATE SESSION — Admin Only
const createSession = async (req, res) => {
  try {
    const {
      expo,
      title,
      description,
      category,
      speakers = [],
      room,
      startTime,
      endTime,
      capacity,
      status,
    } = req.body;

    if (
      !expo ||
      !title?.trim() ||
      !description?.trim() ||
      !room?.trim() ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    if (!mongoose.isValidObjectId(expo)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Expo ID",
      });
    }

    const expoExists = await Expo.findById(expo);

    if (!expoExists) {
      return res.status(404).json({
        success: false,
        message: "Expo not found",
      });
    }

    const dateCheck = validateSessionDates(
      startTime,
      endTime,
      expoExists
    );

    if (!dateCheck.valid) {
      return res.status(400).json({
        success: false,
        message: dateCheck.message,
      });
    }

    if (
      capacity !== undefined &&
      capacity !== null &&
      (!Number.isInteger(Number(capacity)) || Number(capacity) < 1)
    ) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be a positive integer",
      });
    }

    const speakerCheck = await validateSpeakers(speakers);

    if (!speakerCheck.valid) {
      return res.status(400).json({
        success: false,
        message: speakerCheck.message,
      });
    }

    const conflict = await checkScheduleConflicts({
      expoId: expo,
      room: room.trim(),
      startTime: dateCheck.start,
      endTime: dateCheck.end,
      speakers: speakerCheck.speakers,
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: conflict,
      });
    }

    const session = await Session.create({
      expo,
      title,
      description,
      category,
      speakers: speakerCheck.speakers,
      room,
      startTime: dateCheck.start,
      endTime: dateCheck.end,
      capacity:
        capacity === undefined || capacity === null
          ? null
          : Number(capacity),
      status,
      createdBy: req.user.id,
    });

    emitExpoDataUpdated(req, "session_created", session.expo, session._id);

    return res.status(201).json({
      success: true,
      message: "Session created successfully",
      session,
    });

  } catch (error) {
    console.error("Create Session Error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET ALL SESSIONS
const getAllSessions = async (req, res) => {
  try {
    const {
      search,
      expo,
      speaker,
      room,
      category,
      status,
      startDate,
      endDate,
    } = req.query;

    const isAdminManagement = req.user?.role === "admin";

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

    // Public users can only see Sessions
// belonging to published Expos
if (!isAdminManagement) {
  filter.status = "published";

  const publishedExpoIds = await Expo.distinct(
    "_id",
    { status: "published" }
  );

  filter.expo = {
    $in: publishedExpoIds,
  };
}

    if (expo) {
  if (!mongoose.isValidObjectId(expo)) {
    return res.status(400).json({
      success: false,
      message: "Invalid Expo ID",
    });
  }

  if (!isAdminManagement) {
    const publishedExpo = await Expo.exists({
      _id: expo,
      status: "published",
    });

    if (!publishedExpo) {
      return res.status(404).json({
        success: false,
        message: "Published Expo not found",
      });
    }

    filter.expo = expo;
  } else {
    filter.expo = expo;
  }
}

    // Filter by Speaker
    if (speaker) {
      if (!mongoose.isValidObjectId(speaker)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Speaker ID",
        });
      }

      filter.speakers = speaker;
    }

    // Filter by Room
    if (room?.trim()) {
      filter.room = {
        $regex: `^${room.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      };
    }

    // Filter by Category
    if (category?.trim()) {
      filter.category = {
        $regex: `^${category.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      };
    }

    // Filter by Status
    if (status) {
      const allowedStatuses = [
        "draft",
        "published",
        "cancelled",
        "completed",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Session status",
        });
      }

      if (!isAdminManagement && status !== "published") {
        return res.status(403).json({
          success: false,
          message: "Public users can only view published Sessions",
        });
      }

      if (isAdminManagement) {
        filter.status = status;
      }
    }

    // Search by title, description and room
    if (search?.trim()) {
      const keyword = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { title: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
        { room: { $regex: keyword, $options: "i" } },
      ];
    }

    // Date-range filtering using overlapping time window
    const dateConditions = [];

    if (startDate) {
      const start = new Date(startDate);

      if (isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid start date",
        });
      }

      dateConditions.push({
        endTime: { $gte: start },
      });
    }

    if (endDate) {
      const end = new Date(endDate);

      if (isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid end date",
        });
      }

      dateConditions.push({
        startTime: { $lte: end },
      });
    }

    if (dateConditions.length > 0) {
      filter.$and = dateConditions;
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be after end date",
      });
    }

    const total = await Session.countDocuments(filter);

    const sessions = await Session.find(filter)
      .populate("expo", "title category startDate endDate")
      .populate("speakers", "name designation company photo")
      .sort({ startTime: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const sessionIds = sessions.map((session) => session._id);
    const registrationCounts = sessionIds.length
      ? await SessionRegistration.aggregate([
          { $match: { session: { $in: sessionIds }, status: "registered", type: "register" } },
          { $group: { _id: "$session", count: { $sum: 1 } } }
        ])
      : [];
    const countBySession = new Map(registrationCounts.map((item) => [item._id.toString(), item.count]));
    const sessionsWithCounts = sessions.map((session) => ({
      ...session.toObject(),
      registeredCount: countBySession.get(session._id.toString()) || 0
    }));

    return res.status(200).json({
      success: true,
      count: sessions.length,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      sessions: sessionsWithCounts,
    });

  } catch (error) {
    console.error("Get Sessions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET SINGLE SESSION
const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Session ID",
      });
    }

    const filter = { _id: id };

    if (req.user?.role !== "admin") {
      filter.status = "published";
    }

    const session = await Session.findOne(filter)
      .populate("expo", "title category startDate endDate status")
      .populate("speakers", "name designation company photo");

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Public users cannot view Sessions
// belonging to unpublished Expos
if (
  req.user?.role !== "admin" &&
  session.expo?.status !== "published"
) {
  return res.status(404).json({
    success: false,
    message: "Session not found",
  });
}

    return res.status(200).json({
      success: true,
      session,
    });

  } catch (error) {
    console.error("Get Session Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE SESSION — Admin Only
const updateSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Session ID",
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    const previousSchedule = {
      title: session.title,
      room: session.room,
      startTime: session.startTime?.getTime(),
      endTime: session.endTime?.getTime(),
      status: session.status,
    };

    const allowedFields = [
      "expo",
      "title",
      "description",
      "category",
      "speakers",
      "room",
      "startTime",
      "endTime",
      "capacity",
      "status",
    ];

    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    const finalExpoId = updateData.expo || session.expo;

    if (!mongoose.isValidObjectId(finalExpoId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Expo ID",
      });
    }

    const expoExists = await Expo.findById(finalExpoId);

    if (!expoExists) {
      return res.status(404).json({
        success: false,
        message: "Expo not found",
      });
    }

    const finalStartTime =
      updateData.startTime || session.startTime;

    const finalEndTime =
      updateData.endTime || session.endTime;

    const dateCheck = validateSessionDates(
      finalStartTime,
      finalEndTime,
      expoExists
    );

    if (!dateCheck.valid) {
      return res.status(400).json({
        success: false,
        message: dateCheck.message,
      });
    }

    const finalRoom = updateData.room ?? session.room;

    if (
      typeof finalRoom !== "string" ||
      !finalRoom.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Session room is required",
      });
    }

    const finalSpeakers =
      updateData.speakers !== undefined
        ? updateData.speakers
        : session.speakers.map(speaker => speaker.toString());

    const speakerCheck = await validateSpeakers(finalSpeakers);

    if (!speakerCheck.valid) {
      return res.status(400).json({
        success: false,
        message: speakerCheck.message,
      });
    }

    if (updateData.capacity !== undefined && updateData.capacity !== null) {
      const capacity = Number(updateData.capacity);

      if (!Number.isInteger(capacity) || capacity < 1) {
        return res.status(400).json({
          success: false,
          message: "Capacity must be a positive integer",
        });
      }

      updateData.capacity = capacity;
    }

    const finalStatus = updateData.status ?? session.status;

    // Cancelled sessions do not block rooms or speakers
    if (finalStatus !== "cancelled") {
      const conflict = await checkScheduleConflicts({
        expoId: finalExpoId,
        room: finalRoom.trim(),
        startTime: dateCheck.start,
        endTime: dateCheck.end,
        speakers: speakerCheck.speakers,
        excludeSessionId: id,
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          message: conflict,
        });
      }
    }

    updateData.expo = finalExpoId;
    updateData.startTime = dateCheck.start;
    updateData.endTime = dateCheck.end;
    updateData.room = finalRoom.trim();
    updateData.speakers = speakerCheck.speakers;

    session.set(updateData);

    await session.save();

    emitExpoDataUpdated(req, "session_updated", session.expo, session._id);

    const scheduleChanged = previousSchedule.title !== session.title ||
      previousSchedule.room !== session.room ||
      previousSchedule.startTime !== session.startTime?.getTime() ||
      previousSchedule.endTime !== session.endTime?.getTime();
    if (session.status === "cancelled" && previousSchedule.status !== "cancelled") {
      await notifySessionParticipants(session, "session_cancelled", "Session cancelled", `${session.title} has been cancelled.`, req.app.get("io"));
    } else if (scheduleChanged) {
      await notifySessionParticipants(session, "session_update", "Session schedule updated", `${session.title} is now scheduled for ${formatExpoDateTime(session.startTime, expoExists.timezone || "Asia/Karachi")} in ${session.room} (${expoExists.timezone || "Asia/Karachi"}).`, req.app.get("io"));
    }

    return res.status(200).json({
      success: true,
      message: "Session updated successfully",
      session,
    });

  } catch (error) {
    console.error("Update Session Error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE SESSION — Admin Only
const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Session ID",
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    if (session.status !== "cancelled") {
      session.status = "cancelled";
      await session.save();
      emitExpoDataUpdated(req, "session_cancelled", session.expo, session._id);
      await notifySessionParticipants(session, "session_cancelled", "Session cancelled", `${session.title} has been cancelled by the organizer.`, req.app.get("io"));
    }

    return res.status(200).json({
      success: true,
      message: "Session cancelled. Registration history has been preserved.",
    });

  } catch (error) {
    console.error("Delete Session Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createSession,
  getAllSessions,
  getSessionById,
  updateSession,
  deleteSession,
};
