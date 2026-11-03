'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeFolder, openFolder } = require('../electron/folders.cjs');

test('accepts Korean paths, spaces, quotes, drive root, and UNC shares', () => {
  for (const [input, expected] of [
    [' C:/업무 자료/2026 ', 'C:\\업무 자료\\2026'],
    ['"D:\\자료"', 'D:\\자료'],
    ['C:\\', 'C:\\'],
    ['\\\\server\\공유 폴더\\자료', '\\\\server\\공유 폴더\\자료']
  ]) assert.equal(normalizeFolder(input), expected);
});

test('rejects URLs, relative paths, device paths, wildcards and alternate streams', () => {
  for (const input of [null, 2, '', '../test', 'C:relative', '\\relative',
    'https://example.com', 'file:///C:/test', 'C:\\file:stream',
    '\\\\?\\C:\\test', '\\\\.\\pipe\\test', 'C:\\*.txt', 'C:\\a\u0000b',
    '\\\\server', '\\\\server\\share:stream']) {
    assert.throws(() => normalizeFolder(input), String(input));
  }
});

test('opens only an existing directory using the OS API', async () => {
  const calls = [];
  const result = await openFolder('C:/업무 자료', {
    stat: async value => { calls.push(['stat', value]); return { isDirectory: () => true }; },
    openPath: async value => { calls.push(['open', value]); return ''; }
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [['stat', 'C:\\업무 자료'], ['open', 'C:\\업무 자료']]);
});

test('does not open files or missing/inaccessible directories', async () => {
  for (const code of ['ENOENT', 'EACCES', 'EPERM', 'ENOTDIR', null]) {
    const result = await openFolder('C:\\test', {
      stat: async () => {
        if (code) throw Object.assign(new Error('failed'), { code });
        return { isDirectory: () => false };
      },
      openPath: async () => assert.fail('must not open')
    });
    assert.equal(result.ok, false);
    assert.ok(result.error);
  }
});

test('reports shell errors and rejects invalid paths before filesystem access', async () => {
  const result = await openFolder('C:\\test', {
    stat: async () => ({ isDirectory: () => true }),
    openPath: async () => 'Access denied'
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /Access denied/);
  const invalid = await openFolder('https://example.com', {
    stat: async () => assert.fail('must not stat'),
    openPath: async () => assert.fail('must not open')
  });
  assert.equal(invalid.ok, false);
});

test('keeps v4.1 storage keys and backup format', () => {
  const script = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
  for (const key of ['my-work-calendar-v1', 'my-work-calendar-snippets-v1', 'my-work-calendar-folders-v1']) {
    assert.ok(script.includes("'" + key + "'"));
  }
  assert.match(script, /app: 'MyWorkCalendar',\s+version: 1,/);
});
