const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { chatbotAuth } = require("../middleware/chatbotAuth");
const { sendChat, getChatStatus } = require("../controllers/chatbotController");

const router = express.Router();

// Stricter than the global API limiter because every request can cost AI usage.
const chatbotLimiter = rateLimit({
  windowMs: Number(process.env.CHATBOT_RATE_WINDOW_MS) || 10 * 60 * 1000,
  limit: Number(process.env.CHATBOT_RATE_LIMIT) || 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many chat messages. Please wait a few minutes and try again." },
});

const statusLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.get("/status", statusLimiter, chatbotAuth, getChatStatus);
router.post("/", chatbotLimiter, chatbotAuth, sendChat);

module.exports = router;