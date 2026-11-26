const test = require("node:test");
const assert = require("node:assert/strict");

let mongoose;
let Notification;
try {
  mongoose = require("mongoose");
  Notification = require("../models/Notification");
} catch (error) {
  test("notification model validation tests require backend dependencies", { skip: "Run npm ci in backend to install mongoose" }, () => {});
}

if (mongoose && Notification) {
  test("new_message notification validates with recipient, title and message", async () => {
    const notification = new Notification({
      recipient: new mongoose.Types.ObjectId(),
      sender: new mongoose.Types.ObjectId(),
      type: "new_message",
      title: "New message from Test User",
      message: "Hello",
      link: "/dashboard/messages?to=123",
    });
    await assert.doesNotReject(notification.validate());
    assert.equal(notification.isRead, false);
  });

  test("notification rejects unsupported type", async () => {
    const notification = new Notification({
      recipient: new mongoose.Types.ObjectId(),
      type: "unknown_type",
      title: "Test",
      message: "Test",
    });
    await assert.rejects(notification.validate(), (error) => error.name === "ValidationError");
  });

  test("notification requires recipient, type, title and message", async () => {
    const notification = new Notification({});
    await assert.rejects(notification.validate(), (error) => {
      assert.ok(error.errors.recipient);
      assert.ok(error.errors.type);
      assert.ok(error.errors.title);
      assert.ok(error.errors.message);
      return error.name === "ValidationError";
    });
  });
}
