const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("admin check-in accepts an explicit registration ID and valid ticket code", () => {
  const controller = read("controllers/expoRegistrationController.js");
  assert.match(controller, /normalizedRegistrationId && mongoose\.Types\.ObjectId\.isValid\(normalizedRegistrationId\)/);
  assert.match(controller, /normalizedTicketCode && isValidTicketCode\(normalizedTicketCode\)/);
  assert.match(controller, /ticketCode: normalizedTicketCode\.toUpperCase\(\)/);
});

test("admin check-in supports legacy clients that send a Mongo ID in the ticketCode field", () => {
  const controller = read("controllers/expoRegistrationController.js");
  assert.match(controller, /!normalizedRegistrationId && normalizedTicketCode && mongoose\.Types\.ObjectId\.isValid\(normalizedTicketCode\)/);
});

test("ticket migration changes only missing Expo registration ticket codes", () => {
  const migration = read("scripts/migrateTicketCodes.js");
  assert.match(migration, /ExpoRegistration\.find\(/);
  assert.match(migration, /process\.argv\.includes\("--apply"\)/);
  assert.match(migration, /Dry run only/);
  assert.match(migration, /\$set:\s*\{\s*ticketCode\s*\}/);
  assert.doesNotMatch(migration, /SessionRegistration|Expo\.find|registeredCount/);
});
