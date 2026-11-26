
const express = require("express");
const router = express.Router();

const {
  getMessageContacts,
  getMyConversations,
  getConversation,
  sendMessage,
  deleteMessage,
  clearConversationMessages,
  hideConversation,
  markConversationRead,
} = require("../controllers/messageController");

const { authMiddleware } = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/contacts", getMessageContacts);
router.get("/conversations", getMyConversations);
router.get("/conversation/:userId", getConversation);
router.post("/", sendMessage);
router.delete("/:messageId", deleteMessage);
router.delete("/conversation/:userId/messages", clearConversationMessages);
router.delete("/conversation/:userId", hideConversation);
router.patch("/conversation/:userId/read", markConversationRead);

module.exports = router;
