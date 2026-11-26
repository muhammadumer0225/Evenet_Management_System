const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('admin user-management endpoints are restricted to authenticated admins', () => {
  const routes = read('routes/adminUserRoutes.js');
  assert.match(routes, /router\.use\(authMiddleware,\s*roleMiddleware\(["']admin["']\)\)/);
  assert.match(routes, /router\.get\(/);
  assert.match(routes, /router\.patch\(/);
  assert.match(routes, /router\.delete\(/);
});

test('admin user search escapes regex input and bounds pagination', () => {
  const controller = read('controllers/adminUserController.js');
  assert.match(controller, /limit = Math\.min\(100/);
  assert.match(controller, /req\.query\.search\.trim\(\)\.replace\(/);
  assert.match(controller, /\$options: "i"/);
});

test('admin role changes protect self-role changes and the last active administrator', () => {
  const controller = read('controllers/adminUserController.js');
  assert.match(controller, /You cannot change your own role/);
  assert.match(controller, /At least one active admin account must remain/);
});

test('admin account deletion cannot delete the current admin and transfers owned event records', () => {
  const controller = read('controllers/adminUserController.js');
  assert.match(controller, /You cannot delete your own account/);
  assert.match(controller, /Expo\.updateMany\(\{ organizer: id \}/);
  assert.match(controller, /Announcement\.updateMany\(\{ createdBy: id \}/);
});

test('admin user-management router is mounted by the Express server', () => {
  const server = read('server.js');
  assert.match(server, /require\(["']\.\/routes\/adminUserRoutes["']\)/);
  assert.match(server, /app\.use\(["']\/api\/admin\/users["'],\s*adminUserRoutes\)/);
});
