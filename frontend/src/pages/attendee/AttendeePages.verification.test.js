import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(root, 'AttendeePages.jsx'), 'utf8');

test('attendee registration verification shows registration and payment status', () => {
  assert.match(source, /Registration status:/);
  assert.match(source, /Payment status:/);
  assert.match(source, /Registration found — action required/);
});

test('attendee verification clearly distinguishes completed and pending check-in', () => {
  assert.match(source, /Already checked in/);
  assert.match(source, /Not checked in yet/);
  assert.match(source, /Staff will complete your check-in/);
  assert.match(source, /checkedInAt/);
});

test('attendee verification provides next steps without exposing an attendee check-in action', () => {
  assert.match(source, /Next step:/);
  assert.match(source, /Complete the pending payment/);
  assert.doesNotMatch(source, /checkInAttendeeApi\(/);
});
