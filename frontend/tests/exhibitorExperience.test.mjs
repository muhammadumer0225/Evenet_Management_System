import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('exhibitor dashboard loads applications, booth analytics, expos and messages from APIs', () => {
  const page = read('src/pages/Overview.jsx');
  assert.match(page, /getMyApplications\(\)/);
  assert.match(page, /getMyBoothAnalytics\(\)/);
  assert.match(page, /getPublishedExpos\(\)/);
  assert.match(page, /getMyConversations\(\)/);
  assert.match(page, /Application pipeline/);
  assert.match(page, /Recorded visits/);
});

test('my applications exposes a details view with organizer remarks and documents', () => {
  const page = read('src/pages/exhibitor/ExhibitorPages.jsx');
  assert.match(page, /View details/);
  assert.match(page, /Organizer remarks/);
  assert.match(page, /Submitted documents/);
  assert.match(page, /selectedApplication\.documents/);
});

test('neighbours are discovered from persisted booth positions and real exhibitor records', () => {
  const page = read('src/pages/exhibitor/ExhibitorPages.jsx');
  assert.match(page, /getMyShowcase\(\)/);
  assert.match(page, /getBooths\(expoId\)/);
  assert.match(page, /findNeighborBooths\(ownBooth, allBooths, user\.id\)/);
  const helper = read('src/lib/exhibitorNeighbors.js');
  assert.match(helper, /position\.width/);
  assert.match(helper, /position\.height/);
  assert.match(helper, /areBoothsAdjacent/);
  assert.match(page, /await sendMessage\(/);
});

test('company profile tagline and LinkedIn fields persist through the backend profile API', () => {
  const page = read('src/pages/exhibitor/ExhibitorPages.jsx');
  const model = fs.readFileSync(path.join(root, '../backend/models/ExhibitorProfile.js'), 'utf8');
  const controller = fs.readFileSync(path.join(root, '../backend/controllers/exhibitorController.js'), 'utf8');
  assert.match(page, /tagline: f\.tagline\.trim\(\)/);
  assert.match(page, /linkedin: f\.linkedin\.trim\(\)/);
  assert.match(model, /tagline:\s*\{/);
  assert.match(model, /linkedin:\s*\{/);
  assert.match(controller, /"tagline"/);
  assert.match(controller, /"linkedin"/);
});

test('booth analytics explains the scope of unique attendee totals and compares daily visits with daily uniques', () => {
  const page = read('src/pages/exhibitor/ExhibitorAnalytics.jsx');
  assert.match(page, /Unique attendees are deduplicated across all your booths/);
  assert.match(page, /dataKey="uniqueVisitors" name="Unique attendees that day"/);
});

test('remaining exhibitor pages are wired to their authenticated backend APIs', () => {
  const announcements = read('src/pages/shared/Announcements.jsx');
  const messages = read('src/pages/shared/Messages.jsx');
  const notifications = read('src/pages/shared/Notifications.jsx');
  const account = read('src/pages/shared/Account.jsx');
  assert.match(announcements, /getMyAnnouncements\(\)/);
  assert.match(announcements, /Try again/);
  assert.match(messages, /getMyConversations\(\)/);
  assert.match(messages, /getMessageContacts\(\)/);
  assert.match(messages, /getConversation\(active\)/);
  assert.match(messages, /Retry loading messages/);
  assert.match(messages, /Retry conversation/);
  assert.match(notifications, /getMyNotifications\(\)/);
  assert.match(notifications, /socket\.on\('new-notification'/);
  assert.match(notifications, /setReloadVersion/);
  assert.doesNotMatch(notifications, /window\.location\.reload/);
  assert.match(account, /updateProfile\(user\.id, f\)/);
  assert.match(account, /changePassword/);
});

test('booth visitor check-in explains the required Expo check-in workflow before recording a booth visit', () => {
  const page = read('src/pages/admin/AdminOps.jsx');
  assert.match(page, /How to record a booth visit/);
  assert.match(page, /First, check the attendee in from/);
  assert.match(page, /Record visit/);
});

test('booth sample inventory documentation maps human-readable states to supported database statuses', () => {
  const doc = fs.readFileSync(path.join(root, '../docs/BOOTH_SAMPLE_INVENTORY.md'), 'utf8');
  for (const status of ['available', 'reserved', 'occupied', 'blocked']) assert.match(doc, new RegExp(`\\b${status}\\b`));
  assert.match(doc, /does not create records or run a seed operation/);
});


test('neighbour geometry uses actual booth rectangles instead of fixed grid buckets', async () => {
  const { areBoothsAdjacent, findNeighborBooths } = await import('../src/lib/exhibitorNeighbors.js');
  const own = { _id: 'own', position: { x: 10, y: 10, width: 12, height: 12 } };
  const touching = { _id: 'near', exhibitor: { _id: 'other' }, position: { x: 22, y: 10, width: 10, height: 12 } };
  const distant = { _id: 'far', exhibitor: { _id: 'third' }, position: { x: 70, y: 70, width: 10, height: 10 } };
  assert.equal(areBoothsAdjacent(own, touching), true);
  assert.equal(areBoothsAdjacent(own, distant), false);
  assert.deepEqual(findNeighborBooths(own, [touching, distant], 'current-user'), [touching]);
});


test('exhibitor shared pages expose in-page retry instead of forcing a full browser reload', () => {
  const company = read('src/pages/exhibitor/ExhibitorPages.jsx');
  const announcements = read('src/pages/shared/Announcements.jsx');
  const notifications = read('src/pages/shared/Notifications.jsx');
  const messages = read('src/pages/shared/Messages.jsx');
  assert.match(company, /Profile loading failed/);
  assert.match(company, /setReloadVersion/);
  assert.match(announcements, /Refresh/);
  assert.match(notifications, /Refresh/);
  assert.match(messages, /conversationError/);
});

test('exhibitor booth booking displays live available, reserved and confirmed counts', () => {
  const pages = read('src/pages/exhibitor/ExhibitorPages.jsx');
  const bookBooth = pages.slice(pages.indexOf('export function BookBooth'), pages.indexOf('/* ---------- Booth showcase ---------- */'));
  assert.match(bookBooth, /label="Available" value=\{boothStatusCounts\.available\}/);
  assert.match(bookBooth, /Reserved · awaiting confirmation/);
  assert.match(bookBooth, /label="Confirmed" value=\{boothStatusCounts\.confirmed\}/);
  assert.match(bookBooth, /No booths have been added to this Expo yet/);
});

test('floor plan legend and shared status badge call occupied booths Confirmed', () => {
  const floorPlan = read('src/components/FloorPlan.jsx');
  const ui = read('src/components/ui.jsx');
  assert.match(floorPlan, /booked: 'Confirmed'/);
  assert.match(ui, /booked: \['blue', 'Confirmed'\]/);
});

test('My Applications and Book a Booth refresh after live application status updates', () => {
  const pages = read('src/pages/exhibitor/ExhibitorPages.jsx');
  const myApplications = pages.slice(pages.indexOf('export function MyApplications'), pages.indexOf('/* ---------- Book a booth ---------- */'));
  const bookBooth = pages.slice(pages.indexOf('export function BookBooth'), pages.indexOf('/* ---------- Booth showcase ---------- */'));
  assert.match(myApplications, /const realtimeVersion = useExpoRealtimeVersion\(\)/);
  assert.match(myApplications, /\}, \[realtimeVersion\]\)/);
  assert.match(bookBooth, /const realtimeVersion = useExpoRealtimeVersion\(expoId\)/);
  assert.match(bookBooth, /getMyApplications\(\)[\s\S]*\}, \[realtimeVersion\]\)/);
  assert.match(myApplications, /Reserved — awaiting confirmation/);
});
