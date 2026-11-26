const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("booth visit model enforces one attendee visit per booth and Expo", () => {
  const model = read("models/BoothVisit.js");
  assert.match(model, /expo:\s*\{/);
  assert.match(model, /booth:\s*\{/);
  assert.match(model, /attendee:\s*\{/);
  assert.match(model, /registration:\s*\{/);
  assert.match(model, /recordedBy:\s*\{/);
  assert.match(model, /boothVisitSchema\.index\(\{ expo: 1, booth: 1, attendee: 1 \}, \{ unique: true \}\)/);
});

test("booth visit endpoint requires an active checked-in attendee from the same Expo", () => {
  const controller = read("controllers/boothVisitController.js");
  assert.match(controller, /expo:\s*booth\.expo/);
  assert.match(controller, /registration\.status !== "registered"/);
  assert.match(controller, /!\["free", "paid"\]\.includes\(registration\.paymentStatus\)/);
  assert.match(controller, /if \(!registration\.checkedInAt\)/);
  assert.match(controller, /error\.code === 11000/);
  assert.match(controller, /emitExpoDataUpdated\(req, "booth_visit_recorded"/);
});

test("booth visit route is restricted to authenticated admins", () => {
  const routes = read("routes/boothRoutes.js");
  assert.match(routes, /router\.post\([\s\S]*?"\/:id\/visits"[\s\S]*?authMiddleware[\s\S]*?roleMiddleware\("admin"\)[\s\S]*?recordBoothVisit/);
});

test("Expo analytics includes booth traffic and daily engagement aggregates", () => {
  const analytics = read("controllers/analyticsController.js");
  assert.match(analytics, /boothTraffic:\s*\{/);
  assert.match(analytics, /uniqueAttendees:/);
  assert.match(analytics, /dailyVisits:/);
  assert.match(analytics, /Booth visitors/);
});
