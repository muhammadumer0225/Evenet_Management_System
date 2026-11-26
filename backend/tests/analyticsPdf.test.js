const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relativePath) => fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

test("Expo analytics PDF route is restricted to authenticated admins", () => {
  const routes = read("routes/analyticsRoutes.js");
  assert.match(routes, /"\/expos\/:expoId\/report\.pdf"\s*,\s*authMiddleware\s*,\s*roleMiddleware\("admin"\)\s*,\s*getExpoAnalyticsPdf/s);
});

test("Expo analytics PDF controller sends a downloadable PDF response", () => {
  const controller = read("controllers/analyticsController.js");
  assert.match(controller, /const getExpoAnalyticsPdf = async/);
  assert.match(controller, /toPdf\(/);
  assert.match(controller, /Content-Type", "application\/pdf"/);
  assert.match(controller, /Content-Disposition"/);
  assert.match(controller, /getExpoAnalyticsPdf,/);
});


test("Expo analytics includes timezone-aware registration trends and ticket/payment breakdowns", () => {
  const controller = read("controllers/analyticsController.js");
  assert.match(controller, /registrationTrendRows/);
  assert.match(controller, /dateToString: \{ format: "%Y-%m-%d", date: "\$registeredAt", timezone: expo\.timezone/);
  assert.match(controller, /ticketTierRows/);
  assert.match(controller, /paymentRows/);
  assert.match(controller, /paymentBreakdown:/);
});
