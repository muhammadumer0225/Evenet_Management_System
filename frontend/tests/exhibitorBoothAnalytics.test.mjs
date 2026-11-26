import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('exhibitor analytics route and navigation are role-specific', () => {
  const app = read('../src/App.jsx');
  const layout = read('../src/components/Layouts.jsx');
  assert.match(app, /path="booth-analytics" element=\{<ByRole exhibitor=\{ExhibitorAnalytics\} \/>\}/);
  assert.match(layout, /\['\/dashboard\/booth-analytics', 'Booth analytics'/);
});

test('exhibitor analytics page displays aggregate booth engagement and realtime refresh', () => {
  const page = read('../src/pages/exhibitor/ExhibitorAnalytics.jsx');
  assert.match(page, /getMyBoothAnalytics/);
  assert.match(page, /useExpoRealtimeVersion/);
  assert.match(page, /Unique attendees/);
  assert.match(page, /Daily booth engagement/);
  assert.match(page, /not automatic physical footfall/);
});
