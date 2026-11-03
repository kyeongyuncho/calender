'use strict';

// =============================================================
// ★ 카테고리 수정은 아래 배열만 변경하세요! (추가/삭제/이름 변경)
// 기존 업무에 사용된 카테고리를 삭제해도 기존 데이터는 보존됩니다.
// =============================================================
const CATEGORIES = ['유선', '이메일', '업무포털', '공문서'];
// =============================================================
const KEY = 'my-work-calendar-v1'; // 이전 버전 데이터와 호환
const STATUSES = ['접수', '처리 중', '검토필요', '처리완료'];
const COLORS = {
  '접수': '#64748b',
  '처리 중': '#2563eb',
  '검토필요': '#d97706',
  '처리완료': '#059669'
};
const $ = id => document.getElementById(id);
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && localDate(new Date(s + 'T12:00:00')) === s;
const make = (tag, cls = '', value) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (value !== undefined) el.textContent = value;
  return el;
};
let tasks = [],
  selectedDate = null,
  editingId = null,
  view = new Date();
view.setDate(1);
function validTask(t) {
  return t &&
    typeof t.id === 'string' &&
    isDate(t.date) &&
    typeof t.title === 'string' &&
    typeof t.detail === 'string' &&
    STATUSES.includes(t.status) &&
    (t.category === undefined || typeof t.category === 'string');
}
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (Array.isArray(saved)) tasks = saved.filter(validTask).map(t => ({
    ...t,
    category: t.category || '미분류'
  }));
} catch (e) {
  alert('기존 저장 데이터를 읽지 못했습니다. 백업 파일을 확인하세요.');
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
    return true;
  } catch (e) {
    alert('자동 저장 실패: 브라우저 저장 공간을 확인해 주세요.');
    return false;
  }
}
function categories() {
  return [...new Set([...CATEGORIES, ...tasks.map(t => t.category || '미분류')])];
}
function populateCategories() {
  const existing = $('category').value,
    filter = $('categoryFilter').value;
  const opts = categories();
  $('category').replaceChildren(...opts.map(v => {
    const o = make('option', '', v);
    o.value = v;
    return o;
  }));
  $('categoryFilter').replaceChildren(...['전체', ...opts].map(v => {
    const o = make('option', '', v === '전체' ? '전체 카테고리' : v);
    o.value = v;
    return o;
  }));
  if (opts.includes(existing)) $('category').value = existing;
  if (filter === '전체' || opts.includes(filter)) $('categoryFilter').value = filter;
}
function renderStats() {
  const definitions = [
    ['전체 업무', tasks.length, 'all'],
    ['처리 중', tasks.filter(t => t.status === '처리 중').length, 'working'],
    ['검토필요', tasks.filter(t => t.status === '검토필요').length, 'review'],
    ['처리완료', tasks.filter(t => t.status === '처리완료').length, 'done']
  ];
  $('stats').replaceChildren(...definitions.map(([label, num, kind]) => {
    const box = make('div', `stat stat-${kind}`);
    const name = make('span', 'stat-name', label),
      number = make('strong', 'stat-number', String(num));
    box.append(name, number);
    return box;
  }));
}
function renderCalendar() {
  const y = view.getFullYear(),
    m = view.getMonth(),
    first = new Date(y, m, 1).getDay(),
    last = new Date(y, m + 1, 0).getDate();
  $('monthTitle').textContent = `${y}. ${String(m + 1).padStart(2, '0')}`;
  const cal = $('calendar');
  cal.style.setProperty('--weeks', String(Math.ceil((first + last) / 7)));
  cal.replaceChildren();
  ['일', '월', '화', '수', '목', '금', '토'].forEach(w => cal.append(make('div', 'weekday', w)));
  for (let i = 0; i < Math.ceil((first + last) / 7) * 7; i++) {
    const d = i - first + 1;
    if (d < 1 || d > last) {
      cal.append(make('div', 'day empty'));
      continue;
    }
    const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const btn = make('button', 'day' + (selectedDate === date ? ' selected' : '') + (localDate() === date ? ' today' : ''));
    btn.type = 'button';
    btn.append(make('span', 'daynum', String(d)));
    const dayTasks = tasks.filter(t => t.date === date);
    if (dayTasks.length) {
      btn.classList.add('has-tasks');
      const mainStatus = dayTasks.find(t => t.status === '검토필요')?.status || dayTasks.find(t => t.status === '처리 중')?.status || dayTasks[0].status;
      btn.style.setProperty('--day-accent', COLORS[mainStatus]);
    }
    dayTasks.slice(0, 3).forEach(t => {
      const chip = make('div', 'task-chip', t.title);
      chip.style.setProperty('--status-color', COLORS[t.status]);
      chip.title = t.title;
      btn.append(chip);
    });
    if (dayTasks.length > 3) btn.append(make('span', 'more', `+${dayTasks.length - 3}건`));
    btn.addEventListener('click', () => {
      selectedDate = selectedDate === date ? null : date;
      render();
    });
    cal.append(btn);
  }
}
function renderRows() {
  const body = $('taskRows');
  body.replaceChildren();
  const q = $('search').value.trim().toLowerCase(),
    st = $('filter').value,
    cat = $('categoryFilter').value;
  const shown = tasks.filter(t => (!selectedDate || t.date === selectedDate) &&
    (st === '전체' || t.status === st) &&
    (cat === '전체' || t.category === cat) &&
    (!q || `${t.title} ${t.detail} ${t.category}`.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date));
  $('listCount').textContent = `(${shown.length})`;
  $('activeDate').textContent = selectedDate ? `${selectedDate} 업무 · 날짜를 다시 누르면 해제` : '전체 날짜의 업무';
  if (!shown.length) {
    const tr = make('tr'),
      td = make('td', 'empty-row', '표시할 업무가 없습니다.');
    td.colSpan = 5;
    tr.append(td);
    body.append(tr);
    return;
  }
  shown.forEach(t => {
    const tr = make('tr', 'task-row');
    tr.style.setProperty('--status-color', COLORS[t.status]);
    tr.append(make('td', '', t.date));
    const catCell = make('td');
    catCell.append(make('span', 'category-tag', t.category));
    tr.append(catCell);
    const desc = make('td');
    desc.append(make('div', 'task-title', t.title));
    if (t.detail) desc.append(make('div', 'task-detail', t.detail));
    tr.append(desc);
    const state = make('td'),
      sel = make('select', 'status-select');
    sel.style.setProperty('--status-color', COLORS[t.status]);
    STATUSES.forEach(s => {
      const o = make('option', '', s);
      o.value = s;
      sel.append(o);
    });
    sel.value = t.status;
    sel.addEventListener('change', () => {
      const old = t.status;
      t.status = sel.value;
      if (!save()) t.status = old;
      render();
    });
    state.append(sel);
    tr.append(state);
    const actions = make('td'),
      wrap = make('div', 'row-actions'),
      edit = make('button', '', '수정'),
      del = make('button', 'danger', '삭제');
    edit.addEventListener('click', () => openModal(t));
    del.addEventListener('click', () => {
      if (!confirm(`「${t.title}」 업무를 삭제할까요?`)) return;
      const prev = tasks;
      tasks = tasks.filter(x => x.id !== t.id);
      if (!save()) tasks = prev;
      render();
    });
    wrap.append(edit, del);
    actions.append(wrap);
    tr.append(actions);
    tr.tabIndex = 0;
    tr.title = '클릭하면 업무 전체 내용을 확인할 수 있습니다';
    tr.addEventListener('click', e => {
      if (e.target.closest('button,select')) return;
      openDetail(t);
    });
    tr.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === tr) {
        e.preventDefault();
        openDetail(t);
      }
    });
    body.append(tr);
  });
}
function render() {
  populateCategories();
  renderStats();
  renderCalendar();
  renderRows();
}
function openModal(task = null) {
  editingId = task?.id || null;
  populateCategories();
  $('taskForm').reset();
  $('date').value = task?.date || selectedDate || localDate();
  $('title').value = task?.title || '';
  $('detail').value = task?.detail || '';
  $('status').value = task?.status || '접수';
  $('category').value = task?.category || CATEGORIES[0];
  $('formTitle').textContent = task ? '업무 수정' : '업무 등록';
  $('submit').textContent = task ? '수정 저장' : '등록하기';
  $('detailModal').hidden = true;
  $('modal').hidden = false;
  $('title').focus();
}
function closeModal() {
  $('modal').hidden = true;
  editingId = null;
}
$('taskForm').addEventListener('submit', e => {
  e.preventDefault();
  const date = $('date').value,
    title = $('title').value.trim(),
    detail = $('detail').value.trim(),
    status = $('status').value,
    category = $('category').value;
  if (!isDate(date) || !title || !STATUSES.includes(status) || !category) return alert('입력 내용을 확인해 주세요.');
  const prev = tasks.map(t => ({
    ...t
  }));
  if (editingId) {
    const t = tasks.find(t => t.id === editingId);
    if (t) Object.assign(t, {
      date,
      title,
      detail,
      status,
      category
    });
  } else tasks.push({
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    date,
    title,
    detail,
    status,
    category
  });
  if (!save()) {
    tasks = prev;
    return;
  }
  view = new Date(date + 'T12:00:00');
  view.setDate(1);
  closeModal();
  render();
});
$('add').addEventListener('click', () => openModal());
$('close').addEventListener('click', closeModal);
$('cancel').addEventListener('click', closeModal);
$('modal').addEventListener('click', e => {
  if (e.target === $('modal')) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('modal').hidden) closeModal();
});
$('prev').addEventListener('click', () => {
  view.setMonth(view.getMonth() - 1);
  renderCalendar();
});
$('next').addEventListener('click', () => {
  view.setMonth(view.getMonth() + 1);
  renderCalendar();
});
$('goToday').addEventListener('click', () => {
  view = new Date();
  view.setDate(1);
  selectedDate = localDate();
  render();
});
$('showAll').addEventListener('click', () => {
  selectedDate = null;
  render();
});
$('search').addEventListener('input', renderRows);
$('filter').addEventListener('change', renderRows);
$('categoryFilter').addEventListener('change', renderRows);
$('backup').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({
      app: 'MyWorkCalendar',
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks,
      snippets,
      folders
    }, null, 2)], {
      type: 'application/json'
    }),
    url = URL.createObjectURL(blob),
    a = make('a');
  a.href = url;
  a.download = `업무캘린더_백업_${localDate()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
});
$('restore').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw Error('10MB 이하 파일만 복원할 수 있습니다.');
    const data = JSON.parse(await file.text());
    if (!data || data.app !== 'MyWorkCalendar' || data.version !== 1 || !Array.isArray(data.tasks) || !data.tasks.every(validTask)) throw Error('올바른 백업 파일이 아닙니다.');
    if (!confirm(`현재 ${tasks.length}건을 백업 파일의 ${data.tasks.length}건으로 교체할까요?`)) return;
    const prev = tasks;
    tasks = data.tasks.map(t => ({
      ...t,
      category: t.category || '미분류'
    }));
    if (!save()) {
      tasks = prev;
      return;
    }
    if (Array.isArray(data.snippets)) snippets = cleanUtilities(data.snippets);
    if (Array.isArray(data.folders)) folders = cleanUtilities(data.folders);
    saveUtilities();
    selectedDate = null;
    render();
    alert('복원 완료!');
  } catch (err) {
    alert('복원 실패: ' + err.message);
  } finally {
    e.target.value = '';
  }
});
$('today').textContent = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'full'
}).format(new Date());
render();

// =============================================================
// v4: 업무 상세보기 · 자주 쓰는 답변 · 폴더 바로가기
// 폴더 경로 예: C:\\업무자료 또는 \\\\ileserver\\공유폴더
// 브라우저 보안 정책상 로컬 폴더 열기는 차단될 수 있습니다.
// =============================================================
const SNIPPETS_KEY = 'my-work-calendar-snippets-v1';
const FOLDERS_KEY = 'my-work-calendar-folders-v1';
function cleanUtilities(items) {
  return items.filter(x => x && typeof x.title === 'string' && typeof x.value === 'string').map(x => ({
    id: String(x.id || Date.now() + '-' + Math.random()),
    title: x.title.slice(0, 120),
    value: x.value.slice(0, 30000)
  }));
}
function loadUtilities(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(data) ? cleanUtilities(data) : [];
  } catch {
    return [];
  }
}
let snippets = loadUtilities(SNIPPETS_KEY),
  folders = loadUtilities(FOLDERS_KEY);
function saveUtilities() {
  try {
    localStorage.setItem(SNIPPETS_KEY, JSON.stringify(snippets));
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    return true;
  } catch {
    alert('저장에 실패했습니다. 브라우저 저장 공간을 확인하세요.');
    return false;
  }
}
function detailField(label, value) {
  const item = make('div', 'detail-field');
  item.append(make('div', 'field-label', label), make('div', 'field-value', value || '—'));
  return item;
}
function openDetail(t) {
  $('detailBody').replaceChildren();
  const grid = make('div', 'detail-grid');
  grid.append(detailField('업무일자', t.date), detailField('카테고리', t.category || '미분류'), detailField('진행상태', t.status));
  $('detailBody').append(grid, detailField('제목', t.title), detailField('상세 내용', t.detail || '등록된 내용이 없습니다.'));
  $('detailEdit').onclick = () => openModal(t);
  $('detailModal').hidden = false;
}
function closeDetail() {
  $('detailModal').hidden = true;
}
$('detailClose').onclick = closeDetail;
$('detailDismiss').onclick = closeDetail;
$('detailModal').addEventListener('click', e => {
  if (e.target === $('detailModal')) closeDetail();
});
let utilityMode = 'snippets',
  utilityEditId = null;
function currentUtilities() {
  return utilityMode === 'snippets' ? snippets : folders;
}
function openUtility(mode) {
  utilityMode = mode;
  utilityEditId = null;
  $('utilityForm').reset();
  $('utilityHeading').textContent = mode === 'snippets' ? '📋 자주 쓰는 답변' : '📁 폴더 바로가기';
  $('utilityValueLabel').firstChild.textContent = mode === 'snippets' ? '답변 내용' : '폴더 경로';
  $('utilityValue').placeholder = mode === 'snippets' ? '자주 사용하는 답변을 입력하세요' : '예: C:\\업무자료 또는 \\\\ileserver\\공유';
  $('utilityValue').rows = mode === 'snippets' ? 5 : 2;
  $('utilityFormHeading').textContent = '새 항목 등록';
  $('utilityModal').hidden = false;
  renderUtilities();
}
function resetUtility() {
  $('utilityForm').reset();
  utilityEditId = null;
  $('utilityFormHeading').textContent = '새 항목 등록';
}
function fileUrlFromPath(path) {
  const raw = path.trim();
  if (/^\\\\[^\\]+\\[^\\]+/.test(raw)) return 'file:' + raw.replace(/\\/g, '/');
  if (/^[A-Za-z]:[\\/]/.test(raw)) return 'file:///' + raw.replace(/\\/g, '/').split('/').map((seg, i) => i === 0 ? seg : encodeURIComponent(seg)).join('/');
  return null;
}
async function copyText(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const ta = make('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) throw Error('복사 권한 없음');
    }
    alert('클립보드에 복사했습니다.');
  } catch {
    window.prompt('자동 복사가 차단되었습니다. 아래 내용을 직접 복사하세요.', value);
  }
}
function renderUtilities() {
  const list = $('utilityList');
  list.replaceChildren();
  const items = currentUtilities();
  if (!items.length) {
    list.append(make('div', 'utility-empty', utilityMode === 'snippets' ? '등록된 답변이 없습니다.' : '등록된 폴더가 없습니다.'));
    return;
  }
  items.forEach(item => {
    const box = make('article', 'utility-item');
    box.append(make('strong', '', item.title));
    if (utilityMode !== 'snippets') box.append(make('p', '', item.value));else box.classList.add('snippet-compact');
    const buttons = make('div', 'utility-buttons');
    const copy = make('button', 'sub', utilityMode === 'snippets' ? '내용 복사' : '경로 복사');
    copy.onclick = () => copyText(item.value);
    buttons.append(copy);
    if (utilityMode === 'folders') {
      const open = make('button', 'sub', '폴더 열기 시도');
      open.onclick = () => {
        const url = fileUrlFromPath(item.value);
        if (!url) return alert('Windows 절대 경로(C:\\...) 또는 공유 폴더(\\\\서버\\공유)를 입력하세요.');
        const a = make('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.append(a);
        a.click();
        a.remove();
        alert('브라우저 보안 설정에 따라 폴더 열기가 차단될 수 있습니다. 열리지 않으면 「경로 복사」 후 Win + E 탐색기 주소창에 붙여넣으세요.');
      };
      buttons.append(open);
    }
    const edit = make('button', 'sub', '수정');
    edit.onclick = () => {
      utilityEditId = item.id;
      $('utilityTitle').value = item.title;
      $('utilityValue').value = item.value;
      $('utilityFormHeading').textContent = '항목 수정';
      $('utilityTitle').focus();
    };
    const del = make('button', 'danger', '삭제');
    del.onclick = () => {
      if (!confirm(`「${item.title}」 항목을 삭제할까요?`)) return;
      const old = [...items];
      const next = items.filter(x => x.id !== item.id);
      if (utilityMode === 'snippets') snippets = next;else folders = next;
      if (!saveUtilities()) {
        if (utilityMode === 'snippets') snippets = old;else folders = old;
      }
      resetUtility();
      renderUtilities();
    };
    buttons.append(edit, del);
    box.append(buttons);
    list.append(box);
  });
  if (utilityMode === 'folders') list.append(make('div', 'folder-note', '※ 일반 브라우저에서는 보안상 로컬 폴더 열기가 차단될 수 있습니다. 경로 복사는 항상 사용할 수 있도록 제공됩니다.'));
}
$('utilityForm').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('utilityTitle').value.trim(),
    value = $('utilityValue').value.trim();
  if (!title || !value) return;
  const items = currentUtilities(),
    old = [...items];
  let next;
  if (utilityEditId) next = items.map(x => x.id === utilityEditId ? {
    ...x,
    title,
    value
  } : x);else next = [...items, {
    id: crypto?.randomUUID?.() || String(Date.now() + Math.random()),
    title,
    value
  }];
  if (utilityMode === 'snippets') snippets = next;else folders = next;
  if (!saveUtilities()) {
    if (utilityMode === 'snippets') snippets = old;else folders = old;
    return;
  }
  resetUtility();
  renderUtilities();
});
$('utilityReset').onclick = resetUtility;
$('snippetsBtn').onclick = () => openUtility('snippets');
$('foldersBtn').onclick = () => openUtility('folders');
$('utilityClose').onclick = () => {
  $('utilityModal').hidden = true;
};
$('utilityModal').addEventListener('click', e => {
  if (e.target === $('utilityModal')) $('utilityModal').hidden = true;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    $('detailModal').hidden = true;
    $('utilityModal').hidden = true;
  }
});
