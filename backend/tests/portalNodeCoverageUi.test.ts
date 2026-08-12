import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('applicant portal hides protected node coverage controls and omits regions from operations payload', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  const tabStart = source.indexOf('const PORTAL_PROFILE_TABS');
  const tabEnd = source.indexOf('interface PortalAccountView', tabStart);
  assert.notEqual(tabStart, -1);
  assert.notEqual(tabEnd, -1);
  const tabs = source.slice(tabStart, tabEnd);
  assert.doesNotMatch(tabs, /key: 'nodes'/);
  assert.doesNotMatch(tabs, /节点覆盖/);

  const operationsStart = source.indexOf('const saveApplicationOperations');
  const operationsEnd = source.indexOf('const openApplicationOperationsEditor', operationsStart);
  assert.notEqual(operationsStart, -1);
  assert.notEqual(operationsEnd, -1);
  const operations = source.slice(operationsStart, operationsEnd);
  assert.match(operations, /buildApplicantOperationsProfile\(applicationForm\.profile\)/);
  assert.doesNotMatch(operations, /profile:\s*normalizeAirportProfile\(applicationForm\.profile\)/);

  const editorStart = source.indexOf('const renderApplicationDetailsSection');
  const editorEnd = source.indexOf('const renderOnboardingGuide', editorStart);
  assert.notEqual(editorStart, -1);
  assert.notEqual(editorEnd, -1);
  const editor = source.slice(editorStart, editorEnd);
  assert.doesNotMatch(editor, /applicationProfileTab === 'nodes'/);
  assert.doesNotMatch(editor, /portal-region-/);

  const profileBuilderStart = source.indexOf('function buildApplicantOperationsProfile');
  assert.notEqual(profileBuilderStart, -1);
  const profileBuilder = source.slice(profileBuilderStart, profileBuilderStart + 500);
  assert.match(profileBuilder, /const \{ regions: _protectedRegions, \.\.\.applicantProfile \}/);
  assert.match(profileBuilder, /return applicantProfile/);
});
