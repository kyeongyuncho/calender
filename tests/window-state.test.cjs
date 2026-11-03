'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { fitBounds, createWindowState } = require('../electron/window-state.cjs');

const area = { x: 0, y: 0, width: 1920, height: 1040 };
class Window extends EventEmitter {
  constructor() { super(); this.bounds = { x: 100, y: 100, width: 1200, height: 800 }; this.max = false; this.top = false; }
  isMinimized() { return false; }
  isDestroyed() { return false; }
  isFullScreen() { return false; }
  isMaximized() { return this.max; }
  isAlwaysOnTop() { return this.top; }
  getNormalBounds() { return { ...this.bounds }; }
  setMinimumSize() {}
  setBounds(bounds) { this.bounds = { ...bounds }; }
  setAlwaysOnTop(value) { this.top = value; }
  unmaximize() { this.max = false; }
  maximize() { this.max = true; }
}
function displays() {
  return Object.assign(new EventEmitter(), { getPrimaryDisplay: () => ({ workArea: area }), getAllDisplays: () => [{ workArea: area }] });
}

test('recovers windows after monitor removal and clamps invalid/oversized bounds', () => {
  assert.deepEqual(fitBounds({ x: 5000, y: -100, width: 420, height: 620 }, [area], true), { x: 1500, y: 0, width: 420, height: 620 });
  assert.deepEqual(fitBounds({ x: -10, y: -10, width: 9000, height: 9000 }, [area], false), area);
  assert.equal(fitBounds({ x: NaN }, [area], true).width, 420);
  const left = { x: -1600, y: 0, width: 1600, height: 900 };
  assert.equal(fitBounds({ x: -1500, y: 50, width: 400, height: 500 }, [area, left], true).x, -1500);
});

test('remembers independent mini/normal sizes, pinning and mode across restart', t => {
  const temp = fs.mkdtempSync(path.join(__dirname, 'window-test-'));
  t.after(() => {
    assert.ok(temp.startsWith(__dirname + path.sep + 'window-test-'));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const file = path.join(temp, 'window-state.json');
  const win = new Window();
  const state = createWindowState(win, displays(), file);
  win.max = false;
  win.bounds = { x: 100, y: 100, width: 1100, height: 750 };
  state.setMini(true);
  win.bounds = { x: 1350, y: 70, width: 380, height: 550 };
  state.setAlwaysOnTop(true);
  state.setMini(false);
  assert.deepEqual(win.bounds, { x: 100, y: 100, width: 1100, height: 750 });
  state.setMini(true);
  assert.deepEqual(win.bounds, { x: 1350, y: 70, width: 380, height: 550 });
  win.emit('close');
  win.emit('closed');
  const second = new Window();
  const restored = createWindowState(second, displays(), file);
  assert.deepEqual(restored.get(), { mini: true, alwaysOnTop: true });
  assert.deepEqual(second.bounds, win.bounds);
  restored.setAlwaysOnTop(false);
  assert.equal(second.isAlwaysOnTop(), false);
  assert.throws(() => restored.setMini('yes'));
  assert.throws(() => restored.setAlwaysOnTop(null));
  second.emit('closed');
});

test('ignores a corrupted settings file and preserves maximized normal mode', t => {
  const temp = fs.mkdtempSync(path.join(__dirname, 'window-test-'));
  t.after(() => {
    assert.ok(temp.startsWith(__dirname + path.sep + 'window-test-'));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const file = path.join(temp, 'window-state.json');
  fs.writeFileSync(file, '{broken');
  const win = new Window();
  const state = createWindowState(win, displays(), file);
  assert.equal(win.isMaximized(), true);
  state.setMini(true);
  assert.equal(win.isMaximized(), false);
  state.setMini(false);
  assert.equal(win.isMaximized(), true);
  win.emit('closed');
});
