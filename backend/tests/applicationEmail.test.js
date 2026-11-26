const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../controllers/applicationController.js"), "utf8");

test("application decision email includes Expo schedule, venue, booth and next steps", () => {
  assert.match(source, /Daily Expo hours:/);
  assert.match(source, /Expo dates:/);
  assert.match(source, /Venue:/);
  assert.match(source, /Assigned booth:/);
  assert.match(source, /NEXT STEPS/);
  assert.match(source, /Organizer remarks:/);
});

test("application responses populate Expo timezone and booth zone fields", () => {
  assert.match(source, /startTime endTime timezone registrationDeadline location/);
  assert.match(source, /boothNumber zone size price status/);
});

test('application submission, approval and rejection broadcast Expo updates for connected dashboards', () => {
  assert.match(source, /emitExpoDataUpdated\(req, "application_submitted", expo\._id, application\._id\)/);
  assert.match(source, /emitExpoDataUpdated\(req, "application_approved", application\.expo\?\._id \|\| application\.expo, application\._id\)/);
  assert.match(source, /emitExpoDataUpdated\(req, "application_rejected", application\.expo\?\._id \|\| application\.expo, application\._id\)/);
});
