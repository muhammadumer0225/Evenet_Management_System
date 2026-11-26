const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const seedSource = fs.readFileSync(
  path.join(__dirname, "../scripts/seedDemo.js"),
  "utf8"
);

test("demo content seed never creates, updates, or deletes user accounts", () => {
  assert.match(seedSource, /User\.findOne\(\{\s*role:\s*["']admin["']/);
  assert.doesNotMatch(seedSource, /User\.(?:create|insertMany|findOneAndUpdate|updateOne|updateMany|deleteOne|deleteMany)\s*\(/);
  assert.doesNotMatch(seedSource, /bcrypt|SEED_DEMO_PASSWORD|upsertUser/);
});

test("demo content seed uses insert-only upserts for seeded content", () => {
  assert.match(seedSource, /\$setOnInsert/);
  assert.match(seedSource, /User accounts, roles, passwords and profile records were not created, updated or deleted/);
});
