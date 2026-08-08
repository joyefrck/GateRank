import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('admin performance tab renders accessible per-region controls before node selection', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/admin/AdminApp.tsx'), 'utf8');

  assert.ok(source.indexOf('测试地区配置') < source.indexOf('性能测试节点'));
  assert.match(source, /开启测试/);
  assert.match(source, /并入测试结果/);
  assert.match(source, /从下一轮性能采集生效，不修改历史成绩/);
  assert.match(source, /role="switch"/);
  assert.match(source, /aria-checked=/);
  assert.match(source, /min-h-10/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /配置已被其他管理员更新/);
  assert.match(source, /≥180 Mbps，达到探针带宽上限/);
  assert.match(source, /probe_runs/);
});
