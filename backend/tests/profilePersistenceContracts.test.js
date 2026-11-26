const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("signup and signin return persisted profile fields needed after a fresh login", () => {
  const auth = read("controllers/authController.js");
  for (const field of ["phone", "company", "bio", "interests", "consent"]) {
    assert.match(auth, new RegExp(`${field}: user\\.${field} \\|\\|`));
  }
});

test("profile updates persist allowed fields and return the saved user", () => {
  const account = read("controllers/accountController.js");
  assert.match(account, /const allowed = \["name", "email", "phone", "company", "bio", "interests", "consent"\]/);
  assert.match(account, /findByIdAndUpdate\(req\.user\.id, \{ \$set: updates \}, \{ returnDocument: "after", runValidators: true \}\)/);
  assert.match(account, /return res\.json\(\{ success: true, user \}\)/);
});
