const AdminActivity = require("../models/AdminActivity");

// Activity logging must never cause an otherwise successful business action to fail.
const recordAdminActivity = async ({ req, action, entityType, entityId, expo, expoTitle, description }) => {
  try {
    if (req?.user?.role !== "admin") return;

    await AdminActivity.create({
      actor: req.user.id || null,
      actorName: req.user.name || "Administrator",
      action,
      entityType,
      entityId: entityId ? String(entityId) : "",
      expo: expo || null,
      expoTitle: expoTitle || "",
      description,
    });
  } catch (error) {
    console.error("Admin activity could not be recorded:", error.message);
  }
};

module.exports = { recordAdminActivity };
