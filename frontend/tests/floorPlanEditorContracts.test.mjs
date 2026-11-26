import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const component = await readFile(new URL('../src/components/FloorPlanEditor.jsx', import.meta.url), 'utf8');
const adminPage = await readFile(new URL('../src/pages/admin/AdminOps.jsx', import.meta.url), 'utf8');

test('floor plan editor supports booth dragging and resizing', () => {
  assert.match(component, /onPointerDown=\{\(event\) => startInteraction\(event, booth, 'move'\)\}/);
  assert.match(component, /startInteraction\(event, booth, 'resize'\)/);
  assert.match(component, /width: clamp\(active\.initial\.width \+ dx/);
  assert.match(component, /height: clamp\(active\.initial\.height \+ dy/);
});

test('floor plan editor supports zoom, reset and canvas pan', () => {
  assert.match(component, /setZoom\(/);
  assert.match(component, /const resetView = \(\) => \{ setZoom\(1\); setPan\(\{ x: 0, y: 0 \}\); \}/);
  assert.match(component, /action: 'pan'/);
});

test('admin floor plan persists booth geometry through the existing booth API', () => {
  assert.match(adminPage, /<FloorPlanEditor/);
  assert.match(adminPage, /updateBoothAPI\(boothId, \{/);
  assert.match(adminPage, /position,/);
  assert.match(adminPage, /onSavePosition=\{handleSaveBoothPosition\}/);
});

test('public and exhibitor floor plans render saved booth coordinates', async () => {
  const floorPlan = await readFile(new URL('../src/components/FloorPlan.jsx', import.meta.url), 'utf8');
  const exhibitorPage = await readFile(new URL('../src/pages/exhibitor/ExhibitorPages.jsx', import.meta.url), 'utf8');
  assert.match(floorPlan, /plan-grid-positioned/);
  assert.match(floorPlan, /left: `\$\{Number\.isFinite\(Number\(p\.x\)\)/);
  assert.match(exhibitorPage, /position: b\.position \|\| undefined/);
});
