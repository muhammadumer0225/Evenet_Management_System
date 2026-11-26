import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('exhibitor dashboard exposes Find Expos and booth application route', () => {
  const app = read('src/App.jsx');
  const layout = read('src/components/Layouts.jsx');
  assert.match(app, /path="expos" element=\{<ByRole admin=\{AdminExpos\} exhibitor=\{FindExpos\} attendee=\{MyExpos\} \/>\}/);
  assert.match(layout, /\['\/dashboard\/expos', 'Find expos & apply'/);
  assert.match(layout, /\['\/dashboard\/applications', 'My applications'/);
  assert.match(read('src/pages/Overview.jsx'), /Find expos & apply for a booth/);
});

test('Find Expos refreshes with realtime updates and loads applications/profile from APIs', () => {
  const page = read('src/pages/exhibitor/ExhibitorPages.jsx');
  const findPage = page.slice(page.indexOf('export function FindExpos()'), page.indexOf('/* ---------- My applications')); 
  assert.match(findPage, /getPublishedExpos\(\)/);
  assert.match(findPage, /getMyApplications\(\)/);
  assert.match(findPage, /getMyExhibitorProfile\(\)/);
  assert.match(findPage, /\[realtimeVersion, user\?\.id\]/);
  assert.match(findPage, /Apply for Booth/);
  assert.match(findPage, /Create company profile/);
  assert.match(findPage, /disabled=\{submitting \|\| profileLoadFailed \|\| !companyProfile\?\._id\}/);
  assert.match(findPage, /View expo/);
  assert.match(findPage, /You have already submitted an application for/);
});

test('Expo detail uses persisted exhibitor applications instead of local demo-store records', () => {
  const page = read('src/pages/ExpoDetail.jsx');
  assert.match(page, /getMyApplications\(\)/);
  assert.match(page, /const myApp = user\?\.role === 'exhibitor' \? myApplication : null/);
  assert.doesNotMatch(page, /db\.applications\.find\(\(a\) => a\.expoId === id/);
  assert.match(page, /Apply to exhibit/);
});

test('payment API retains demo completion and removes obsolete gateway preparation adapters', () => {
  const routes = read('../backend/routes/paymentRoutes.js');
  const service = read('../backend/services/paymentService.js');
  const controller = read('../backend/controllers/paymentController.js');
  assert.match(routes, /\/demo\/complete\/:registrationId/);
  assert.match(routes, /roleMiddleware\(\"attendee\"\)/);
  assert.doesNotMatch(routes, /prepare/);
  assert.doesNotMatch(service, /createPaymentAttempt|jazzcash|easypaisa/);
  assert.doesNotMatch(controller, /preparePayment/);
  assert.equal(fs.existsSync(path.join(root, '../backend/config/paymentGateways.js')), false);
  assert.equal(fs.existsSync(path.join(root, '../backend/services/gateways/jazzcash.js')), false);
  assert.equal(fs.existsSync(path.join(root, '../backend/middleware/userMiddleware.js')), false);
});
