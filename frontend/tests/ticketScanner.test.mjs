import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const scanner = fs.readFileSync(path.join(here, '../src/components/TicketScanner.jsx'), 'utf8');

test('ticket scanner explains secure-context requirements and Chrome camera permission recovery', () => {
  assert.match(scanner, /window\.isSecureContext/);
  assert.match(scanner, /HTTPS or localhost/);
  assert.match(scanner, /Camera permission was denied/);
  assert.match(scanner, /setAttempt\(\(value\) => value \+ 1\)/);
});

test('ticket scanner uses jsQR as a compatibility decoder and keeps manual ticket-code entry as fallback', () => {
  assert.match(scanner, /import jsQR from 'jsqr'/);
  assert.match(scanner, /jsQR\(pixels\.data, width, height/);
  assert.match(scanner, /formats: \['qr_code'\]/);
  assert.match(scanner, /manual ticket-code entry/);
});
