const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("exhibitor profile schema stores tagline and LinkedIn URL", () => {
  const model = read("models/ExhibitorProfile.js");
  assert.match(model, /tagline:\s*\{/);
  assert.match(model, /linkedin:\s*\{/);
});

test("create, update and public exhibitor profile responses include tagline and LinkedIn", () => {
  const controller = read("controllers/exhibitorController.js");
  assert.match(controller, /const \{[\s\S]*?tagline,[\s\S]*?linkedin,[\s\S]*?\} = req\.body/);
  assert.match(controller, /"tagline"/);
  assert.match(controller, /"linkedin"/);
  assert.match(controller, /companyName description tagline linkedin industry website logo contactPhone address productsServices staff/);
});
