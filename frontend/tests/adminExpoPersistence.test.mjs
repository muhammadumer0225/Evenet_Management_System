import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adminExpos = readFileSync(new URL('../src/pages/admin/AdminExpos.jsx', import.meta.url), 'utf8');
const expoRoutes = readFileSync(new URL('../../backend/routes/expoRoutes.js', import.meta.url), 'utf8');
const expoController = readFileSync(new URL('../../backend/controllers/expoController.js', import.meta.url), 'utf8');

test('Admin Expo form maps banner and floor-plan settings into create/update payloads', () => {
  assert.match(adminExpos, /banner: expo\.banner \|\| ''/);
  assert.match(adminExpos, /floorPlan: \{/);
  assert.match(adminExpos, /backgroundImage: String\(expo\.floorPlan\?\.backgroundImage/);
  assert.match(adminExpos, /Floor-plan background image URL/);
  assert.match(adminExpos, /await createExpo\(payload\)/);
  assert.match(adminExpos, /await updateExpo\(edit\.id, payload\)/);
});

test('Admin Expo statistics use the backend aggregate endpoint instead of local snapshot counts', () => {
  assert.match(adminExpos, /getExpoStats\(expo\.id\)/);
  assert.match(adminExpos, /pendingApplications/);
  assert.doesNotMatch(adminExpos, /expoStats\(db, e\.id\)/);
  assert.match(expoController, /ExpoRegistration\.countDocuments/);
  assert.match(expoController, /Booth\.countDocuments/);
  assert.match(expoController, /Application\.countDocuments/);
});

test('Expo stats endpoint optionally authenticates admins so draft Expo stats remain available privately', () => {
  assert.match(expoRoutes, /router\.get\("\/:id\/stats", optionalAuthMiddleware, getExpoStats\)/);
  assert.match(expoController, /if \(!isAdmin\) \{\s*expoFilter\.status = "published";/);
});
