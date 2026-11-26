const jwt = require("jsonwebtoken");
const User = require("../models/User");

const VALID_ROLES = ["admin", "exhibitor", "attendee"];

// Optional authentication for the chatbot.
// - No token, bad token, unknown user or suspended user => treated as "guest" (public guidance only).
// - Valid token => role is read from the database, never trusted from the token payload.
// The existing authMiddleware.js is not touched.
const chatbotAuth = async (req, res, next) => {
  req.chatUser = { role: "guest" };

  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) return next();

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("role status");
    if (user && user.status !== "suspended" && VALID_ROLES.includes(user.role)) {
      req.chatUser = { role: user.role };
    }
  } catch (error) {
    // Invalid/expired token or lookup failure: stay a guest (least access).
  }

  return next();
};

module.exports = { chatbotAuth };