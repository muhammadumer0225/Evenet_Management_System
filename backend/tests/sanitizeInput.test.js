const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeInput, sanitizeValue } = require("../middleware/sanitizeInput");

test("sanitizer removes Mongo operators, dotted keys and prototype-pollution keys recursively", () => {
  const input = JSON.parse('{"name":"A","$where":"bad","profile":{"safe":1,"a.b":2,"$gt":3},"__proto__":{"polluted":true}}');
  assert.deepEqual(sanitizeValue(input), { name: "A", profile: { safe: 1 } });
  assert.equal({}.polluted, undefined);
});

test("request middleware sanitizes body and continues", () => {
  const req = { body: { "$set": { role: "admin" }, name: "Umer" }, params: { id: "123" } };
  let continued = false;
  sanitizeInput(req, {}, () => { continued = true; });
  assert.deepEqual(req.body, { name: "Umer" });
  assert.deepEqual(req.params, { id: "123" });
  assert.equal(continued, true);
});
