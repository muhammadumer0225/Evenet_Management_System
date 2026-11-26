const test = require("node:test");
const assert = require("node:assert/strict");
const { createTicketCode, isValidTicketCode } = require("../utils/ticketCode");

test("ticket codes are generated in the expected unique-looking format", () => {
  const first = createTicketCode();
  const second = createTicketCode();
  assert.match(first, /^ES-[A-F0-9]{10}$/);
  assert.match(second, /^ES-[A-F0-9]{10}$/);
  assert.notEqual(first, second);
});

test("ticket code validation accepts case-insensitive valid codes only", () => {
  assert.equal(isValidTicketCode("es-a1b2c3d4e5"), true);
  assert.equal(isValidTicketCode("ES-123"), false);
  assert.equal(isValidTicketCode("ES-GGGGGGGGGG"), false);
  assert.equal(isValidTicketCode(null), false);
});
