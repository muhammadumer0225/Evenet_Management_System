import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildExhibitorAnalyticsCsv } from '../src/utils/exhibitorAnalyticsCsv.js';

 test('CSV export includes summary, booth rows, and daily engagement', () => {
  const csv = buildExhibitorAnalyticsCsv({
    summary: { totalVisits: 12, uniqueAttendees: 9 },
    booths: [{ expo: { title: 'Tech Expo' }, boothNumber: 'A-01', status: 'occupied', visits: 12, uniqueVisitors: 9 }],
    dailyVisits: [{ date: '2026-11-24', visits: 12, uniqueVisitors: 9 }],
  });
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Summary"/);
  assert.match(csv, /"Tech Expo","A-01","occupied"/);
  assert.match(csv, /"Daily".*"2026-11-24"/);
});

test('CSV export escapes quotes and prevents spreadsheet formula injection', () => {
  const csv = buildExhibitorAnalyticsCsv({
    booths: [{ expo: { title: '=HYPERLINK("https://bad")' }, boothNumber: 'A,"01"', visits: 1 }],
  });
  assert.match(csv, /'=HYPERLINK\(""https:\/\/bad""\)/);
  assert.match(csv, /"A,""01"""/);
});

test('exhibitor analytics page exposes a privacy-safe CSV download action', () => {
  const page = readFileSync(new URL('../src/pages/exhibitor/ExhibitorAnalytics.jsx', import.meta.url), 'utf8');
  assert.match(page, /buildExhibitorAnalyticsCsv/);
  assert.match(page, /eventsphere-my-booth-analytics\.csv/);
  assert.match(page, /Export CSV/);
  assert.doesNotMatch(page, /attendee\.email|attendee\.name|ticketCode/);
});
