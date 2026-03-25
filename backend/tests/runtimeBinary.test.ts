import test from 'node:test';
import assert from 'node:assert/strict';
import { augmentPathWithCommonBinaryDirs, normalizeSingBoxError, resolveBinaryPath } from '../src/utils/runtimeBinary';

test('resolveBinaryPath returns explicit path first', () => {
  assert.equal(resolveBinaryPath('sing-box', '/custom/bin/sing-box', ['/bin']), '/custom/bin/sing-box');
});

test('resolveBinaryPath finds executable from candidate directories', () => {
  assert.equal(resolveBinaryPath('sh', undefined, ['/bin']), '/bin/sh');
});

test('augmentPathWithCommonBinaryDirs appends missing dirs once', () => {
  const nextPath = augmentPathWithCommonBinaryDirs('/usr/bin:/bin', ['/bin', '/usr/local/bin']);
  assert.equal(nextPath, '/usr/bin:/bin:/usr/local/bin');
});

test('normalizeSingBoxError returns actionable message', () => {
  assert.match(
    normalizeSingBoxError('[monitor_performance] singbox_not_found', '/usr/local/bin/sing-box'),
    /未找到 sing-box 可执行文件/u,
  );
});
