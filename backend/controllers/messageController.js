
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const Notification = require("../models/Notification");
const Conversation = require("../models/Conversation");

const conversationPair = (first, second) => {
  const ids = [String(first), String(second)].sort();
  return { userA: ids[0], userB: ids[1] };
};

const canMessage = async (sender, receiverId) => {
  if (!mongoose.Types.ObjectId.isValid(receiverId)) return false;

  const receiver = await User.findById(receiverId).select("_id role status");

  if (!receiver || receiver.status === "suspended" || receiver._id.toString() === sender.id) {
    return false;
  }

  if (sender.role === "admin") return true;

  if (receiver.role === "admin" || receiver.role === "exhibitor") {
    return true;
  }

  if (sender.role === "exhibitor" && receiver.role === "attendee") {
    const existing = await Message.exists({
      $or: [
        { from: sender.id, to: receiverId },
        { from: receiverId, to: sender.id },
      ],
    });

    return !!existing;
  }

  return false;
};

// Get users available for messaging
const getMessageContacts = async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user.id },
      status: { $ne: "suspended" },
    }).select("name email role company phone profileImage");

    const contacts = [];

    for (const user of users) {
      if (await canMessage(req.user, user._id.toString())) {
        contacts.push(user);
      }
    }

    return res.status(200).json({
      success: true,
      contacts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to load message contacts",
      error: error.message,
    });
  }
};

// Get conversation list
const getMyConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const hiddenThreads = await Conversation.find({
      $or: [{ userA: userId }, { userB: userId }],
      hiddenFor: userId,
    }).lean();
    const hiddenOtherIds = new Set(hiddenThreads.map((thread) => String(thread.userA) === userId ? String(thread.userB) : String(thread.userA)));
    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }],
      hiddenFor: { $ne: userId },
    }).sort({ createdAt: -1 });

    const conversations = new Map();
    for (const message of messages) {
      const otherId = message.from.toString() === userId ? message.to.toString() : message.from.toString();
      if (hiddenOtherIds.has(otherId)) continue;
      if (!conversations.has(otherId)) conversations.set(otherId, { other: otherId, last: message, unread: 0 });
      if (message.to.toString() === userId && !message.read) conversations.get(otherId).unread += 1;
    }

    // Conversation records preserve an empty thread after a user clears its messages.
    const savedThreads = await Conversation.find({
      $or: [{ userA: userId }, { userB: userId }],
      hiddenFor: { $ne: userId },
    }).lean();
    for (const thread of savedThreads) {
      const otherId = String(thread.userA) === userId ? String(thread.userB) : String(thread.userA);
      if (!conversations.has(otherId)) conversations.set(otherId, { other: otherId, last: null, unread: 0 });
    }

    const ids = [...conversations.keys()];
    const users = await User.find({ _id: { $in: ids } }).select("name email role company phone profileImage");
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const result = [...conversations.values()]
      .filter((conversation) => userMap.has(conversation.other))
      .map((conversation) => ({ ...conversation, user: userMap.get(conversation.other) }));

    return res.status(200).json({ success: true, conversations: result });
  } catch (error) {
    console.error("Load conversations failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load conversations" });
  }
};

// Get messages with a particular user
const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;

    const allowed = await canMessage(req.user, userId);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You cannot message this user",
      });
    }

    const messages = await Message.find({
      $or: [
        { from: req.user.id, to: userId },
        { from: userId, to: req.user.id },
      ],
      hiddenFor: { $ne: req.user.id },
    }).sort({ createdAt: 1 });

    const undelivered = messages.filter((message) =>
      message.from.toString() === userId &&
      message.to.toString() === req.user.id &&
      !message.deliveredAt
    );
    if (undelivered.length) {
      const deliveredAt = new Date();
      await Message.updateMany(
        { _id: { $in: undelivered.map((message) => message._id) }, deliveredAt: null },
        { $set: { deliveredAt } }
      );
      const io = req.app.get("io");
      for (const message of undelivered) {
        io?.to(`user:${userId}`).emit("message-status", {
          messageId: message._id,
          deliveredAt,
          read: Boolean(message.read),
          readAt: message.readAt || null,
        });
      }
    }

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to load conversation",
      error: error.message,
    });
  }
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { to, text, kind = "text", meta = {} } = req.body;

    if (!to || !text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Recipient and message text are required",
      });
    }

    if (!["text", "contact", "appointment"].includes(kind)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message type",
      });
    }

    if (text.trim().length > 3000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 3000 characters",
      });
    }

    const allowed = await canMessage(req.user, to);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You cannot message this user",
      });
    }

    const pair = conversationPair(req.user.id, to);
    await Conversation.findOneAndUpdate(pair, {
      $setOnInsert: pair,
      $pull: { hiddenFor: { $in: [req.user.id, to] } },
    }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });

    const message = await Message.create({
      from: req.user.id,
      to,
      text: text.trim(),
      kind,
      meta,
    });

    const io = req.app.get("io");
    const recipientOnline = Boolean(io?.sockets?.adapter?.rooms?.get(`user:${to}`)?.size);
    if (recipientOnline) {
      message.deliveredAt = new Date();
      await message.save();
    }

    // A notification failure must not turn an already-persisted message into
    // an apparent send failure (which can cause the client to retry duplicates).
    let notification = null;
    try {
      notification = await Notification.create({
        recipient: to,
        type: "new_message",
        title: `New message from ${req.user.name}`,
        message: text.trim(),
        sender: req.user.id,
        link: `/messages?to=${req.user.id}`,
      });
    } catch (notificationError) {
      console.error("Message notification creation failed:", notificationError.message);
    }

    // Deliver the persisted message even if the separate notification record
    // could not be created.
    io?.to(`user:${to}`).emit("new-message", message);
    if (notification) {
      io?.to(`user:${to}`).emit("new-notification", notification);
    }
    if (message.deliveredAt) {
      io?.to(`user:${req.user.id}`).emit("message-status", {
        messageId: message._id,
        deliveredAt: message.deliveredAt,
        read: false,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error.message,
    });
  }
};

// Delete one message for the current user or for both participants.
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { scope = "me" } = req.body || {};
    if (!mongoose.isValidObjectId(messageId)) return res.status(400).json({ success: false, message: "Invalid message ID" });
    if (!["me", "everyone"].includes(scope)) return res.status(400).json({ success: false, message: "Delete scope must be me or everyone" });
    const message = await Message.findOne({ _id: messageId, $or: [{ from: req.user.id }, { to: req.user.id }] });
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });

    const pair = conversationPair(message.from, message.to);
    await Conversation.findOneAndUpdate(pair, { $setOnInsert: pair }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
    const io = req.app.get("io");
    if (scope === "everyone") {
      // Only the sender may retract a message for all participants.
      if (String(message.from) !== String(req.user.id)) return res.status(403).json({ success: false, message: "Only the sender can delete this message for everyone" });
      const participants = [String(message.from), String(message.to)];
      await Message.deleteOne({ _id: message._id });
      for (const participant of participants) io?.to(`user:${participant}`).emit("message-deleted", { messageId: String(message._id), scope: "everyone" });
    } else {
      await Message.updateOne({ _id: message._id }, { $addToSet: { hiddenFor: req.user.id } });
      io?.to(`user:${req.user.id}`).emit("message-deleted", { messageId: String(message._id), scope: "me" });
    }
    return res.json({ success: true, message: scope === "everyone" ? "Message deleted for everyone" : "Message deleted for you" });
  } catch (error) {
    console.error("Delete message failed:", error);
    return res.status(500).json({ success: false, message: "Unable to delete message" });
  }
};

// Clear only this user's visible history while preserving the conversation entry.
const clearConversationMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId) || String(userId) === String(req.user.id)) return res.status(400).json({ success: false, message: "Invalid conversation user" });
    const allowed = await canMessage(req.user, userId);
    if (!allowed) return res.status(403).json({ success: false, message: "You cannot access this conversation" });
    const pair = conversationPair(req.user.id, userId);
    await Conversation.findOneAndUpdate(pair, { $setOnInsert: pair }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
    await Message.updateMany({ $or: [{ from: req.user.id, to: userId }, { from: userId, to: req.user.id }] }, { $addToSet: { hiddenFor: req.user.id } });
    return res.json({ success: true, message: "Your conversation messages were cleared" });
  } catch (error) {
    console.error("Clear conversation failed:", error);
    return res.status(500).json({ success: false, message: "Unable to clear conversation" });
  }
};

// Hide the selected chat from this user's conversation list only.
const hideConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId) || String(userId) === String(req.user.id)) return res.status(400).json({ success: false, message: "Invalid conversation user" });
    const pair = conversationPair(req.user.id, userId);
    await Conversation.findOneAndUpdate(pair, { $setOnInsert: pair, $addToSet: { hiddenFor: req.user.id } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
    return res.json({ success: true, message: "Chat removed from your conversation list" });
  } catch (error) {
    console.error("Hide conversation failed:", error);
    return res.status(500).json({ success: false, message: "Unable to remove chat" });
  }
};

// Mark conversation messages as read
const markConversationRead = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const readAt = new Date();
    const unreadMessages = await Message.find({
      from: userId,
      to: req.user.id,
      read: false,
    }).select("_id");

    await Message.updateMany(
      { from: userId, to: req.user.id, read: false },
      { $set: { read: true, readAt, deliveredAt: readAt } }
    );

    const io = req.app.get("io");
    for (const message of unreadMessages) {
      io?.to(`user:${userId}`).emit("message-status", {
        messageId: message._id,
        deliveredAt: readAt,
        read: true,
        readAt,
      });
    }
    io?.to(`user:${req.user.id}`).emit("conversation-read", { userId, unreadCount: 0 });

    return res.status(200).json({
      success: true,
      message: "Conversation marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to mark messages as read",
      error: error.message,
    });
  }
};

module.exports = {
  getMessageContacts,
  getMyConversations,
  getConversation,
  sendMessage,
  deleteMessage,
  clearConversationMessages,
  hideConversation,
  markConversationRead,
};
