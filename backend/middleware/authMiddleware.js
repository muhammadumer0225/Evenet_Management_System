const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const userId = decoded.id || decoded.userId || decoded._id;
  if (!userId) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  let currentUser;
  try {
    // Resolve current account state and role on every authenticated request.
    // This immediately revokes access after suspension, deletion or role changes,
    // even when a previously issued access token has not expired yet.
    currentUser = await User.findById(userId).select("_id role status name email");
  } catch (error) {
    console.error("Authentication account lookup failed:", error.message);
    return res.status(503).json({ message: "Authentication service temporarily unavailable" });
  }

  if (!currentUser) {
    return res.status(401).json({ message: "Account no longer exists" });
  }
  if (currentUser.status === "suspended") {
    return res.status(403).json({ message: "This account has been suspended" });
  }

  req.user = {
    ...decoded,
    id: currentUser._id.toString(),
    role: currentUser.role,
    name: currentUser.name,
    email: currentUser.email,
  };
  return next();
};

module.exports = { authMiddleware };