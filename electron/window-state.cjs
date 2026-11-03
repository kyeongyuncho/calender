'use strict';

const fs = require('node:fs');
const path = require('node:path');

function fitBounds(bounds, areas, mini) {
  const fallback = areas[0];
  const valid = bounds && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key]));
  const saved = valid ? bounds : { x: fallback.x + 30, y: fallback.y + 30, width: mini ? 420 : 1440, height: mini ? 620 : 960 };
  const area = areas.find(a => saved.x < a.x + a.width && saved.x + saved.width > a.x && saved.y < a.y + a.height && saved.y + saved.height > a.y) || fallback;
  const width = Math.round(Math.min(area.width, Math.max(mini ? 320 : 800, saved.width)));
  const height = Math.round(Math.min(area.height, Math.max(mini ? 300 : 600, saved.height)));
  return {
    x: Math.round(Math.max(area.x, Math.min(saved.x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(saved.y, area.y + area.height - height))),
    width, height
  };
}

function createWindowState(win, screen, filename) {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(filename, 'utf8')) || {}; } catch {}
  const state = {
    mini: saved.mini === true,
    alwaysOnTop: saved.alwaysOnTop === true,
    maximized: saved.maximized !== false,
    normalBounds: saved.normalBounds,
    miniBounds: saved.miniBounds
  };
  let changing = false;
  let timer;
  const areas = () => [screen.getPrimaryDisplay(), ...screen.getAllDisplays()].map(display => display.workArea);
  function capture() {
    if (changing || win.isMinimized() || win.isDestroyed()) return;
    if (state.mini) state.miniBounds = win.getNormalBounds();
    else {
      state.normalBounds = win.getNormalBounds();
      state.maximized = win.isMaximized();
    }
  }
  function persist() {
    clearTimeout(timer);
    capture();
    try {
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename + '.tmp', JSON.stringify(state, null, 2));
      fs.renameSync(filename + '.tmp', filename);
    } catch (error) { console.error('Window settings could not be saved:', error.message); }
  }
  function apply() {
    changing = true;
    if (win.isFullScreen()) win.setFullScreen(false);
    if (win.isMaximized()) win.unmaximize();
    win.setMinimumSize(state.mini ? 320 : 800, state.mini ? 300 : 600);
    win.setBounds(fitBounds(state.mini ? state.miniBounds : state.normalBounds, areas(), state.mini));
    if (!state.mini && state.maximized) win.maximize();
    win.setAlwaysOnTop(state.alwaysOnTop);
    changing = false;
  }
  function schedule() {
    if (changing) return;
    clearTimeout(timer);
    timer = setTimeout(persist, 300);
  }
  apply();
  for (const event of ['move', 'resize', 'maximize', 'unmaximize']) win.on(event, schedule);
  win.on('close', persist);
  win.on('closed', () => clearTimeout(timer));
  const ensureVisible = () => { capture(); apply(); persist(); };
  screen.on('display-removed', ensureVisible);
  screen.on('display-metrics-changed', ensureVisible);
  win.on('closed', () => {
    screen.removeListener('display-removed', ensureVisible);
    screen.removeListener('display-metrics-changed', ensureVisible);
  });
  return {
    get: () => ({ mini: state.mini, alwaysOnTop: win.isAlwaysOnTop() }),
    setMini(enabled) {
      if (typeof enabled !== 'boolean') throw new Error('올바른 미니 모드 설정이 아닙니다.');
      if (enabled !== state.mini) {
        capture();
        state.mini = enabled;
        apply();
        persist();
      }
      return this.get();
    },
    setAlwaysOnTop(enabled) {
      if (typeof enabled !== 'boolean') throw new Error('올바른 창 고정 설정이 아닙니다.');
      state.alwaysOnTop = enabled;
      win.setAlwaysOnTop(enabled);
      persist();
      return this.get();
    }
  };
}

module.exports = { fitBounds, createWindowState };
