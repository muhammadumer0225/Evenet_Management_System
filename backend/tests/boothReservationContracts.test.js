const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('exhibitor booth reservation requires an approved application for the same Expo', () => {
  const controller = read('controllers/boothController.js');
  const reserve = controller.slice(controller.indexOf('const reserveBooth ='), controller.indexOf('const releaseBooth ='));
  assert.match(reserve, /Application\.findOne\(\{[\s\S]*expo: requestedBooth\.expo,[\s\S]*exhibitor: req\.user\.id,[\s\S]*status: "approved"/);
  assert.match(reserve, /status\(403\)/);
  assert.match(reserve, /application\.booth/);
});

test('booth reservation atomically links the approved application and rolls back a failed link', () => {
  const controller = read('controllers/boothController.js');
  const reserve = controller.slice(controller.indexOf('const reserveBooth ='), controller.indexOf('const releaseBooth ='));
  assert.match(reserve, /status: "available"/);
  assert.match(reserve, /Application\.findOneAndUpdate\([\s\S]*booth: null[\s\S]*\$set: \{ booth: booth\._id \}/);
  assert.match(reserve, /Booth\.updateOne\([\s\S]*status: "available", exhibitor: null/);
  assert.match(reserve, /application: updatedApplication/);
});

test('booth reservation endpoint remains restricted to authenticated exhibitors', () => {
  const routes = read('routes/boothRoutes.js');
  assert.match(routes, /router\.post\([\s\S]*"\/:id\/reserve",[\s\S]*authMiddleware,[\s\S]*roleMiddleware\("exhibitor"\),[\s\S]*reserveBooth/);
});

test('admin confirmation requires a reserved booth and an approved application linked to the same Expo', () => {
  const controller = read('controllers/boothController.js');
  const update = controller.slice(controller.indexOf('const updateBooth ='), controller.indexOf('// Block or restore booth availability'));
  assert.match(update, /status === "occupied"/);
  assert.match(update, /\["reserved", "occupied"\]\.includes\(currentBooth\.status\)/);
  assert.match(update, /expo: currentBooth\.expo/);
  assert.match(update, /exhibitor: currentBooth\.exhibitor/);
  assert.match(update, /status: "approved"/);
  assert.match(update, /Only a reserved booth with an exhibitor can be confirmed/);
});

test('admin release clears the application booth link and old exhibitor showcase', () => {
  const controller = read('controllers/boothController.js');
  const update = controller.slice(controller.indexOf('const updateBooth ='), controller.indexOf('// Block or restore booth availability'));
  const release = controller.slice(controller.indexOf('const releaseBooth ='), controller.indexOf('// Admin assigns an available booth'));
  assert.match(update, /status === "available"[\s\S]*updateData\.showcase = \{\}/);
  assert.match(update, /Application\.updateMany\([\s\S]*\{ booth: booth\._id \}[\s\S]*\$set: \{ booth: null \}/);
  assert.match(release, /showcase: \{\}/);
  assert.match(release, /Application\.updateMany\([\s\S]*\{ booth: booth\._id \}[\s\S]*\$set: \{ booth: null \}/);
  assert.match(release, /catch \(error\)[\s\S]*status: "reserved", exhibitor: req\.user\.id/);
});

test('assigned booths cannot be deleted before release', () => {
  const controller = read('controllers/boothController.js');
  const remove = controller.slice(controller.indexOf('const deleteBooth ='), controller.indexOf('// Reserve Booth'));
  assert.match(remove, /\["reserved", "occupied"\]\.includes\(existingBooth\.status\)/);
  assert.match(remove, /Release the assigned booth before deleting it/);
});

test('demo booth seeder is explicit, insert-only and skips expos with existing inventory', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/seedBoothInventory.js'), 'utf8');
  assert.match(script, /CONFIRM_DEMO_BOOTH_SEED/);
  assert.match(script, /DEMO_BOOTH_EXPO_IDS/);
  assert.match(script, /Booth\.countDocuments/);
  assert.match(script, /existingCount > 0/);
  assert.match(script, /Booth\.insertMany/);
  assert.doesNotMatch(script, /Booth\.deleteMany|Booth\.updateMany|Booth\.findOneAndUpdate/);
});
