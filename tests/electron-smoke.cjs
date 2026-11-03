'use strict';

const assert = require('node:assert/strict');
const { clipboard } = require('electron');

module.exports = async function smoke(window) {
  const contents = window.webContents;
  contents.session.on('will-download', (_event, item) => item.cancel());
  const initial = await contents.executeJavaScript(`(async () => {
    if (!window.desktop) throw Error('preload bridge missing');
    if (typeof require !== 'undefined' || typeof process !== 'undefined') throw Error('Node exposed');
    if (document.querySelectorAll('.day').length < 28) throw Error('Calendar did not render');
    const state = await window.desktop.getStartup();
    const bad = await window.desktop.openFolder('https://example.com');
    if (bad.ok) throw Error('Invalid folder accepted');
    await window.desktop.copyText('캘린더 복사 테스트');
    window.alert = () => {};
    window.confirm = () => true;
    document.getElementById('add').click();
    document.getElementById('date').value = '2026-11-03';
    document.getElementById('title').value = '저장 테스트';
    document.getElementById('detail').value = '한글 · 줄바꿈\\n둘째 줄';
    document.getElementById('taskForm').requestSubmit();
    const saved = JSON.parse(localStorage.getItem('my-work-calendar-v1'));
    if (saved.length !== 1 || saved[0].title !== '저장 테스트') throw Error('Save failed');
    document.getElementById('foldersBtn').click();
    const choose = [...document.querySelectorAll('button')].find(x => x.textContent === '📂 폴더 선택');
    if (!choose || choose.hidden) throw Error('Folder picker missing');
    document.getElementById('utilityTitle').value = '업무 자료';
    document.getElementById('utilityValue').value = 'C:\\\\업무 자료';
    document.getElementById('utilityForm').requestSubmit();
    const folders = JSON.parse(localStorage.getItem('my-work-calendar-folders-v1'));
    if (folders.length !== 1) throw Error('Folder save failed');
    const create = URL.createObjectURL.bind(URL);
    let backup;
    URL.createObjectURL = blob => { backup = blob; return create(blob); };
    document.getElementById('backup').click();
    const exported = JSON.parse(await backup.text());
    URL.createObjectURL = create;
    if (exported.app !== 'MyWorkCalendar' || exported.version !== 1 || exported.folders.length !== 1) throw Error('Backup failed');
    exported.tasks[0].title = '복원 테스트';
    exported.snippets = [{ id: 's1', title: '답변', value: '감사합니다.' }];
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify(exported)], 'backup.json', { type: 'application/json' }));
    const restore = document.getElementById('restore');
    restore.files = transfer.files;
    restore.dispatchEvent(new Event('change'));
    for (let i = 0; i < 100; i++) {
      if (JSON.parse(localStorage.getItem('my-work-calendar-v1'))[0].title === '복원 테스트') break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return { title: JSON.parse(localStorage.getItem('my-work-calendar-v1'))[0].title,
      snippets: JSON.parse(localStorage.getItem('my-work-calendar-snippets-v1')), available: state.available };
  })()`);
  assert.equal(initial.title, '복원 테스트');
  assert.equal(initial.snippets[0].value, '감사합니다.');
  assert.equal(await clipboard.readText(), '캘린더 복사 테스트');
  const loaded = new Promise(resolve => contents.once('did-finish-load', resolve));
  contents.reload();
  await loaded;
  const persisted = await contents.executeJavaScript(`({
    title: JSON.parse(localStorage.getItem('my-work-calendar-v1'))[0].title,
    count: document.querySelectorAll('#taskRows .task-row').length,
    folderCount: JSON.parse(localStorage.getItem('my-work-calendar-folders-v1')).length
  })`);
  assert.deepEqual(persisted, { title: '복원 테스트', count: 1, folderCount: 1 });
  await contents.executeJavaScript('window.desktop.setMiniMode(true)');
  const miniLoaded = new Promise(resolve => contents.once('did-finish-load', resolve));
  contents.reload();
  await miniLoaded;
  const mini = await contents.executeJavaScript(`(async () => {
    for (let i = 0; i < 100 && !document.body.classList.contains('mini-mode'); i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const today = new Date();
    document.getElementById('add').click();
    document.getElementById('date').value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    document.getElementById('title').value = '미니 모드 업무';
    document.getElementById('taskForm').requestSubmit();
    const checkbox = document.getElementById('alwaysOnTop');
    checkbox.click();
    for (let i = 0; i < 100; i++) {
      if ((await window.desktop.getWindowState()).alwaysOnTop) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return { mini: document.body.classList.contains('mini-mode'),
      visible: getComputedStyle(document.getElementById('miniDashboard')).display !== 'none',
      task: document.getElementById('miniTaskList').textContent.includes('미니 모드 업무'),
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      state: await window.desktop.getWindowState() };
  })()`);
  assert.equal(mini.mini, true);
  assert.equal(mini.visible, true);
  assert.equal(mini.task, true);
  assert.ok(mini.width <= mini.viewport, 'mini mode must not overflow horizontally');
  assert.equal(mini.state.alwaysOnTop, true);
  assert.equal(window.isAlwaysOnTop(), true);
  assert.ok(window.getBounds().width <= 500);
  // Keep a compact visual preview in CI logs for review without user data.
  console.log('MINI_PREVIEW_BASE64:' + (await window.capturePage()).toPNG().toString('base64'));
  const normal = await contents.executeJavaScript(`(async () => {
    document.getElementById('miniToggle').click();
    for (let i = 0; i < 100 && document.body.classList.contains('mini-mode'); i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    await window.desktop.setAlwaysOnTop(false);
    return { mini: document.body.classList.contains('mini-mode'), state: await window.desktop.getWindowState() };
  })()`);
  assert.equal(normal.mini, false);
  assert.equal(normal.state.mini, false);
  assert.equal(window.isAlwaysOnTop(), false);
};
