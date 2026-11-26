const test = require("node:test");
const assert = require("node:assert/strict");
const { toPdf } = require("../utils/pdf");

test("PDF export creates a valid PDF document with report content", () => {
  const pdf = toPdf("EventSphere test report", ["Name", "Count"], [["Expo One", 3]]);
  const text = pdf.toString("ascii");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.includes("EventSphere test report"));
  assert.ok(text.includes("Expo One | 3"));
  assert.ok(text.endsWith("%%EOF"));
});

test("PDF export paginates long reports", () => {
  const rows = Array.from({ length: 100 }, (_, i) => [`Expo ${i + 1}`, i]);
  const text = toPdf("Large report", ["Name", "Count"], rows).toString("ascii");
  assert.match(text, /\/Count 3/);
});
