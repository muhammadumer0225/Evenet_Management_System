const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('account export, profile, password and delete endpoints all require authentication', () => {
  const routes = read('routes/accountRoutes.js');
  assert.match(routes, /router\.use\(authMiddleware\)/);
  assert.match(routes, /router\.get\(["']\/export["']/);
  assert.match(routes, /router\.patch\(["']\/profile["']/);
  assert.match(routes, /router\.post\(["']\/profile-image["']/);
  assert.match(routes, /router\.patch\(["']\/password["']/);
  assert.match(routes, /router\.delete\(["']\/["']/);
});

test('account data export explicitly excludes password and token hashes', () => {
  const controller = read('controllers/accountController.js');
  assert.match(controller, /User\.findById\(id\)\.select\("name email role phone company bio profileImage interests consent status createdAt updatedAt"\)/);
  assert.doesNotMatch(controller, /select\([^\n]*(password|refreshTokenHash|resetPasswordToken)/);
});

test('password change verifies the current password and revokes refresh tokens', () => {
  const controller = read('controllers/accountController.js');
  assert.match(controller, /bcrypt\.compare\(currentPassword, user\.password\)/);
  assert.match(controller, /user\.refreshTokenHash = null/);
  assert.match(controller, /user\.refreshTokenExpiresAt = null/);
});

test('self-deletion requires another active admin and clears released booth showcase data', () => {
  const controller = read('controllers/accountController.js');
  assert.match(controller, /Create another active admin before deleting this organizer account/);
  assert.match(controller, /Booth\.updateMany\(\{ exhibitor: id \}, \{ \$set: \{ exhibitor: null, status: "available", showcase: null \} \}\)/);
});


test('profile image upload validates image signatures and stores only the current user image path', () => {
  const routes = read('routes/accountRoutes.js');
  const user = read('models/User.js');
  assert.match(routes, /fileTypeFromFile/);
  assert.match(routes, /profileImage = imageUrl/);
  assert.match(user, /profileImage/);
});
