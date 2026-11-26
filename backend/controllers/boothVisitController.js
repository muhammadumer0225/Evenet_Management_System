const mongoose = require("mongoose");
const Booth = require("../models/Booth");
const ExpoRegistration = require("../models/ExpoRegistration");
const BoothVisit = require("../models/BoothVisit");
const { isValidTicketCode } = require("../utils/ticketCode");
const { emitExpoDataUpdated } = require("../services/expoRealtimeService");

const recordBoothVisit = async (req, res) => {
  try {
    const { id: boothId } = req.params;
    const { registrationId, ticketCode, source } = req.body || {};

    if (!mongoose.isValidObjectId(boothId)) {
      return res.status(400).json({ success: false, message: "Invalid Booth ID" });
    }
    if (!registrationId && !ticketCode) {
      return res.status(400).json({ success: false, message: "Registration ID or ticket code is required" });
    }

    let registrationLookup;
    if (ticketCode) {
      if (!isValidTicketCode(ticketCode)) {
        return res.status(400).json({ success: false, message: "Invalid ticket code" });
      }
      registrationLookup = { ticketCode: ticketCode.trim().toUpperCase() };
    } else if (mongoose.isValidObjectId(registrationId)) {
      registrationLookup = { _id: registrationId };
    } else {
      return res.status(400).json({ success: false, message: "Invalid registration ID" });
    }

    const booth = await Booth.findById(boothId).select("expo boothNumber exhibitor status");
    if (!booth) {
      return res.status(404).json({ success: false, message: "Booth not found" });
    }

    const registration = await ExpoRegistration.findOne({
      ...registrationLookup,
      expo: booth.expo,
    }).populate("attendee", "name email").populate("expo", "title");

    if (!registration) {
      return res.status(404).json({ success: false, message: "No registration was found for this booth's Expo" });
    }
    if (registration.status !== "registered" || !["free", "paid"].includes(registration.paymentStatus)) {
      return res.status(409).json({ success: false, message: "This Expo registration is not active or payment is incomplete" });
    }
    if (!registration.checkedInAt) {
      return res.status(409).json({ success: false, message: "Attendee must complete Expo check-in before a booth visit can be recorded" });
    }

    try {
      const visit = await BoothVisit.create({
        expo: booth.expo,
        booth: booth._id,
        attendee: registration.attendee._id,
        registration: registration._id,
        recordedBy: req.user.id,
        source: source === "ticket_scan" ? "ticket_scan" : "manual_entry",
      });

      emitExpoDataUpdated(req, "booth_visit_recorded", booth.expo, booth._id);
      return res.status(201).json({
        success: true,
        alreadyRecorded: false,
        message: "Booth visit recorded successfully",
        visit: {
          id: visit._id,
          booth: { id: booth._id, boothNumber: booth.boothNumber },
          expo: registration.expo,
          attendee: registration.attendee,
          visitedAt: visit.visitedAt,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        const existingVisit = await BoothVisit.findOne({ expo: booth.expo, booth: booth._id, attendee: registration.attendee._id }).select("visitedAt");
        return res.status(409).json({
          success: false,
          alreadyRecorded: true,
          message: "This attendee's visit to this booth has already been recorded",
          visitedAt: existingVisit?.visitedAt || null,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Booth visit recording failed:", error);
    return res.status(500).json({ success: false, message: "Unable to record booth visit" });
  }
};

module.exports = { recordBoothVisit };
