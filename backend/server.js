const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { startSessionReminderScheduler } = require("./services/sessionReminderScheduler");
const jwt = require("jsonwebtoken");

const connectDB = require("./config/db")
const authRoutes = require("./routes/authRoutes");
const expoRoutes = require("./routes/expoRoutes");
const boothRoutes = require("./routes/boothRoutes");
const imageRoutes = require("./routes/imageRoutes");
const exhibitorRoutes = require("./routes/exhibitorRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const speakerRoutes = require("./routes/speakerRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const expoRegistrationRoutes = require("./routes/expoRegistrationRoutes");
const sessionRegistrationRoutes = require("./routes/sessionRegistrationRoutes");
const attendeeRoutes = require("./routes/attendeeRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const messageRoutes = require("./routes/messageRoutes");
const chatbotRoutes = require("./routes/chatbotRoutes");
const accountRoutes = require("./routes/accountRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const adminActivityRoutes = require("./routes/adminActivityRoutes");
const applicationDocumentRoutes = require("./routes/applicationDocumentRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const { securityHeaders } = require("./middleware/securityMiddleware");
const { sanitizeInput } = require("./middleware/sanitizeInput");
const app = express();
app.set('trust proxy', 1);

// HTTP Server
const httpServer = http.createServer(app);

// Allow the configured frontend origin(s) in both development and deployment.
// FRONTEND_URL accepts a comma-separated list, matching the project README.
const configuredFrontendOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const frontendOrigins = configuredFrontendOrigins.length
  ? configuredFrontendOrigins
  : ["http://localhost:5173"];

// Socket.IO Setup
const io = new Server(httpServer, {
  cors: {
    origin: frontendOrigins,
    methods: ["GET", "POST"],
  },
});

// Socket Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error("Invalid authentication token"));
  }
});

// Socket Connection
io.on("connection", (socket) => {
  console.log("Authenticated socket connected");

  socket.join(`user:${socket.user.id}`);
  // Clients explicitly subscribe to either the global update stream or one Expo.
  // The room name is derived server-side; clients cannot join arbitrary rooms.
  socket.on("subscribe-expo-updates", (requestedExpoId) => {
    if (requestedExpoId === null || requestedExpoId === undefined || requestedExpoId === "") {
      socket.join("expo-updates");
      return;
    }

    const expoId = String(requestedExpoId);
    if (/^[a-f0-9]{24}$/i.test(expoId)) {
      socket.join(`expo:${expoId}`);
    }
  });

  socket.on("unsubscribe-expo-updates", (requestedExpoId) => {
    if (requestedExpoId === null || requestedExpoId === undefined || requestedExpoId === "") {
      socket.leave("expo-updates");
      return;
    }

    const expoId = String(requestedExpoId);
    if (/^[a-f0-9]{24}$/i.test(expoId)) {
      socket.leave(`expo:${expoId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("Authenticated socket disconnected");
  });
});

// Make Socket.IO accessible in controllers
app.set("io", io);

// 1. Baseline security headers for API and static responses
app.use(securityHeaders);

// 2. CORS Middleware
app.use(cors({
  origin: frontendOrigins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// 3. JSON parsing and request-body sanitization
app.use(express.json());
app.use(sanitizeInput);

// 4. Auth Routes
app.use("/api/auth", authRoutes);

// 4. Expo Routes
app.use("/api/expos", expoRoutes);

// 5. Booth Routes
app.use("/api/booths", boothRoutes);

// 6. Exhibitor Routes
app.use("/api/exhibitors", exhibitorRoutes);

// 7. Image Upload Routes
app.use("/api/images", imageRoutes);

// 8. Application Routes
app.use("/api", applicationRoutes);

// 9. Notification Routes
app.use("/api/notifications", notificationRoutes);

//10. Speaker Management Routes
app.use("/api/speakers", speakerRoutes);

//11.  Session Management Routes
app.use("/api/sessions", sessionRoutes);

//12.  ExpoRegistration Route
app.use("/api/expo-registrations", expoRegistrationRoutes);

app.use("/api/payments", paymentRoutes);

//13. SessionRegistration Route
app.use("/api/session-registrations", sessionRegistrationRoutes);

//14. GetAllFetch Route
app.use("/api/attendees", attendeeRoutes);

//15. GetAnalytics Route
app.use("/api/analytics", analyticsRoutes);

//16. Announcement Route
app.use("/api/announcements", announcementRoutes);

//17. Feedbcak Route
app.use("/api/feedback", feedbackRoutes);

//18. Message Route
app.use("/api/messages", messageRoutes);


app.use("/api/application-documents", applicationDocumentRoutes);

app.use("/api/account", accountRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/activity", adminActivityRoutes);


app.use("/api/chatbot", chatbotRoutes);

// Serve uploaded images
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))

);





// Test route
app.get("/", (req, res) => {
  res.send("EventSphere API is running");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "EventSphere API is healthy",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// Start server
const startServer = async () => {
  await connectDB();
  startSessionReminderScheduler(io);

  const PORT = process.env.PORT || 5000;

  httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Socket.IO is ready");
});
};

startServer();

