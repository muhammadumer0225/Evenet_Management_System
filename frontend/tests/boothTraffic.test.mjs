import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8');

test('admin can record booth visits using the verified ticket endpoint', () => {
  const api = read('../src/lib/api.js');
  const ops = read('../src/pages/admin/AdminOps.jsx');
  assert.match(api, /\/api\/booths\/\$\{encodeURIComponent\(boothId\)\}\/visits/);
  assert.match(ops, /export function AdminBoothVisits\(\)/);
  assert.match(ops, /recordBoothVisitApi\(boothId, \{ \.\.\.payload, source \}\)/);
  assert.match(ops, /TicketScanner/);
});

test('booth visit screen is registered in admin navigation', () => {
  const app = read('../src/App.jsx');
  const layout = read('../src/components/Layouts.jsx');
  assert.match(app, /path="booth-visits" element=\{<ByRole admin=\{AdminBoothVisits\} \/>\}/);
  assert.match(layout, /\/dashboard\/booth-visits.*Booth visitor check-in/);
});

test('admin analytics displays booth engagement and refreshes on realtime updates', () => {
  const page = read('../src/pages/admin/AdminInsights.jsx');
  assert.match(page, /useExpoRealtimeVersion/);
  assert.match(page, /Recorded booth visits/);
  assert.match(page, /Unique Expo attendees visiting booths/);
  assert.match(page, /Daily booth engagement/);
  assert.match(page, /topBooths/);
});
