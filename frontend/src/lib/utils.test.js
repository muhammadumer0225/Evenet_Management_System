import test from 'node:test';
import assert from 'node:assert/strict';
import { zonedDateTimeToISO, sessionStart, sessionEnd, icsFor } from './utils.js';

test('converts Expo wall-clock times using the Expo timezone, not browser timezone', () => {
  assert.equal(zonedDateTimeToISO('2027-01-15', '10:00', 'Asia/Karachi'), '2027-01-15T05:00:00.000Z');
  assert.equal(zonedDateTimeToISO('2027-06-15', '10:00', 'America/Los_Angeles'), '2027-06-15T17:00:00.000Z');
});

test('rejects malformed dates, times, and nonexistent daylight-saving wall times', () => {
  assert.throws(() => zonedDateTimeToISO('2027-01-15', '25:00', 'Asia/Karachi'), /valid date and time/);
  assert.throws(() => zonedDateTimeToISO('2027-03-14', '02:30', 'America/Los_Angeles'), /does not exist/);
});


test('agenda comparisons use stored instants instead of the viewer browser timezone', () => {
  const session = {
    date: '2027-01-15', start: '10:00', end: '11:00',
    startTime: '2027-01-15T05:00:00.000Z', endTime: '2027-01-15T06:00:00.000Z',
  };
  assert.equal(sessionStart(session).toISOString(), '2027-01-15T05:00:00.000Z');
  assert.equal(sessionEnd(session).toISOString(), '2027-01-15T06:00:00.000Z');
});

test('agenda calendar export writes absolute UTC instants and escapes text fields', () => {
  const content = icsFor({
    id: 'session-1', title: 'AI, Safety; Practice', room: 'Hall 1',
    description: 'First line\nSecond line',
    startTime: '2027-01-15T05:00:00.000Z', endTime: '2027-01-15T06:00:00.000Z',
  }, { location: 'Karachi' });
  assert.match(content, /DTSTART:20270115T050000Z/);
  assert.match(content, /DTEND:20270115T060000Z/);
  assert.ok(content.includes('SUMMARY:AI\\, Safety\\; Practice'));
  assert.match(content, /DESCRIPTION:First line\\nSecond line/);
});
