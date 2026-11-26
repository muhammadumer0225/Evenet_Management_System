import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../src/pages/admin/AdminInsights.jsx', import.meta.url), 'utf8');

test('admin user API helpers use the protected database user endpoints', () => {
  assert.match(api, /getAdminUsersApi[\s\S]*?\/api\/admin\/users/);
  assert.match(api, /updateAdminUserStatusApi[\s\S]*?\/status/);
  assert.match(api, /updateAdminUserRoleApi[\s\S]*?\/role/);
  assert.match(api, /deleteAdminUserApi[\s\S]*?method: 'DELETE'/);
});

test('Admin Users page loads database users and exposes server-backed filters/actions', () => {
  assert.match(page, /getAdminUsersApi/);
  assert.match(page, /updateAdminUserStatusApi/);
  assert.match(page, /updateAdminUserRoleApi/);
  assert.match(page, /deleteAdminUserApi/);
  assert.doesNotMatch(page, /db\.users/);
  assert.match(page, /Filter by status/);
  assert.match(page, /Page \{pagination\.page/);
});
