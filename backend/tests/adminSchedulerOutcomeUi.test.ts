import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const adminSource = readFileSync(resolve(process.cwd(), 'src/admin/AdminApp.tsx'), 'utf8');

test('scheduler admin renders partial outcomes with exact counts and expandable failures', () => {
  assert.match(adminSource, /部分成功/);
  assert.match(adminSource, /成功执行/);
  assert.match(adminSource, /失败执行/);
  assert.match(adminSource, /最近处理结果/);
  assert.match(adminSource, /失败\/部分成功/);
  assert.match(adminSource, /查看.*失败项/);
  assert.match(adminSource, /历史失败项未保存明细/);
  assert.match(adminSource, /<details/);
  assert.match(adminSource, /SchedulerOutcomeBadge/);
  assert.match(adminSource, /SchedulerResultSummary/);
  assert.match(adminSource, /SchedulerFailureDetails/);
  assert.match(adminSource, /SchedulerStageSummary/);
  assert.match(adminSource, /中心采集/);
  assert.match(adminSource, /区域派发/);
});
