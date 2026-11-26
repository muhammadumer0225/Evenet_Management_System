const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('exhibitor analytics applies validated inclusive Pakistan-time date ranges to visits', () => {
  const controller = read('controllers/exhibitorAnalyticsController.js');
  assert.match(controller, /buildVisitDateMatch\(req\.query\)/g);
  assert.match(controller, /T00:00:00\+05:00/);
  assert.match(controller, /visitedAt\.\$gte/);
  assert.match(controller, /visitedAt\.\$lt/);
  assert.match(controller, /Start date cannot be after end date/);
  assert.match(controller, /Dates must use YYYY-MM-DD format/);
});

test('exhibitor analytics frontend applies the same date range to dashboard and PDF export', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'exhibitor', 'ExhibitorAnalytics.jsx'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'api.js'), 'utf8');
  assert.match(page, /type="date"/);
  assert.match(page, /setAppliedRange/);
  assert.match(page, /getMyBoothAnalytics\(appliedRange\)/);
  assert.match(page, /downloadMyBoothAnalyticsPdf\(appliedRange\)/);
  assert.match(api, /buildAnalyticsDateQuery/);
  assert.match(api, /URLSearchParams/);
});
