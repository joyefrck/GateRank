import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const adminSource = readFileSync(resolve(process.cwd(), 'src/admin/AdminApp.tsx'), 'utf8');

test('SMTP settings exposes the merged HTML ad expiry reminder scenario', () => {
  assert.match(adminSource, /\| 'ad_expiry_reminder'/);
  assert.match(adminSource, /'ad_expiry_reminder',/);
  assert.match(adminSource, /title: '广告到期提醒邮件'/);
  assert.match(adminSource, /广告到期前第 3、2、1 天，北京时间上午 9 点按申请人合并发送/);
  assert.match(adminSource, /\{\{campaign_count\}\}/);
  assert.match(adminSource, /\{\{campaign_items\}\}/);
  assert.match(adminSource, /\{\{portal_login_url\}\}/);
  assert.match(adminSource, /HTML 模板/);
});

test('SMTP settings previews ad reminder HTML in a script-disabled sandbox', () => {
  assert.match(adminSource, /templateEditorKey === 'ad_expiry_reminder'/);
  assert.match(adminSource, /<iframe/);
  assert.match(adminSource, /sandbox=""/);
  assert.match(adminSource, /srcDoc=\{templatePreview\?\.body \|\| ''\}/);
  assert.doesNotMatch(adminSource, /sandbox="allow-scripts/);
});

test('scheduler UI labels the ad expiry reminder task', () => {
  assert.match(adminSource, /taskKey === 'ad_expiry_reminder'/);
  assert.match(adminSource, /return '广告到期提醒'/);
});
