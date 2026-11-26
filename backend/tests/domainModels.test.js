const test = require("node:test");
const assert = require("node:assert/strict");

let mongoose;
let ExpoRegistration;
let SessionRegistration;
let Booth;
let Notification;
let Application;
let Expo;
let Message;
let Feedback;
try {
  mongoose = require("mongoose");
  ExpoRegistration = require("../models/ExpoRegistration");
  SessionRegistration = require("../models/SessionRegistration");
  Booth = require("../models/Booth");
  Notification = require("../models/Notification");
  Application = require("../models/Application");
  Expo = require("../models/Expo");
  Message = require("../models/Message");
  Feedback = require("../models/Feedback");
} catch (error) {
  test("domain model tests require backend dependencies", { skip: "Run npm ci in backend to install mongoose" }, () => {});
}

if (mongoose && ExpoRegistration && SessionRegistration && Booth && Notification && Application && Expo && Message && Feedback) {
  const oid = () => new mongoose.Types.ObjectId();

  test("expo registration creates a ticket code and free standard defaults", async () => {
    const registration = new ExpoRegistration({ expo: oid(), attendee: oid() });
    await registration.validate();
    assert.match(registration.ticketCode, /^ES-[A-F0-9]{10}$/);
    assert.equal(registration.ticketTier, "standard");
    assert.equal(registration.ticketPrice, 0);
    assert.equal(registration.paymentStatus, "free");
    assert.equal(registration.checkedInAt, null);
    assert.equal(registration.checkedInBy, null);
  });

  test("expo registration refund defaults are safe", async () => {
    const registration = new ExpoRegistration({ expo: oid(), attendee: oid() });
    await registration.validate();
    assert.equal(registration.refund.amount, 0);
    assert.equal(registration.refund.status, "not_applicable");
  });

  test("expo registration rejects an unsupported ticket tier", async () => {
    const registration = new ExpoRegistration({ expo: oid(), attendee: oid(), ticketTier: "gold" });
    await assert.rejects(registration.validate(), (error) => error.name === "ValidationError");
  });

  test("Expo initializes a non-negative registered counter", async () => {
    const expo = new Expo({
      title: "Test Expo",
      description: "A test Expo description",
      category: "Technology",
      startDate: new Date("2027-01-01T00:00:00Z"),
      endDate: new Date("2027-01-02T00:00:00Z"),
      location: { venue: "Test Hall", city: "Karachi" },
      organizer: oid(),
    });
    await expo.validate();
    assert.equal(expo.registeredCount, 0);
  });

  test("session registration supports both registration and bookmark types", async () => {
    for (const type of ["register", "bookmark"]) {
      const registration = new SessionRegistration({ session: oid(), attendee: oid(), type });
      await registration.validate();
      assert.equal(registration.type, type);
    }
  });

  test("booth rejects unsupported statuses and negative prices", async () => {
    const booth = new Booth({ expo: oid(), boothNumber: "A-01", size: "3x3", price: -1, status: "sold" });
    await assert.rejects(booth.validate(), (error) => error.name === "ValidationError");
  });

  test("application accepts an optional booth assignment and pending status", async () => {
    const application = new Application({ expo: oid(), exhibitor: oid(), exhibitorProfile: oid(), preferredBoothSize: "M" });
    await application.validate();
    assert.equal(application.status, "pending");
    assert.equal(application.booth, null);
  });

  test("feedback can be linked to an Expo registration", async () => {
    const feedback = new Feedback({
      attendee: oid(),
      expo: oid(),
      type: "suggestion",
      subject: "More seating",
      comment: "Please add more seating near the main stage."
    });
    await feedback.validate();
    assert.ok(feedback.expo);
    assert.equal(feedback.status, "open");
  });

  test("message model tracks delivered and read timestamps", async () => {
    const message = new Message({ from: oid(), to: oid(), text: "Hello 👋" });
    await message.validate();
    assert.equal(message.read, false);
    assert.equal(message.deliveredAt, null);
    assert.equal(message.readAt, null);
  });

  test("notification schema accepts persistent session and application events", async () => {
    for (const type of ["new_application", "new_announcement", "feedback_update", "application_approved", "application_rejected", "session_reminder", "session_update", "session_cancelled"]) {
      const notification = new Notification({ recipient: oid(), type, title: "EventSphere update", message: "A useful update" });
      await notification.validate();
      assert.equal(notification.type, type);
    }
  });
}
