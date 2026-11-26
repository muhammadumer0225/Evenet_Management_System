const test = require("node:test");
const assert = require("node:assert/strict");
const { PUBLIC_EXPO_STATUSES, isPublicExpoStatus } = require("../utils/publicVisibility");

test("public expo status policy allows published, ongoing and completed expos", () => {
  assert.deepEqual(PUBLIC_EXPO_STATUSES, ["published", "ongoing", "completed"]);
  for (const status of PUBLIC_EXPO_STATUSES) assert.equal(isPublicExpoStatus(status), true);
  assert.equal(isPublicExpoStatus("draft"), false);
  assert.equal(isPublicExpoStatus("cancelled"), false);
});
