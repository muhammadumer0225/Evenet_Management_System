import test from 'node:test';
import assert from 'node:assert/strict';
import { idOf, dateOnly, dateOnlyUTC, dateOnlyInTimezone, timeOnlyInTimezone, timeOnly, normalizeExpo, normalizeBooth, normalizeSession, normalizeUser } from '../src/lib/normalizers.js';


test('dateOnlyUTC does not depend on the browser timezone', () => {
  assert.equal(dateOnlyUTC('2026-11-19T23:30:00-08:00'), '2026-11-20');
  assert.equal(dateOnlyUTC('2026-11-19'), '2026-11-19');
});

test('session date and time normalize in the Expo timezone', () => {
  const session = normalizeSession({
    _id: 's-zone',
    expo: { _id: 'e-zone', timezone: 'Asia/Karachi' },
    title: 'Timezone session',
    startTime: '2026-11-19T10:30:00.000Z',
    endTime: '2026-11-19T11:30:00.000Z',
  });
  assert.equal(session.date, '2026-11-19');
  assert.equal(session.start, '15:30');
  assert.equal(session.end, '16:30');
  assert.equal(dateOnlyInTimezone('2026-11-19T23:30:00.000Z', 'Asia/Karachi'), '2026-11-20');
  assert.equal(timeOnlyInTimezone('2026-11-19T23:30:00.000Z', 'Asia/Karachi'), '04:30');
});

test('idOf accepts populated Mongo documents and plain IDs', () => {
  assert.equal(idOf({ _id: 'mongo-id' }), 'mongo-id');
  assert.equal(idOf({ id: 'plain-id' }), 'plain-id');
  assert.equal(idOf('plain-id'), 'plain-id');
  assert.equal(idOf(null), '');
});

test('dateOnly preserves date-only strings and rejects invalid dates', () => {
  assert.equal(dateOnly('2026-11-19'), '2026-11-19');
  assert.equal(dateOnly('not-a-date'), '');
  assert.equal(dateOnly(null), '');
});

test('timeOnly safely formats valid dates and rejects invalid values', () => {
  assert.match(timeOnly('2026-11-19T10:30:00.000Z'), /^\d{2}:\d{2}$/);
  assert.equal(timeOnly('not-a-date'), '');
});

test('normalizeExpo maps API statuses and nested venue information', () => {
  const expo = normalizeExpo({ _id: 'e1', status: 'published', startDate: '2026-11-19', endDate: '2026-11-20', location: { venue: 'Expo Hall', city: 'Karachi' } });
  assert.equal(expo.id, 'e1');
  assert.equal(expo.status, 'upcoming');
  assert.equal(expo.location, 'Expo Hall, Karachi');
  assert.equal(expo.startDate, '2026-11-19');
  assert.deepEqual(expo.tags, []);
});

test('normalizeBooth maps occupied and exhibitor-owned reserved booths', () => {
  const occupied = normalizeBooth({ _id: 'b1', expo: 'e1', boothNumber: 'A-01', status: 'occupied', position: { x: 25, y: 40 } });
  assert.equal(occupied.status, 'booked');
  assert.equal(occupied.zone, 'Main Hall');
  const positioned = normalizeBooth({ _id: 'b-grid', expo: 'e1', boothNumber: 'D-01', position: { x: 50, y: 40 } });
  assert.equal(positioned.col, 4);
  assert.equal(positioned.row, 2);
  assert.equal(occupied.row, 2);
  assert.equal(occupied.col, 2);
  const ownReserved = normalizeBooth({ _id: 'b2', expo: 'e1', zone: 'Zone 1 · Premier', exhibitor: { _id: 'u1' }, status: 'reserved' }, { _id: 'u1', role: 'exhibitor' });
  assert.equal(ownReserved.zone, 'Zone 1 · Premier');
  assert.equal(ownReserved.status, 'reserved');
});

test('normalizeSession handles populated speakers and missing optional fields', () => {
  const session = normalizeSession({ _id: 's1', expo: { _id: 'e1' }, title: 'AI in practice', startTime: '2026-11-19T10:30:00.000Z', endTime: '2026-11-19T11:30:00.000Z', speakers: [{ name: 'A. Khan', designation: 'Engineer' }] });
  assert.equal(session.id, 's1');
  assert.equal(session.expoId, 'e1');
  assert.equal(session.speaker, 'A. Khan');
  assert.equal(session.speakerRole, 'Engineer');
  assert.equal(session.capacity, 100);
  assert.equal(session.registeredCount, 0);
  assert.equal(session.remote, true);
  assert.equal(session.expoTitle, '');
});

test('normalizeSession carries live registration counts and Expo title', () => {
  const session = normalizeSession({ _id: 's2', expo: { _id: 'e2', title: 'Tech Expo' }, title: 'AI safety', startTime: '2026-11-19T10:30:00.000Z', endTime: '2026-11-19T11:30:00.000Z', capacity: 40, registeredCount: 12 });
  assert.equal(session.registeredCount, 12);
  assert.equal(session.capacity, 40);
  assert.equal(session.expoTitle, 'Tech Expo');
});

test('normalizeUser always provides stable UI defaults', () => {
  assert.deepEqual(normalizeUser({ _id: 'u1' }), { _id: 'u1', id: 'u1', company: '', status: 'active' });
});

