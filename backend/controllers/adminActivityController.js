const AdminActivity = require("../models/AdminActivity");

const getAdminActivities = async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : 20;

    const activities = await AdminActivity.find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .select("actor actorName action entityType entityId expo expoTitle description createdAt")
      .populate("actor", "name")
      .lean();

    return res.status(200).json({ success: true, activities });
  } catch (error) {
    console.error("Get admin activities error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load admin activity feed" });
  }
};

module.exports = { getAdminActivities };
