'use strict';

if (window.desktop) {
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
