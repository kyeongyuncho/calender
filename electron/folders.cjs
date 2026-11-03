'use strict';

const path = require('node:path');

function normalizeFolder(input) {
  if (typeof input !== 'string' || input.length > 32767) {
    throw new Error('폴더 경로를 입력하세요.');
  }
  let value = input.trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  value = value.replace(/\//g, '\\');
  if (/[\x00-\x1f<>"|?*]/.test(value) || /^\\\\[?.]\\/.test(value)) {
    throw new Error('일반 Windows 폴더 경로만 사용할 수 있습니다.');
  }
  const drive = /^[A-Za-z]:\\/.test(value);
  const share = /^\\\\[^\\:]+\\[^\\:]+(?:\\|$)/.test(value);
  if ((!drive && !share) || (drive ? value.slice(2) : value).includes(':')) {
    throw new Error('C:\\업무자료 또는 \\\\서버\\공유 형식의 절대 경로를 입력하세요.');
  }
  return path.win32.normalize(value);
}

async function openFolder(input, { stat, openPath }) {
  try {
    const folder = normalizeFolder(input);
    let timer;
    let info;
    try {
      info = await Promise.race([
        stat(folder),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('폴더에 연결할 수 없습니다. 네트워크 연결을 확인하세요.')), 8000);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
    if (!info.isDirectory()) return { ok: false, error: '파일이 아닌 폴더를 선택하세요.' };
    const error = await openPath(folder);
    return error ? { ok: false, error: '폴더를 열지 못했습니다: ' + error } : { ok: true };
  } catch (error) {
    const message = ['ENOENT', 'ENOTDIR'].includes(error.code)
      ? '폴더를 찾을 수 없습니다. 저장된 경로를 확인하세요.'
      : ['EACCES', 'EPERM'].includes(error.code)
        ? '폴더에 접근할 권한이 없습니다.'
        : error.message;
    return { ok: false, error: message };
  }
}

module.exports = { normalizeFolder, openFolder };
