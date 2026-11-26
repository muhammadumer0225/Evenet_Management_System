const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("exhibitor booth analytics PDF route requires authentication and exhibitor role", () => {
  const routes = read("routes/exhibitorRoutes.js");
  assert.match(routes, /\"\/me\/booth-analytics\/report\.pdf\"\s*,\s*authMiddleware\s*,\s*roleMiddleware\(\"exhibitor\"\)\s*,\s*exportMyBoothAnalyticsPdf/s);
});

test("exhibitor PDF export scopes booths to the current user and returns a downloadable PDF", () => {
  const controller = read("controllers/exhibitorAnalyticsController.js");
  assert.match(controller, /const exportMyBoothAnalyticsPdf = async/);
  assert.match(controller, /exhibitor:\s*req\.user\.id/);
  assert.match(controller, /toExhibitorAnalyticsPdf\(/);
  assert.match(controller, /Content-Type\", \"application\/pdf\"/);
  assert.match(controller, /eventsphere-my-booth-analytics\.pdf/);
  assert.doesNotMatch(controller, /attendee\.email|attendee\.name|registrationCode|ticketCode/);
});

test("exhibitor analytics page exposes a PDF download action", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "pages", "exhibitor", "ExhibitorAnalytics.jsx"), "utf8");
  assert.match(page, /Export PDF/);
  assert.match(page, /downloadMyBoothAnalyticsPdf/);
});

test("exhibitor PDF contains summary, booth and daily bar-chart content", () => {
  const { toExhibitorAnalyticsPdf } = require("../utils/exhibitorAnalyticsPdf");
  const pdf = toExhibitorAnalyticsPdf({
    summary: { totalVisits: 8, uniqueAttendees: 6, assignedBooths: 2 },
    booths: [
      { expo: { title: "Tech Expo" }, boothNumber: "A-01", status: "occupied", visits: 5, uniqueVisitors: 4 },
      { expo: { title: "Tech Expo" }, boothNumber: "A-02", status: "reserved", visits: 3, uniqueVisitors: 2 },
    ],
    dailyVisits: [{ date: "2026-11-23", visits: 8, uniqueVisitors: 6 }],
  });
  const source = pdf.toString("ascii");
  assert.ok(source.startsWith("%PDF-1.4"));
  assert.match(source, /Recorded visits by booth/);
  assert.match(source, /Daily recorded visits/);
  assert.match(source, /Tech Expo \/ A-01/);
  assert.match(source, /Unique attendees: 6/);
  assert.match(source, /re f/); // vector bars are drawn into the PDF
  assert.match(source, /attendee details excluded/);
});
