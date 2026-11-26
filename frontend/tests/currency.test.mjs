import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { money } from '../src/lib/utils.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('shared currency formatter displays PKR consistently for Expo and booth prices', () => {
  assert.equal(money(45000), 'PKR 45,000');
  assert.equal(money(0), 'PKR 0');
});

test('admin booth price fields use the same PKR currency as Expo and payment setup', () => {
  const source = fs.readFileSync(path.join(root, 'src/pages/admin/AdminOps.jsx'), 'utf8');
  assert.match(source, /Price \(PKR\)/);
  assert.doesNotMatch(source, /Price \(USD\)/);
});
