const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('exhibitor booth analytics endpoint is authenticated and exhibitor-only', () => {
  const routes = read('routes/exhibitorRoutes.js');
  assert.match(routes, /"\/me\/booth-analytics"[\s\S]*?authMiddleware[\s\S]*?roleMiddleware\("exhibitor"\)[\s\S]*?getMyBoothAnalytics/);
});

test('exhibitor analytics scopes booth queries to the signed-in exhibitor', () => {
  const controller = read('controllers/exhibitorAnalyticsController.js');
  assert.match(controller, /exhibitor:\s*req\.user\.id/);
  assert.match(controller, /status:\s*\{\s*\$in:\s*\["reserved",\s*"occupied"\]/);
  assert.match(controller, /BoothVisit\.aggregate/);
});

test('exhibitor analytics returns aggregate counts without attendee PII', () => {
  const controller = read('controllers/exhibitorAnalyticsController.js');
  assert.match(controller, /uniqueAttendees/);
  assert.match(controller, /uniqueVisitors/);
  assert.doesNotMatch(controller, /populate\("attendee"/);
  assert.match(controller, /select\("_id boothNumber status expo"\)/);
});
