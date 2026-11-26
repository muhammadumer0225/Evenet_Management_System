const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Attach an authenticated user when a valid bearer token is present, but keep
// public read endpoints public when no token is supplied.
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return next();
    const token = header.slice(7).trim();
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("name email role status consent");
    if (user && user.status !== "suspended") {
      req.user = { ...decoded, id: String(user._id), name: user.name, email: user.email, role: user.role, consent: user.consent };
    }
    return next();
  } catch {
    return next();
  }
};

module.exports = optionalAuthMiddleware;
