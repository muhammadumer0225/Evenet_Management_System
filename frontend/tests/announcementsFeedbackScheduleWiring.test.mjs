import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const adminAnnouncements = read('../src/pages/admin/AdminAnnouncements.jsx');
const announcements = read('../src/pages/shared/Announcements.jsx');
const feedback = read('../src/pages/shared/Feedback.jsx');
const feedbackForm = read('../src/components/FeedbackForm.jsx');
const schedule = read('../src/pages/Schedule.jsx');
const adminInsights = read('../src/pages/admin/AdminInsights.jsx');

test('admin announcements screen uses the shared API layer for persisted announcement actions', () => {
  assert.match(adminAnnouncements, /from ['"][^'"]*lib\/api['"]/);
  assert.match(adminAnnouncements, /createAnnouncement/);
  assert.match(adminAnnouncements, /updateAnnouncement/);
  assert.match(adminAnnouncements, /deleteAnnouncement/);
});

test('user announcements screen loads the signed-in user feed through the API layer', () => {
  assert.match(announcements, /from ['"][^'"]*lib\/api['"]/);
  assert.match(announcements, /getMyAnnouncements/);
});

test('feedback form loads eligible Expo registrations and submits through the API', () => {
  assert.match(feedbackForm, /getMyExpoRegistrationsApi/);
  assert.match(feedbackForm, /submitFeedback/);
  assert.match(feedbackForm, /paymentStatus/);
});

test('feedback history and admin review use backend API functions', () => {
  assert.match(feedback, /from ['"][^'"]*lib\/api['"]/);
  assert.match(feedback, /getMyFeedback/);
  assert.match(adminAnnouncements, /from ['"][^'"]*lib\/api['"]/);
});

test('public schedule loads published Expos and sessions from the API layer', () => {
  assert.match(schedule, /getPublishedExpos/);
  assert.match(schedule, /getPublishedSessions/);
  assert.match(schedule, /Promise\.all/);
});
