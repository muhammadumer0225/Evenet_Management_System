
const User = require("../models/User");
const Expo = require("../models/Expo");
const Booth = require("../models/Booth");
const BoothVisit = require("../models/BoothVisit");
const Session = require("../models/Session");
const ExpoRegistration = require("../models/ExpoRegistration");
const SessionRegistration = require("../models/SessionRegistration");
const Application = require("../models/Application");
const ExhibitorProfile = require("../models/ExhibitorProfile");
const mongoose = require("mongoose");
const { toPdf } = require("../utils/pdf");

// Admin Dashboard Analytics
const getDashboardAnalytics = async (req, res) => {
  try {
    const [
      totalExpos,
      totalAttendees,
      totalExhibitors,
      totalSessions,
      totalBooths,
      activeExpoRegistrations,
      activeSessionRegistrations
    ] = await Promise.all([
      Expo.countDocuments(),
      User.countDocuments({ role: "attendee" }),
      User.countDocuments({ role: "exhibitor" }),
      Session.countDocuments(),
      Booth.countDocuments(),
      ExpoRegistration.countDocuments({ status: "registered" }),
      SessionRegistration.countDocuments({ status: "registered" })
    ]);

    res.status(200).json({
      success: true,
      analytics: {
        totalExpos,
        totalAttendees,
        totalExhibitors,
        totalSessions,
        totalBooths,
        activeExpoRegistrations,
        activeSessionRegistrations
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard analytics",
      error: error.message
    });
  }
};



const getExpoAnalytics = async (req, res) => {
  try {
    const expos = await Expo.find().select("title status startDate endDate timezone").lean();
    const analytics = await Promise.all(expos.map(async (expo) => {
      const [
        registrations,
        activeRegistrations,
        cancelledRegistrations,
        totalBooths,
        boothStatusRows,
        totalSessions,
        sessionRows,
        checkInRows,
        industryRows,
        registrationTrendRows,
        ticketTierRows,
        paymentRows,
        boothVisitRows,
        uniqueAttendeeRows,
        boothDailyRows
      ] = await Promise.all([
        ExpoRegistration.countDocuments({ expo: expo._id }),
        ExpoRegistration.countDocuments({ expo: expo._id, status: "registered" }),
        ExpoRegistration.countDocuments({ expo: expo._id, status: "cancelled" }),
        Booth.countDocuments({ expo: expo._id }),
        Booth.aggregate([{ $match: { expo: expo._id } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
        Session.countDocuments({ expo: expo._id }),
        Session.aggregate([
          { $match: { expo: expo._id } },
          { $lookup: { from: "sessionregistrations", localField: "_id", foreignField: "session", as: "registrations" } },
          { $project: { title: 1, category: 1, status: 1, registeredCount: { $size: { $filter: { input: "$registrations", as: "r", cond: { $and: [{ $eq: ["$$r.status", "registered"] }, { $eq: ["$$r.type", "register"] }] } } } } } },
          { $sort: { registeredCount: -1, title: 1 } }, { $limit: 8 }
        ]),
        ExpoRegistration.aggregate([
          { $match: { expo: expo._id, status: "registered", checkedInAt: { $ne: null } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$checkedInAt", timezone: expo.timezone || "Asia/Karachi" } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]),
        ExhibitorProfile.aggregate([
          {
            $lookup: {
              from: "applications",
              let: { userId: "$user" },
              pipeline: [{ $match: { $expr: { $and: [
                { $eq: ["$exhibitor", "$$userId"] },
                { $eq: ["$expo", expo._id] },
                { $eq: ["$status", "approved"] }
              ] } } }],
              as: "approvedApplications"
            }
          },
          { $match: { "approvedApplications.0": { $exists: true } } },
          { $group: { _id: "$industry", count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }
        ]),
        ExpoRegistration.aggregate([
          { $match: { expo: expo._id, status: { $in: ["registered", "cancelled"] } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$registeredAt", timezone: expo.timezone || "Asia/Karachi" } }, registrations: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ["$status", "registered"] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } } } },
          { $sort: { _id: 1 } }
        ]),
        ExpoRegistration.aggregate([
          { $match: { expo: expo._id } },
          { $group: { _id: "$ticketTier", count: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ["$status", "registered"] }, 1, 0] } } } },
          { $sort: { _id: 1 } }
        ]),
        ExpoRegistration.aggregate([
          { $match: { expo: expo._id } },
          { $group: { _id: "$paymentStatus", count: { $sum: 1 }, amountPaid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$ticketPrice", 0] } }, refundedAmount: { $sum: "$refund.amount" } } },
          { $sort: { _id: 1 } }
        ]),
        BoothVisit.aggregate([
          { $match: { expo: expo._id } },
          { $group: { _id: "$booth", uniqueVisitors: { $sum: 1 }, visits: { $sum: 1 }, lastVisitAt: { $max: "$visitedAt" } } },
          { $lookup: { from: "booths", localField: "_id", foreignField: "_id", as: "booth" } },
          { $unwind: "$booth" },
          { $project: { _id: 0, boothId: "$booth._id", boothNumber: "$booth.boothNumber", exhibitorId: "$booth.exhibitor", uniqueVisitors: 1, visits: 1, lastVisitAt: 1 } },
          { $sort: { uniqueVisitors: -1, boothNumber: 1 } }
        ]),
        BoothVisit.aggregate([
          { $match: { expo: expo._id } },
          { $group: { _id: "$attendee" } },
          { $count: "count" }
        ]),
        BoothVisit.aggregate([
          { $match: { expo: expo._id } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$visitedAt", timezone: expo.timezone || "Asia/Karachi" } }, visits: { $sum:  1 } } },
          { $sort: { _id: 1 } }
        ])
      ]);

      const boothStatus = { available: 0, reserved: 0, occupied: 0, blocked: 0 };
      boothStatusRows.forEach((row) => { if (Object.hasOwn(boothStatus, row._id)) boothStatus[row._id] = row.count; });

      return {
        expo,
        totalRegistrations: registrations,
        activeRegistrations,
        cancelledRegistrations,
        totalBooths,
        boothStatus,
        totalSessions,
        dailyAttendance: checkInRows.map((row) => ({ date: row._id, checkIns: row.count })),
        registrationTrend: registrationTrendRows.map((row) => ({ date: row._id, registrations: row.registrations, active: row.active, cancelled: row.cancelled })),
        ticketTiers: ticketTierRows.map((row) => ({ tier: row._id || "standard", count: row.count, active: row.active })),
        paymentBreakdown: paymentRows.map((row) => ({ status: row._id || "unknown", count: row.count, amountPaid: row.amountPaid, refundedAmount: row.refundedAmount })),
        popularSessions: sessionRows,
        exhibitorsByIndustry: industryRows.map((row) => ({ industry: row._id || "Other", count: row.count })),
        boothTraffic: {
          totalVisits: boothVisitRows.reduce((sum, row) => sum + row.visits, 0),
          uniqueAttendees: uniqueAttendeeRows[0]?.count || 0,
          topBooths: boothVisitRows.slice(0, 10),
          dailyVisits: boothDailyRows.map((row) => ({ date: row._id, visits: row.visits }))
        }
      };
    }));

    res.status(200).json({ success: true, count: analytics.length, analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch Expo analytics", error: error.message });
  }
};

const getExpoAnalyticsPdf = async (req, res) => {
  try {
    const { expoId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(expoId)) {
      return res.status(400).json({ success: false, message: "Invalid Expo ID" });
    }

    const expo = await Expo.findById(expoId).select("title status startDate endDate timezone").lean();
    if (!expo) {
      return res.status(404).json({ success: false, message: "Expo not found" });
    }

    const [
      totalRegistrations,
      activeRegistrations,
      cancelledRegistrations,
      totalBooths,
      boothStatusRows,
      totalSessions,
      popularSessions,
      checkInRows,
      industryRows,
      registrationTrendRows,
      ticketTierRows,
      paymentRows,
      boothVisitRows,
      uniqueAttendeeRows,
      boothDailyRows,
    ] = await Promise.all([
      ExpoRegistration.countDocuments({ expo: expo._id }),
      ExpoRegistration.countDocuments({ expo: expo._id, status: "registered" }),
      ExpoRegistration.countDocuments({ expo: expo._id, status: "cancelled" }),
      Booth.countDocuments({ expo: expo._id }),
      Booth.aggregate([
        { $match: { expo: expo._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Session.countDocuments({ expo: expo._id }),
      Session.aggregate([
        { $match: { expo: expo._id } },
        { $lookup: { from: "sessionregistrations", localField: "_id", foreignField: "session", as: "registrations" } },
        { $project: {
          title: 1,
          registeredCount: {
            $size: {
              $filter: {
                input: "$registrations",
                as: "registration",
                cond: {
                  $and: [
                    { $eq: ["$$registration.status", "registered"] },
                    { $eq: ["$$registration.type", "register"] },
                  ],
                },
              },
            },
          },
        } },
        { $sort: { registeredCount: -1, title: 1 } },
        { $limit: 10 },
      ]),
      ExpoRegistration.aggregate([
        { $match: { expo: expo._id, status: "registered", checkedInAt: { $ne: null } } },
        { $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$checkedInAt",
              timezone: expo.timezone || "Asia/Karachi",
            },
          },
          count: { $sum: 1 },
        } },
        { $sort: { _id: 1 } },
      ]),
      ExhibitorProfile.aggregate([
        { $lookup: {
          from: "applications",
          let: { userId: "$user" },
          pipeline: [{ $match: { $expr: { $and: [
            { $eq: ["$exhibitor", "$$userId"] },
            { $eq: ["$expo", expo._id] },
            { $eq: ["$status", "approved"] },
          ] } } }],
          as: "approvedApplications",
        } },
        { $match: { "approvedApplications.0": { $exists: true } } },
        { $group: { _id: "$industry", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      ExpoRegistration.aggregate([
        { $match: { expo: expo._id, status: { $in: ["registered", "cancelled"] } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$registeredAt", timezone: expo.timezone || "Asia/Karachi" } }, registrations: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ["$status", "registered"] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } } } },
        { $sort: { _id: 1 } },
      ]),
      ExpoRegistration.aggregate([
        { $match: { expo: expo._id } },
        { $group: { _id: "$ticketTier", count: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ["$status", "registered"] }, 1, 0] } } } },
        { $sort: { _id: 1 } },
      ]),
      ExpoRegistration.aggregate([
        { $match: { expo: expo._id } },
        { $group: { _id: "$paymentStatus", count: { $sum: 1 }, amountPaid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$ticketPrice", 0] } }, refundedAmount: { $sum: "$refund.amount" } } },
        { $sort: { _id: 1 } },
      ]),
      BoothVisit.aggregate([
        { $match: { expo: expo._id } },
        { $group: { _id: "$booth", uniqueVisitors: { $sum: 1 } } },
        { $lookup: { from: "booths", localField: "_id", foreignField: "_id", as: "booth" } },
        { $unwind: "$booth" },
        { $project: { boothNumber: "$booth.boothNumber", uniqueVisitors: 1 } },
        { $sort: { uniqueVisitors: -1, boothNumber: 1 } },
      ]),
      BoothVisit.aggregate([
        { $match: { expo: expo._id } },
        { $group: { _id: "$attendee" } },
        { $count: "count" },
      ]),
      BoothVisit.aggregate([
        { $match: { expo: expo._id } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$visitedAt", timezone: expo.timezone || "Asia/Karachi" } }, visits: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const boothStatuses = { available: 0, reserved: 0, occupied: 0, blocked: 0 };
    boothStatusRows.forEach(({ _id, count }) => {
      if (Object.hasOwn(boothStatuses, _id)) boothStatuses[_id] = count;
    });

    const rows = [
      ["Expo", expo.title, ""],
      ["Expo status", expo.status, ""],
      ["Expo dates", `${new Date(expo.startDate).toISOString().slice(0, 10)} to ${new Date(expo.endDate).toISOString().slice(0, 10)}`, ""],
      ["Registrations", "Total", totalRegistrations],
      ["Registrations", "Active", activeRegistrations],
      ["Registrations", "Cancelled", cancelledRegistrations],
      ["Booths", "Total", totalBooths],
      ...Object.entries(boothStatuses).map(([status, count]) => ["Booths", status, count]),
      ["Sessions", "Total", totalSessions],
      ...popularSessions.map((session) => ["Popular sessions", session.title, session.registeredCount]),
      ...registrationTrendRows.map((row) => ["Registration trend", row._id, `Total ${row.registrations}; Active ${row.active}; Cancelled ${row.cancelled}`]),
      ...ticketTierRows.map((row) => ["Ticket tier", row._id || "standard", `Total ${row.count}; Active ${row.active}`]),
      ...paymentRows.map((row) => ["Payment summary", row._id || "unknown", `Tickets ${row.count}; Paid PKR ${row.amountPaid}; Refunded PKR ${row.refundedAmount}`]),
      ...checkInRows.map((row) => ["Daily check-ins", row._id, row.count]),
      ["Booth traffic", "Total recorded visits", boothVisitRows.reduce((sum, row) => sum + row.uniqueVisitors, 0)],
      ["Booth traffic", "Unique Expo attendees", uniqueAttendeeRows[0]?.count || 0],
      ...boothVisitRows.map((row) => ["Booth visitors", row.boothNumber, row.uniqueVisitors]),
      ...boothDailyRows.map((row) => ["Daily booth visits", row._id, row.visits]),
      ...industryRows.map((row) => ["Approved exhibitors by industry", row._id || "Other", row.count]),
    ];

    const pdf = toPdf(`EventSphere Analytics Report - ${expo.title}`, ["Category", "Metric", "Value"], rows);
    const safeTitle = expo.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "expo";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="eventsphere-${safeTitle}-report.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(pdf);
  } catch (error) {
    console.error("Expo analytics PDF export failed:", error);
    return res.status(500).json({ success: false, message: "Failed to export Expo analytics PDF" });
  }
};


const getRegistrationAnalytics = async (req, res) => {
  try {
    const [
      totalExpoRegistrations,
      activeExpoRegistrations,
      cancelledExpoRegistrations,
      totalSessionRegistrations,
      activeSessionRegistrations,
      cancelledSessionRegistrations
    ] = await Promise.all([
      ExpoRegistration.countDocuments(),
      ExpoRegistration.countDocuments({ status: "registered" }),
      ExpoRegistration.countDocuments({ status: "cancelled" }),

      SessionRegistration.countDocuments(),
      SessionRegistration.countDocuments({ status: "registered" }),
      SessionRegistration.countDocuments({ status: "cancelled" })
    ]);

    res.status(200).json({
      success: true,
      analytics: {
        expoRegistrations: {
          total: totalExpoRegistrations,
          active: activeExpoRegistrations,
          cancelled: cancelledExpoRegistrations
        },
        sessionRegistrations: {
          total: totalSessionRegistrations,
          active: activeSessionRegistrations,
          cancelled: cancelledSessionRegistrations
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch registration analytics",
      error: error.message
    });
  }
};




const getExhibitorAnalytics = async (req, res) => {
  try {
    const [
      totalExhibitors,
      totalProfiles,
      totalApplications,
      pendingApplications,
      approvedApplications,
      rejectedApplications
    ] = await Promise.all([
      User.countDocuments({ role: "exhibitor" }),
      ExhibitorProfile.countDocuments(),
      Application.countDocuments(),
      Application.countDocuments({ status: "pending" }),
      Application.countDocuments({ status: "approved" }),
      Application.countDocuments({ status: "rejected" })
    ]);

    res.status(200).json({
      success: true,
      analytics: {
        totalExhibitors,
        totalProfiles,
        applications: {
          total: totalApplications,
          pending: pendingApplications,
          approved: approvedApplications,
          rejected: rejectedApplications
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch exhibitor analytics",
      error: error.message
    });
  }
};



module.exports = {
  getDashboardAnalytics,
  getExpoAnalytics,
  getExpoAnalyticsPdf,
  getRegistrationAnalytics,
  getExhibitorAnalytics
};
