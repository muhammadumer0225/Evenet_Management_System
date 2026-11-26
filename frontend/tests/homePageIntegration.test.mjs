import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/pages.css', import.meta.url), 'utf8');

test('home page loads published expos and live expo statistics from backend APIs', () => {
  assert.match(home, /getPublishedExpos\(\)/);
  assert.match(home, /getExpoStats\(expo\.id\)/);
  assert.match(home, /normalizeExpo/);
  assert.match(home, /Promise\.allSettled/);
});

test('home page floor plan uses published expo booth data instead of local demo snapshot', () => {
  assert.match(home, /getBooths\(heroExpo\.id\)/);
  assert.match(home, /normalizeBooth/);
  assert.doesNotMatch(home, /publicExpos\(db\)|db\.users|db\.sessions|boothsOf\(db/);
});

test('home page avoids fabricated counters and fake live activity claims', () => {
  assert.doesNotMatch(home, /expos\.length\s*\+\s*14|exhibitors\s*\*\s*12\s*\+\s*40|attendees\s*\*\s*1500\s*\+\s*2000/);
  assert.doesNotMatch(home, /reservations just now|Session starts in 30 min|Try a demo login|live demo data/);
});

test('home page uses existing application routes and explains organizer invitation requirement', () => {
  assert.match(home, /to: '\/login'/);
  assert.match(home, /\/register\?role=exhibitor/);
  assert.match(home, /\/register\?role=attendee/);
  assert.match(home, /invitation code/);
  assert.match(home, /to="\/login"/);
  assert.match(css, /home-plan-placeholder/);
});
