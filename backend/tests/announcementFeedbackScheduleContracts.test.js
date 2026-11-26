const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('announcement and feedback APIs are mounted under their expected API paths', () => {
  const server = read('server.js');
  assert.match(server, /app\.use\(["']\/api\/announcements["'],\s*announcementRoutes\)/);
  assert.match(server, /app\.use\(["']\/api\/feedback["'],\s*feedbackRoutes\)/);
});

test('announcement write operations are admin-only and personal feed requires authentication', () => {
  const routes = read('routes/announcementRoutes.js');
  assert.match(routes, /router\.post\(["']\/["'],\s*authMiddleware,\s*roleMiddleware\(["']admin["']\)/);
  assert.match(routes, /router\.get\(["']\/["'],\s*authMiddleware,\s*roleMiddleware\(["']admin["']\)/);
  assert.match(routes, /router\.get\(["']\/my["'],\s*authMiddleware/);
  assert.match(routes, /router\.patch\(/);
  assert.match(routes, /router\.delete\(/);
});

test('announcement creation validates content, audience and Expo reference before saving', () => {
  const controller = read('controllers/announcementController.js');
  assert.match(controller, /!title\?\.trim\(\).*!message\?\.trim\(\)/s);
  assert.match(controller, /Invalid target audience/);
  assert.match(controller, /mongoose\.isValidObjectId\(expo\)/);
  assert.match(controller, /notifyAnnouncementRecipients\(announcement, req\)/);
  assert.match(controller, /new-notification/);
});

test('feedback API separates attendee submission/history from admin review/update', () => {
  const routes = read('routes/feedbackRoutes.js');
  assert.match(routes, /router\.post\(/);
  assert.match(routes, /router\.get\(/);
  assert.match(routes, /roleMiddleware\(["']admin["']\)/);
  const controller = read('controllers/feedbackController.js');
  assert.match(controller, /You can only submit Expo-specific feedback for an active registration/);
  assert.match(controller, /ratingNumber < 0 \|\| ratingNumber > 5/);
  assert.match(controller, /Feedback\.find\(\s*\{\s*attendee: req\.user\.id/s);
  assert.match(controller, /Notification/);
});

test('schedule and session-registration APIs are mounted and expose authenticated write routes', () => {
  const server = read('server.js');
  assert.match(server, /app\.use\(["']\/api\/sessions["'],\s*sessionRoutes\)/);
  assert.match(server, /app\.use\(["']\/api\/session-registrations["'],\s*sessionRegistrationRoutes\)/);
  const sessions = read('routes/sessionRoutes.js');
  assert.match(sessions, /router\.post\(/);
  assert.match(sessions, /router\.put\(/);
  assert.match(sessions, /router\.delete\(/);
  const registrations = read('routes/sessionRegistrationRoutes.js');
  assert.match(registrations, /registerForSession/);
  assert.match(registrations, /bookmarkSession/);
  assert.match(registrations, /removeSessionBookmark/);
  assert.match(registrations, /cancelSessionRegistration/);
});

test('session reminder scheduler is connected to server startup after database connection', () => {
  const server = read('server.js');
  const scheduler = read('services/sessionReminderScheduler.js');
  assert.match(server, /startSessionReminderScheduler\(io\)/);
  assert.match(scheduler, /session/);
  assert.match(scheduler, /reminder/i);
});
