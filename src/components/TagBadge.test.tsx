import assert from 'node:assert/strict';
import test from 'node:test';

import { getTagBadgeTone, TagBadge } from './TagBadge';

function renderClassName(tag: string): string {
  const element = TagBadge({ tag });
  return String(element.props.className || '');
}

test('known observation tag does not use silver fallback colors', () => {
  const className = renderClassName('观察中');

  assert.doesNotMatch(className, /\b(?:neutral|slate)-/);
});

test('unknown tags resolve to stable non-silver colors', () => {
  const firstClassName = renderClassName('冷门特色');
  const secondClassName = renderClassName('冷门特色');

  assert.equal(firstClassName, secondClassName);
  assert.doesNotMatch(firstClassName, /\b(?:neutral|slate)-/);
});

test('risk and value tags keep the original system color families', () => {
  assert.match(getTagBadgeTone('风险观察').className, /\borange-/);
  assert.match(getTagBadgeTone('性价比高').className, /\byellow-/);
});
