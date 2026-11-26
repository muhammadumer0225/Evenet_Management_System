import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/Overview.jsx', import.meta.url), 'utf8');

test('Admin overview loads dashboard and per-Expo analytics from protected API helpers', () => {
  const admin = page.slice(page.indexOf('function AdminOverview()'), page.indexOf('function ExhibitorOverview()'));
  assert.match(admin, /getDashboardAnalytics\(\)/);
  assert.match(admin, /getExpoAnalytics\(\)/);
  assert.match(admin, /Promise\.allSettled/);
  assert.doesNotMatch(admin, /db\.(expos|users|registrations|booths)/);
});

test('Admin overview reviews real pending applications through backend approve/reject actions', () => {
  const admin = page.slice(page.indexOf('function AdminOverview()'), page.indexOf('function ExhibitorOverview()'));
  assert.match(admin, /getAllApplications\(\{ status: 'pending'/);
  assert.match(admin, /approveExhibitorApplication\(id\)/);
  assert.match(admin, /rejectExhibitorApplication\(id/);
  assert.doesNotMatch(admin, /decideApplication/);
});

test('Admin overview loads and renders the persistent admin activity feed', () => {
  const admin = page.slice(page.indexOf('function AdminOverview()'), page.indexOf('function ExhibitorOverview()'));
  assert.match(admin, /getAdminActivities\(8\)/);
  assert.match(admin, /Recent admin activity/);
  assert.match(admin, /activity\.description/);
  assert.match(admin, /activity\.createdAt/);
  assert.doesNotMatch(admin, /db\.activity/);
});

test('admin activity API helper requests the protected persistent feed', () => {
  const api = fs.readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8');
  assert.match(api, /export async function getAdminActivities\(limit = 8\)/);
  assert.match(api, /\/api\/admin\/activity\?limit=/);
  assert.match(api, /return data\.activities \|\| \[\]/);
});
