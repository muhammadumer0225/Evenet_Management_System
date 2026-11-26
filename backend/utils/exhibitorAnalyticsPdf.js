const cleanText = (value, max = 52) => {
  const text = value == null ? "" : String(value);
  return text
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/[\\()]/g, "\\$&")
    .slice(0, max);
};

const textAt = (x, y, value, size = 10) =>
  `BT /F1 ${size} Tf ${x} ${y} Td (${cleanText(value)}) Tj ET`;

const drawBarChart = ({ title, items, x, y, width, height, labelKey, valueKey, maxItems = 10 }) => {
  const commands = [textAt(x, y + height + 28, title, 12)];
  const visible = (items || []).slice(-maxItems);
  if (!visible.length) {
    commands.push(textAt(x, y + height / 2, "No recorded visits yet", 10));
    return commands;
  }
  const maxValue = Math.max(1, ...visible.map((item) => Number(item[valueKey]) || 0));
  const slot = width / visible.length;
  const barWidth = Math.max(8, Math.min(28, slot * 0.58));
  commands.push("0.75 G 0.5 w", `${x} ${y} m ${x + width} ${y} l S`, "0.25 g");
  visible.forEach((item, index) => {
    const value = Math.max(0, Number(item[valueKey]) || 0);
    const barHeight = value ? Math.max(2, (value / maxValue) * height) : 0;
    const barX = x + index * slot + (slot - barWidth) / 2;
    if (barHeight) commands.push(`${barX.toFixed(2)} ${y} ${barWidth.toFixed(2)} ${barHeight.toFixed(2)} re f`);
    commands.push(textAt(barX - 2, y + barHeight + 6, value, 8));
    const label = item[labelKey] || "";
    commands.push(textAt(x + index * slot, y - 14, label, 7));
  });
  return commands;
};

const createPdf = (content) => {
  const objects = [];
  const add = (value) => { objects.push(value); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const stream = content.join("\n");
  const streamId = add(`<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
  const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`);
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
};

const toExhibitorAnalyticsPdf = ({ summary = {}, booths = [], dailyVisits = [] } = {}) => {
  const commands = ["q", "0 g", textAt(40, 752, "EventSphere - My Booth Engagement Report", 17), textAt(40, 732, `Generated: ${new Date().toISOString()}`, 8)];
  commands.push(textAt(40, 694, `Recorded visits: ${summary.totalVisits || 0}`, 12));
  commands.push(textAt(235, 694, `Unique attendees: ${summary.uniqueAttendees || 0}`, 12));
  commands.push(textAt(430, 694, `Assigned booths: ${summary.assignedBooths || 0}`, 12));
  commands.push(...drawBarChart({ title: "Recorded visits by booth (top 10)", items: booths.slice(0, 10).map((item) => ({ label: item.boothNumber, visits: item.visits })), x: 45, y: 505, width: 520, height: 105, labelKey: "label", valueKey: "visits", maxItems: 10 }));
  commands.push(...drawBarChart({ title: "Daily recorded visits (latest 12 days)", items: dailyVisits.slice(-12).map((item) => ({ label: item.date, visits: item.visits })), x: 45, y: 300, width: 520, height: 105, labelKey: "label", valueKey: "visits", maxItems: 12 }));
  commands.push(textAt(40, 240, "Booth summary", 12));
  commands.push(textAt(40, 220, "Expo / Booth", 9), textAt(300, 220, "Status", 9), textAt(390, 220, "Visits", 9), textAt(470, 220, "Unique", 9));
  let rowY = 202;
  booths.slice(0, 12).forEach((booth) => {
    commands.push(textAt(40, rowY, `${booth.expo?.title || "Expo"} / ${booth.boothNumber || "-"}`, 8));
    commands.push(textAt(300, rowY, booth.status || "-", 8));
    commands.push(textAt(390, rowY, booth.visits || 0, 8));
    commands.push(textAt(470, rowY, booth.uniqueVisitors || 0, 8));
    rowY -= 13;
  });
  if (!booths.length) commands.push(textAt(40, 200, "No assigned booths found for this account.", 9));
  commands.push(textAt(40, 34, "Privacy: aggregate only; attendee details excluded.", 7));
  commands.push(textAt(40, 22, "Scan-based counts; not a physical footfall counter.", 7), "Q");
  return createPdf(commands);
};

module.exports = { toExhibitorAnalyticsPdf };
