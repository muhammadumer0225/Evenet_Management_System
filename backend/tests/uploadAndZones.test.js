const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relativePath) => fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

test("image upload keeps the 5 MB image allowlist and stores files in the backend uploads folder", () => {
  const middleware = read("middleware/uploadMiddleware.js");
  assert.match(middleware, /image\/jpeg/);
  assert.match(middleware, /image\/png/);
  assert.match(middleware, /image\/webp/);
  assert.match(middleware, /5 \* 1024 \* 1024/);
  assert.match(middleware, /path\.join\(__dirname, "\.\.\/uploads"\)/);
});

test("image upload verifies file signatures and removes invalid uploads", () => {
  const route = read("routes/imageRoutes.js");
  assert.match(route, /fileTypeFromFile/);
  assert.match(route, /detected\.mime !== reportedMime/);
  assert.match(route, /fs\.promises\.unlink/);
});

test("Booth zone is persisted and included in Expo floor-plan responses", () => {
  const model = read("models/Booth.js");
  const controller = read("controllers/boothController.js");
  assert.match(model, /zone:\s*\{/);
  assert.match(controller, /zone: typeof zone === "string"/);
  assert.match(controller, /select\("boothNumber zone size price status exhibitor position"\)/);
});
