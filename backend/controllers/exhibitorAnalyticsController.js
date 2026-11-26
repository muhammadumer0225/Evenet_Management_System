const Booth = require("../models/Booth");
const BoothVisit = require("../models/BoothVisit");
const { toExhibitorAnalyticsPdf } = require("../utils/exhibitorAnalyticsPdf");

const buildVisitDateMatch = (query = {}) => {
  const { from, to } = query;
  const isDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if ((from && !isDate(from)) || (to && !isDate(to))) {
    const error = new Error("Dates must use YYYY-MM-DD format");
    error.status = 400;
    throw error;
  }
  if (from && to && from > to) {
    const error = new Error("Start date cannot be after end date");
    error.status = 400;
    throw error;
  }
  const visitedAt = {};
  if (from) visitedAt.$gte = new Date(`${from}T00:00:00+05:00`);
  if (to) {
    const nextDay = new Date(`${to}T00:00:00+05:00`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    visitedAt.$lt = nextDay;
  }
  return Object.keys(visitedAt).length ? { visitedAt } : {};
};

// Exhibitors only receive aggregate engagement for booths assigned to their account.
// Attendee names, email addresses, registration IDs, and ticket codes are never returned.
const getMyBoothAnalytics = async (req, res) => {
  try {
    const dateMatch = buildVisitDateMatch(req.query);
    const booths = await Booth.find({
      exhibitor: req.user.id,
      status: { $in: ["reserved", "occupied"] },
    })
      .select("_id boothNumber status expo")
      .populate("expo", "title")
      .lean();

    if (!booths.length) {
      return res.status(200).json({
        success: true,
        analytics: {
          summary: { totalVisits: 0, uniqueAttendees: 0, assignedBooths: 0 },
          booths: [],
          dailyVisits: [],
        },
      });
    }

    const boothIds = booths.map((booth) => booth._id);
    const [result] = await BoothVisit.aggregate([
      { $match: { booth: { $in: boothIds }, ...dateMatch } },
      {
        $facet: {
          summary: [
            { $group: { _id: null, totalVisits: { $sum: 1 }, attendees: { $addToSet: "$attendee" } } },
            { $project: { _id: 0, totalVisits: 1, uniqueAttendees: { $size: "$attendees" } } },
          ],
          byBooth: [
            { $group: { _id: "$booth", visits: { $sum: 1 }, attendees: { $addToSet: "$attendee" } } },
            { $project: { visits: 1, uniqueVisitors: { $size: "$attendees" } } },
          ],
          daily: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$visitedAt", timezone: "Asia/Karachi" } },
                visits: { $sum: 1 },
                attendees: { $addToSet: "$attendee" },
              },
            },
            { $project: { _id: 0, date: "$_id", visits: 1, uniqueVisitors: { $size: "$attendees" } } },
            { $sort: { date: 1 } },
          ],
        },
      },
    ]);

    const boothStats = new Map((result?.byBooth || []).map((item) => [String(item._id), item]));
    const boothRows = booths.map((booth) => {
      const stats = boothStats.get(String(booth._id));
      return {
        boothId: String(booth._id),
        boothNumber: booth.boothNumber,
        status: booth.status,
        expo: { id: String(booth.expo?._id || booth.expo), title: booth.expo?.title || "Expo" },
        visits: stats?.visits || 0,
        uniqueVisitors: stats?.uniqueVisitors || 0,
      };
    }).sort((a, b) => b.visits - a.visits || a.boothNumber.localeCompare(b.boothNumber));

    return res.status(200).json({
      success: true,
      analytics: {
        summary: {
          totalVisits: result?.summary?.[0]?.totalVisits || 0,
          uniqueAttendees: result?.summary?.[0]?.uniqueAttendees || 0,
          assignedBooths: booths.length,
        },
        booths: boothRows,
        dailyVisits: result?.daily || [],
      },
    });
  } catch (error) {
    console.error("Exhibitor booth analytics error:", error);
    return res.status(error.status || 500).json({ success: false, message: error.message || "Unable to load booth analytics" });
  }
};

const exportMyBoothAnalyticsPdf = async (req, res) => {
  try {
    const dateMatch = buildVisitDateMatch(req.query);
    const booths = await Booth.find({
      exhibitor: req.user.id,
      status: { $in: ["reserved", "occupied"] },
    })
      .select("_id boothNumber status expo")
      .populate("expo", "title")
      .lean();

    const boothIds = booths.map((booth) => booth._id);
    let analytics = { summary: { totalVisits: 0, uniqueAttendees: 0, assignedBooths: booths.length }, booths: [], dailyVisits: [] };
    if (boothIds.length) {
      const [result] = await BoothVisit.aggregate([
        { $match: { booth: { $in: boothIds }, ...dateMatch } },
        {
          $facet: {
            totals: [
              { $group: { _id: null, visits: { $sum: 1 }, attendees: { $addToSet: "$attendee" } } },
              { $project: { _id: 0, visits: 1, uniqueAttendees: { $size: "$attendees" } } },
            ],
            byBooth: [
              { $group: { _id: "$booth", visits: { $sum: 1 }, attendees: { $addToSet: "$attendee" } } },
              { $project: { visits: 1, uniqueVisitors: { $size: "$attendees" } } },
            ],
            daily: [
              { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$visitedAt", timezone: "Asia/Karachi" } }, visits: { $sum: 1 }, attendees: { $addToSet: "$attendee" } } },
              { $project: { date: "$_id", visits: 1, uniqueVisitors: { $size: "$attendees" } } },
              { $sort: { date: 1 } },
            ],
          },
        },
      ]);
      const byBooth = new Map((result?.byBooth || []).map((item) => [String(item._id), item]));
      analytics = {
        summary: {
          totalVisits: result?.totals?.[0]?.visits || 0,
          uniqueAttendees: result?.totals?.[0]?.uniqueAttendees || 0,
          assignedBooths: booths.length,
        },
        booths: booths.map((booth) => {
          const stats = byBooth.get(String(booth._id)) || {};
          return {
            boothNumber: booth.boothNumber,
            status: booth.status,
            expo: { title: booth.expo?.title || "Expo" },
            visits: stats.visits || 0,
            uniqueVisitors: stats.uniqueVisitors || 0,
          };
        }).sort((a, b) => b.visits - a.visits || a.boothNumber.localeCompare(b.boothNumber)),
        dailyVisits: result?.daily || [],
      };
    }

    const pdf = toExhibitorAnalyticsPdf(analytics);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="eventsphere-my-booth-analytics.pdf"');
    res.setHeader("Cache-Control", "no-store");
    return res.send(pdf);
  } catch (error) {
    console.error("Exhibitor booth analytics PDF export error:", error);
    return res.status(error.status || 500).json({ success: false, message: error.message || "Unable to export booth analytics PDF" });
  }
};

module.exports = { getMyBoothAnalytics, exportMyBoothAnalyticsPdf };
