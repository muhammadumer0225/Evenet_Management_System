const test = require("node:test");
const assert = require("node:assert/strict");
const { escapeCsvCell, toCsv } = require("../utils/csv");

test("CSV cells quote commas, quotes, and newlines safely", () => {
  assert.equal(escapeCsvCell('A,"B"\nC'), '"A,""B""\nC"');
});

test("CSV export neutralizes spreadsheet formula injection", () => {
  assert.equal(escapeCsvCell("=HYPERLINK(\"https://bad\")"), "\"'=HYPERLINK(\"\"https://bad\"\")\"");
  assert.equal(escapeCsvCell("  @SUM(A1:A2)"), "\"'  @SUM(A1:A2)\"");
  assert.equal(escapeCsvCell(-42), "\"-42\"");
});

test("CSV output includes UTF-8 BOM and CRLF rows", () => {
  const csv = toCsv(["Name", "Count"], [["Expo", 3]]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.equal(csv, "\uFEFF\"Name\",\"Count\"\r\n\"Expo\",\"3\"");
});
