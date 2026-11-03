'use strict';

const { app, BrowserWindow, Menu, protocol, net, ipcMain, dialog, shell, clipboard } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openFolder } = require('./folders.cjs');

const ORIGIN = 'workspace://app/index.html';
const smoke = process.argv.includes('--smoke-test') && !app.isPackaged;
const root = path.join(__dirname, '..');
const assets = new Set(['index.html', 'style.css', 'script.js', 'desktop.js']);
let mainWindow;

protocol.registerSchemesAsPrivileged([
  { scheme: 'workspace', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);
// Keep storage independent of EXE location and temporary portable extraction folders.
app.setPath('userData', smoke
  ? path.join(app.getPath('temp'), 'MyWorkCalendar-smoke-' + process.pid)
  : path.join(app.getPath('appData'), 'MyWorkCalendar'));
app.setAppUserModelId('com.kyeongyuncho.myworkcalendar');

function trusted(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame || event.senderFrame.url !== ORIGIN) {
    throw new Error('허용되지 않은 요청입니다.');
  }
}

function startupState() {
  return {
    available: process.platform === 'win32' && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE,
    enabled: app.getLoginItemSettings().openAtLogin
  };
}

function registerHandlers() {
  ipcMain.handle('desktop:open-folder', (event, input) => {
    trusted(event);
    return openFolder(input, { stat: fs.stat, openPath: folder => shell.openPath(folder) });
  });
  ipcMain.handle('desktop:choose-folder', async event => {
    trusted(event);
    const result = await dialog.showOpenDialog(mainWindow, { title: '바로가기에 등록할 폴더', properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('desktop:get-startup', event => {
    trusted(event);
    return startupState();
  });
  ipcMain.handle('desktop:set-startup', (event, enabled) => {
    trusted(event);
    if (typeof enabled !== 'boolean' || !startupState().available) throw new Error('설치형 EXE에서 설정할 수 있습니다.');
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
    return startupState();
  });
  ipcMain.handle('desktop:copy-text', (event, text) => {
    trusted(event);
    if (typeof text !== 'string' || text.length > 10 * 1024 * 1024) throw new Error('복사할 내용이 올바르지 않습니다.');
    clipboard.writeText(text);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#edf1f6',
    title: 'MY WORKSPACE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  Menu.setApplicationMenu(null);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== ORIGIN) event.preventDefault();
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.webContents.session.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({ title: '업무 캘린더 JSON 백업 저장', defaultPath: item.getFilename() });
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  await mainWindow.loadURL(ORIGIN);
  if (!smoke) {
    mainWindow.maximize();
    mainWindow.show();
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    protocol.handle('workspace', request => {
      const url = new URL(request.url);
      const name = url.pathname.slice(1);
      if (url.host !== 'app' || !assets.has(name)) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(path.join(root, name)).href);
    });
    registerHandlers();
    await createWindow();
    if (smoke) {
      let timer;
      try {
        await Promise.race([
          require('../tests/electron-smoke.cjs')(mainWindow),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Electron smoke test timed out')), 90000);
          })
        ]);
      } finally {
        clearTimeout(timer);
      }
      console.log('Electron smoke test passed');
      app.exit(0);
    }
  }).catch(error => {
    console.error(error);
    if (!smoke) dialog.showErrorBox('MyWorkCalendar 실행 오류', error.message);
    app.exit(1);
  });
  app.on('window-all-closed', () => app.quit());
}
