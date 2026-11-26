import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeTicketQr } from '../src/lib/qrCode.js';

test('ticket QR encoder returns a deterministic 21x21 boolean matrix', () => {
  const first = encodeTicketQr('ES-0123456789');
  const second = encodeTicketQr('ES-0123456789');
  assert.equal(first.length, 21);
  assert.ok(first.every((row) => row.length === 21 && row.every((cell) => typeof cell === 'boolean')));
  assert.deepEqual(first, second);
});

test('ticket QR encoder rejects values outside version 1-L byte capacity', () => {
  assert.throws(() => encodeTicketQr('THIS-IS-A-LONG-TICKET-CODE'), /up to 17 characters/);
  assert.throws(() => encodeTicketQr('é'), /ASCII values/);
});
