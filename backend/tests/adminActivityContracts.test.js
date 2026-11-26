const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("admin activity feed is protected by authentication and admin role", () => {
  const routes = read("routes/adminActivityRoutes.js");
  assert.match(routes, /authMiddleware/);
  assert.match(routes, /roleMiddleware\("admin"\)/);
  assert.match(routes, /getAdminActivities/);
});

test("admin activity feed returns newest records with a bounded limit", () => {
  const controller = read("controllers/adminActivityController.js");
  assert.match(controller, /Math\.min\(Math\.max\(requestedLimit, 1\), 50\)/);
  assert.match(controller, /sort\(\{ createdAt: -1, _id: -1 \}\)/);
  assert.match(controller, /limit\(limit\)/);
  assert.match(controller, /populate\("actor", "name"\)/);
});

test("admin activity schema stores actor, action, entity and timestamp", () => {
  const model = read("models/AdminActivity.js");
  for (const field of ["actor", "actorName", "action", "entityType", "entityId", "expoTitle", "description"]) {
    assert.match(model, new RegExp(`${field}\\s*:`));
  }
  assert.match(model, /timestamps:\s*true/);
  assert.match(model, /createdAt:\s*-1/);
});

test("successful Expo, application and booth admin actions are recorded", () => {
  const expo = read("controllers/expoController.js");
  const applications = read("controllers/applicationController.js");
  const booths = read("controllers/boothController.js");
  assert.match(expo, /action: "expo_created"/);
  assert.match(expo, /action: "expo_updated"/);
  assert.match(expo, /action: "expo_deleted"/);
  assert.match(applications, /action: "application_approved"/);
  assert.match(applications, /action: "application_rejected"/);
  assert.match(booths, /action: "booth_assigned"/);
});

test("admin activity router is mounted at the expected API path", () => {
  const server = read("server.js");
  assert.match(server, /require\("\.\/routes\/adminActivityRoutes"\)/);
  assert.match(server, /app\.use\("\/api\/admin\/activity", adminActivityRoutes\)/);
});
