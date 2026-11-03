'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

async function boot() {
  const handlers = new Map();
  const chosen = [];
  const copied = [];
  const login = [];
  let win;
  let handler;
  const app = Object.assign(new EventEmitter(), {
    isPackaged: true,
    getPath: () => 'C:\\appdata',
    setPath() {},
    setAppUserModelId() {},
    requestSingleInstanceLock: () => true,
    whenReady: () => Promise.resolve(),
    getLoginItemSettings: () => ({ openAtLogin: login.at(-1)?.openAtLogin || false }),
    setLoginItemSettings: value => login.push(value),
    quit() {},
    exit: code => { throw new Error('Unexpected app exit: ' + code); }
  });
  class Window extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.webContents = Object.assign(new EventEmitter(), {
        mainFrame: { url: 'workspace://app/index.html' },
        setWindowOpenHandler() {},
        session: Object.assign(new EventEmitter(), { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} })
      });
      win = this;
    }
    async loadURL(url) { this.url = url; }
    maximize() {}
    show() {}
  }
  const electron = {
    app, BrowserWindow: Window, Menu: { setApplicationMenu() {} },
    protocol: { registerSchemesAsPrivileged() {}, handle: (_scheme, fn) => { handler = fn; } },
    net: { fetch: url => url },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    dialog: {
      showErrorBox: (_title, message) => assert.fail(message),
      showOpenDialog: async window => { chosen.push(window); return { canceled: false, filePaths: ['C:\\업무 자료'] }; }
    },
    clipboard: { writeText: text => copied.push(text) },
    shell: { openPath: async () => '' }
  };
  const mainPath = path.join(__dirname, '../electron/main.cjs');
  vm.runInNewContext(fs.readFileSync(mainPath, 'utf8'), {
    require: name => name === 'electron' ? electron
      : name === './folders.cjs' ? require('../electron/folders.cjs')
        : name === './window-state.cjs' ? { createWindowState: () => ({ get: () => ({ mini: false, alwaysOnTop: false }) }) }
          : require(name),
    __dirname: path.dirname(mainPath),
    process: { argv: [], env: {}, platform: 'win32', execPath: 'C:\\MyWorkCalendar.exe' },
    Response,
    URL,
    setTimeout,
    clearTimeout,
    console
  });
  await new Promise(resolve => setImmediate(resolve));
  const event = { sender: win.webContents, senderFrame: win.webContents.mainFrame };
  return { handlers, event, chosen, copied, login, win, protocol: handler };
}

test('native bridge rejects subframes and other pages', async () => {
  const { handlers, event } = await boot();
  for (const fn of handlers.values()) {
    await assert.rejects(Promise.resolve().then(() => fn({ sender: event.sender, senderFrame: { url: 'https://example.com' } })), /허용되지/);
    await assert.rejects(Promise.resolve().then(() => fn({ sender: {}, senderFrame: event.senderFrame })), /허용되지/);
  }
});

test('folder picker, clipboard, and startup settings reach native APIs', async () => {
  const { handlers, event, chosen, copied, login, win } = await boot();
  assert.equal(await handlers.get('desktop:choose-folder')(event), 'C:\\업무 자료');
  assert.equal(chosen[0], win);
  await handlers.get('desktop:copy-text')(event, '감사합니다.');
  assert.deepEqual(copied, ['감사합니다.']);
  await assert.rejects(handlers.get('desktop:copy-text')(event, {}));
  assert.throws(() => handlers.get('desktop:set-startup')(event, 'yes'));
  assert.equal(handlers.get('desktop:set-startup')(event, true).enabled, true);
  assert.equal(login[0].path, 'C:\\MyWorkCalendar.exe');
  assert.equal(win.options.webPreferences.nodeIntegration, false);
  assert.equal(win.options.webPreferences.contextIsolation, true);
  assert.equal(win.options.webPreferences.sandbox, true);
});

test('app protocol serves only UI assets and blocks other local files', async () => {
  const { protocol } = await boot();
  for (const url of ['workspace://app/package.json', 'workspace://app/electron/main.cjs', 'workspace://evil/index.html']) {
    assert.equal(protocol({ url }).status, 404);
  }
  assert.match(protocol({ url: 'workspace://app/index.html' }), /index\.html$/);
});
