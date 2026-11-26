const PUBLIC_EXPO_STATUSES = Object.freeze(["published", "ongoing", "completed"]);
const isPublicExpoStatus = (status) => PUBLIC_EXPO_STATUSES.includes(status);

module.exports = { PUBLIC_EXPO_STATUSES, isPublicExpoStatus };
