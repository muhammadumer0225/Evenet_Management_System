const escapeCsvCell = (value) => {
  const text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  // Prevent spreadsheet formula injection for untrusted text cells.
  const safe = typeof value === "string" && /^[\s]*[=+@\-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const toCsv = (headers, rows) => {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}`;
};

module.exports = { escapeCsvCell, toCsv };
