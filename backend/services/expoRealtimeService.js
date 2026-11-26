/** Broadcast lightweight signals; clients refetch authoritative API data. */
const emitExpoDataUpdated = (req, type, expoId, entityId = null) => {
  try {
    const io = req?.app?.get?.("io");
    if (!io || !expoId) return;

    const event = {
      type,
      expoId: String(expoId),
      entityId: entityId ? String(entityId) : null,
      updatedAt: new Date().toISOString(),
    };

    // Expo-specific subscribers receive only updates for their selected Expo.
    io.to(`expo:${String(expoId)}`).emit("expo-data-updated", event);
    // Global subscribers (e.g. Home and Admin Insights) refresh aggregate data.
    io.to("expo-updates").emit("expo-data-updated", event);
  } catch (error) {
    // Realtime delivery must never turn a successful database operation into a failed API response.
    console.error("Expo realtime broadcast failed:", error.message);
  }
};

module.exports = { emitExpoDataUpdated };
