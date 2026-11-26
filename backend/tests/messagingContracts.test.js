const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('all messaging routes require authentication', () => {
  const routes = read('routes/messageRoutes.js');
  assert.match(routes, /router\.use\(authMiddleware\)/);
  assert.match(routes, /router\.post\(["']\/["'],\s*sendMessage\)/);
  assert.match(routes, /router\.patch\(["']\/conversation\/:userId\/read["']/);
});

test('messaging controller enforces recipient permissions and message limits', () => {
  const controller = read('controllers/messageController.js');
  assert.match(controller, /const canMessage = async/);
  assert.match(controller, /if \(sender\.role === "admin"\) return true/);
  assert.match(controller, /receiver\.role === "admin" \|\| receiver\.role === "exhibitor"/);
  assert.match(controller, /text\.trim\(\)\.length > 3000/);
  assert.match(controller, /Invalid message type/);
});

test('message receipts track delivery and read timestamps for the sender', () => {
  const controller = read('controllers/messageController.js');
  assert.match(controller, /deliveredAt/);
  assert.match(controller, /readAt/);
  assert.match(controller, /message-status/);
  assert.match(controller, /conversation-read/);
});

test('message persistence is not reported as failed solely because notification creation fails', () => {
  const controller = read('controllers/messageController.js');
  assert.match(controller, /let notification = null;\s*try \{\s*notification = await Notification\.create/s);
  assert.match(controller, /Message notification creation failed/);
  assert.match(controller, /emit\("new-message", message\)/);
  assert.match(controller, /if \(notification\) \{\s*io\?\.to\(`user:\$\{to\}`\)\.emit\("new-notification", notification\);\s*\}/s);
});


test('suspended accounts are excluded from message contacts and cannot receive new messages', () => {
  const controller = read('controllers/messageController.js');
  assert.match(controller, /select\("_id role status"\)/);
  assert.match(controller, /receiver\.status === "suspended"/);
  assert.match(controller, /status: \{ \$ne: "suspended" \}/);
});


test('message deletion routes are authenticated and support per-user and everyone scopes', () => {
  const routes = read('routes/messageRoutes.js');
  const controller = read('controllers/messageController.js');
  const model = read('models/Message.js');
  assert.match(routes, /router\.delete\(["']\/:messageId["']/);
  assert.match(routes, /router\.delete\(["']\/conversation\/:userId\/messages["']/);
  assert.match(routes, /router\.delete\(["']\/conversation\/:userId["']/);
  assert.match(controller, /Only the sender can delete this message for everyone/);
  assert.match(controller, /hiddenFor/);
  assert.match(model, /hiddenFor/);
});
