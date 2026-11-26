import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(root, 'App.jsx'), 'utf8');
const layouts = fs.readFileSync(path.join(root, 'components', 'Layouts.jsx'), 'utf8');

test('admin and exhibitor analytics use distinct dashboard routes', () => {
  assert.match(app, /<Route path="analytics" element={<ByRole admin={AdminAnalytics} \/>} \/>/);
  assert.match(app, /<Route path="booth-analytics" element={<ByRole exhibitor={ExhibitorAnalytics} \/>} \/>/);
  assert.equal((app.match(/<Route path="analytics"/g) || []).length, 1);
});

test('analytics navigation points to the correct role-specific destinations', () => {
  assert.match(layouts, /\['\/dashboard\/analytics', 'Analytics & reports'/);
  assert.match(layouts, /\['\/dashboard\/booth-analytics', 'Booth analytics'/);
});
