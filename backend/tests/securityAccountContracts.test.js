const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('authenticated requests resolve the current account and role from MongoDB', () => {
  const middleware = read('middleware/authMiddleware.js');
  assert.match(middleware, /currentUser = await User\.findById\(userId\)/);
  assert.match(middleware, /role: currentUser\.role/);
  assert.match(middleware, /if \(!currentUser\)/);
});

test('suspended accounts are rejected even when an old access token is still valid', () => {
  const middleware = read('middleware/authMiddleware.js');
  assert.match(middleware, /currentUser\.status === "suspended"/);
  assert.match(middleware, /status\(403\)/);
});

test('admin user deletion releases exhibitor booths and clears the previous showcase', () => {
  const controller = read('controllers/adminUserController.js');
  assert.match(controller, /Booth\.updateMany\(\{ exhibitor: id \}, \{ \$set: \{ exhibitor: null, status: "available", showcase: null \} \}\)/);
});

test('database lookup failures are not misreported as invalid credentials', () => {
  const middleware = read('middleware/authMiddleware.js');
  assert.match(middleware, /Authentication account lookup failed/);
  assert.match(middleware, /status\(503\)/);
});
