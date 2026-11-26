import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('Socket.IO authenticates users and supports validated global and Expo-specific subscriptions', () => {
  const server = read('../../backend/server.js');
  assert.match(server, /socket\.join\(`user:\$\{socket\.user\.id\}`\)/);
  assert.match(server, /subscribe-expo-updates/);
  assert.match(server, /unsubscribe-expo-updates/);
  assert.match(server, /socket\.join\(`expo:\$\{expoId\}`\)/);
  assert.match(server, /socket\.join\("expo-updates"\)/);
  assert.match(server, /\^\[a-f0-9\]\{24\}\$/i);
});

test('Expo, session and booth mutations broadcast after successful persistence', () => {
  const expo = read('../../backend/controllers/expoController.js');
  const sessions = read('../../backend/controllers/sessionController.js');
  const booths = read('../../backend/controllers/boothController.js');
  assert.match(expo, /emitExpoDataUpdated\(req, "expo_created"/);
  assert.match(expo, /emitExpoDataUpdated\(req, "expo_updated"/);
  assert.match(expo, /emitExpoDataUpdated\(req, "expo_floor_plan_updated"/);
  assert.match(expo, /emitExpoDataUpdated\(req, "expo_deleted"/);
  assert.match(sessions, /emitExpoDataUpdated\(req, "session_created"/);
  assert.match(sessions, /emitExpoDataUpdated\(req, "session_updated"/);
  assert.match(sessions, /emitExpoDataUpdated\(req, "session_cancelled"/);
  for (const event of ['booth_created', 'booth_updated', 'booth_availability_updated', 'booth_deleted', 'booth_reserved', 'booth_released', 'booth_assigned']) {
    assert.ok(booths.includes(`"${event}"`), `missing ${event} broadcast`);
  }
});

test('Expo listing, home, schedule and Expo detail refresh their API data on socket updates', () => {
  for (const path of [
    '../src/pages/Home.jsx',
    '../src/pages/Expos.jsx',
    '../src/pages/Schedule.jsx',
    '../src/pages/ExpoDetail.jsx',
    '../src/pages/admin/AdminExpos.jsx',
  ]) {
    const source = read(path);
    assert.match(source, /useExpoRealtimeVersion/, `${path} should subscribe to realtime updates`);
  }
  const hook = read('../src/hooks/useExpoRealtimeVersion.js');
  assert.match(hook, /socket\.on\('expo-data-updated'/);
  assert.match(hook, /socket\.off\('expo-data-updated'/);
  assert.match(hook, /subscribe-expo-updates/);
  assert.match(hook, /socket\.on\('connect'/);

  const realtimeService = read('../../backend/services/expoRealtimeService.js');
  assert.match(realtimeService, /io\.to\(`expo:\$\{String\(expoId\)\}`\)/);
  assert.match(realtimeService, /io\.to\("expo-updates"\)/);

  for (const path of [
    '../src/pages/admin/AdminOps.jsx',
    '../src/pages/admin/AdminAnnouncements.jsx',
    '../src/pages/exhibitor/ExhibitorPages.jsx',
  ]) {
    assert.match(read(path), /useExpoRealtimeVersion/, `${path} should refresh on relevant Expo updates`);
  }
});


test('Socket.IO uses the deployed frontend origin by default and Vite proxies WebSockets in development', () => {
  const socket = read('../src/lib/socket.js');
  const vite = read('../vite.config.js');
  assert.match(socket, /import\.meta\.env\.VITE_SOCKET_URL\s*\|\|\s*window\.location\.origin/);
  assert.doesNotMatch(socket, /http:\/\/localhost:5000/);
  assert.match(vite, /['"]\/socket\.io['"]\s*:\s*\{/);
  assert.match(vite, /ws:\s*true/);
  assert.match(vite, /target:\s*['"]http:\/\/localhost:5000['"]/);
});


test('refreshing an access token re-authenticates an active Socket.IO connection', () => {
  const socket = read('../src/lib/socket.js');
  const api = read('../src/lib/api.js');
  assert.match(socket, /export const reconnectSocket = \(\) =>/);
  assert.match(socket, /if \(!localStorage\.getItem\([\"']eventsphere\.token[\"']\)\) return;/);
  assert.match(socket, /socket\.disconnect\(\);\s*socket\.connect\(\);/);
  assert.match(api, /import \{ reconnectSocket \} from ['"]\.\/socket['"]/);
  assert.match(api, /localStorage\.setItem\(['"]eventsphere\.refreshToken['"], data\.refreshToken\);\s*reconnectSocket\(\);/);
});
