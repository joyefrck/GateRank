import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(
  resolve(process.cwd(), 'src/pages/dnsLeakTest/DNSLeakTestPage.tsx'),
  'utf8',
);

test('DNS resolver desktop evidence uses a semantic table and persistent help', () => {
  assert.match(pageSource, /<table/);
  assert.match(pageSource, /<thead/);
  assert.match(pageSource, /<tbody/);
  for (const heading of ['解析器 IP', '位置', '所属网络', '查询证据']) {
    assert.match(pageSource, new RegExp(heading));
  }
  assert.match(pageSource, /每一行代表一个实际访问 GateRank 权威探针/);
  assert.match(pageSource, /相同运营商的多行记录不一定是重复或异常/);
  assert.match(pageSource, /不能据此判断 DoH 或 DoT/);
  assert.doesNotMatch(pageSource, /<Server/);
});

test('DNS resolver mobile evidence uses labeled rows without horizontal scrolling', () => {
  assert.match(pageSource, /md:hidden/);
  for (const label of ['位置', '所属网络', '自治系统编号', '查询类型']) {
    assert.match(pageSource, new RegExp(label));
  }
  assert.match(pageSource, /break-all/);
  assert.doesNotMatch(pageSource, /overflow-x-auto/);
});
