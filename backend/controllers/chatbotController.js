const { generateReply, getChatbotStatus, ChatbotError } = require("../services/chatbotService");

const getChatStatus = (req, res) => {
  return res.status(200).json({ success: true, ...getChatbotStatus() });
};

const sendChat = async (req, res) => {
  const maxChars = Number(process.env.CHATBOT_MAX_MESSAGE_CHARS) || 1000;
  const maxHistory = Number(process.env.CHATBOT_MAX_HISTORY) || 10;
  const { message, history } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ success: false, message: "Message is required." });
  }
  if (message.length > maxChars) {
    return res.status(400).json({ success: false, message: `Message must be ${maxChars} characters or fewer.` });
  }
  if (history !== undefined && !Array.isArray(history)) {
    return res.status(400).json({ success: false, message: "History must be an array." });
  }

  const cleanHistory = [];
  for (const item of (history || []).slice(-maxHistory)) {
    if (
      item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string" &&
      item.content.trim()
    ) {
      cleanHistory.push({ role: item.role, content: item.content.trim().slice(0, maxChars) });
    }
  }
  // Conversations sent to the provider must begin with a user turn.
  while (cleanHistory.length && cleanHistory[0].role !== "user") cleanHistory.shift();

  const role = req.chatUser?.role || "guest";

  try {
    const reply = await generateReply({ role, message: message.trim(), history: cleanHistory });
    return res.status(200).json({ success: true, reply, role });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Chatbot controller error:", error.message);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
};

module.exports = { sendChat, getChatStatus };