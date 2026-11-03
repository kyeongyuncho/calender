'use strict';

if (window.desktop) {
  document.body.classList.add('desktop-app');
  const toolbar = make('div', 'desktop-toolbar');
  toolbar.setAttribute('aria-label', '창 표시 설정');
  const miniToggle = make('button', 'sub', '미니 모드');
  miniToggle.id = 'miniToggle';
  miniToggle.type = 'button';
  const pinLabel = make('label', 'pin-setting');
  const pin = make('input');
  pin.id = 'alwaysOnTop';
  pin.type = 'checkbox';
  pinLabel.append(pin, document.createTextNode('항상 위에'));
  toolbar.append(make('strong', '', 'MY WORKSPACE'), pinLabel, miniToggle);
  document.body.prepend(toolbar);

  const dashboard = make('section', 'mini-dashboard');
  dashboard.id = 'miniDashboard';
  dashboard.setAttribute('aria-label', '미니 업무 목록');
  const miniHeading = make('div', 'mini-heading');
  const headingText = make('div');
  headingText.append(make('h2', '', '오늘의 업무'), make('small', '', '오늘 업무와 미완료 지난 업무'));
  const addMini = make('button', 'primary', '＋ 등록');
  addMini.type = 'button';
  addMini.addEventListener('click', () => openModal());
  miniHeading.append(headingText, addMini);
  const miniList = make('div', 'mini-task-list');
  miniList.id = 'miniTaskList';
  const miniFooter = make('small', 'mini-footer', '창 위쪽 제목 표시줄로 이동 · 모서리로 크기 조절');
  dashboard.append(miniHeading, miniList, miniFooter);
  toolbar.after(dashboard);

  window.renderMiniDashboard = () => {
    const today = localDate();
    const shown = tasks.filter(task => task.date === today || (task.date < today && task.status !== '처리완료'))
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
    miniList.replaceChildren();
    if (!shown.length) miniList.append(make('p', 'mini-empty', '오늘 등록된 업무와 미완료 지난 업무가 없습니다.'));
    for (const task of shown) {
      const card = make('button', 'mini-task');
      card.type = 'button';
      card.style.setProperty('--status-color', COLORS[task.status]);
      card.append(make('strong', '', task.title), make('small', '', `${task.date} · ${task.category} · ${task.status}`));
      if (task.detail) card.append(make('span', 'mini-task-detail', task.detail));
      card.addEventListener('click', () => openDetail(task));
      miniList.append(card);
    }
  };
  window.renderMiniDashboard();

  let displayState = { mini: false, alwaysOnTop: false };
  function showState(state) {
    displayState = state;
    document.body.classList.toggle('mini-mode', state.mini);
    miniToggle.textContent = state.mini ? '전체 화면' : '미니 모드';
    miniToggle.setAttribute('aria-pressed', String(state.mini));
    pin.checked = state.alwaysOnTop;
  }
  miniToggle.disabled = true;
  pin.disabled = true;
  window.desktop.getWindowState().then(showState).catch(() => {
    alert('창 표시 설정을 읽지 못했습니다. 앱을 다시 실행해 주세요.');
  }).finally(() => { miniToggle.disabled = false; pin.disabled = false; });
  miniToggle.addEventListener('click', async () => {
    miniToggle.disabled = true;
    try {
      showState(await window.desktop.setMiniMode(!displayState.mini));
    } catch {
      alert('창 크기를 변경하지 못했습니다.');
    } finally { miniToggle.disabled = false; }
  });
  pin.addEventListener('change', async () => {
    pin.disabled = true;
    try {
      showState(await window.desktop.setAlwaysOnTop(pin.checked));
    } catch {
      pin.checked = displayState.alwaysOnTop;
      alert('항상 위에 표시 설정을 변경하지 못했습니다.');
    } finally { pin.disabled = false; }
  });

  const choose = make('button', 'sub', '📂 폴더 선택');
  choose.type = 'button';
  choose.hidden = true;
  $('utilityValueLabel').after(choose);
  $('foldersBtn').addEventListener('click', () => { choose.hidden = false; });
  $('snippetsBtn').addEventListener('click', () => { choose.hidden = true; });
  choose.addEventListener('click', async () => {
    try {
      const folder = await window.desktop.chooseFolder();
      if (folder) {
        $('utilityValue').value = folder;
        if (!$('utilityTitle').value.trim()) $('utilityTitle').value = folder.split(/[\\/]/).filter(Boolean).pop() || folder;
      }
    } catch {
      alert('폴더를 선택하지 못했습니다. 경로를 직접 입력해 주세요.');
    }
  });

  const label = make('label', 'startup-setting');
  const checkbox = make('input');
  checkbox.type = 'checkbox';
  checkbox.disabled = true;
  label.append(checkbox, document.createTextNode('Windows 시작 시 실행'));
  document.querySelector('.header-actions').prepend(label);
  window.desktop.getStartup().then(state => {
    checkbox.checked = state.enabled;
    checkbox.disabled = !state.available;
    if (!state.available) label.title = '설치형 EXE에서 설정할 수 있습니다.';
  }).catch(() => { label.title = '자동 시작 설정을 읽지 못했습니다.'; });
  checkbox.addEventListener('change', async () => {
    const desired = checkbox.checked;
    checkbox.disabled = true;
    try {
      const state = await window.desktop.setStartup(desired);
      checkbox.checked = state.enabled;
    } catch {
      checkbox.checked = !desired;
      alert('자동 시작 설정을 저장하지 못했습니다.');
    } finally {
      checkbox.disabled = false;
    }
  });
}
