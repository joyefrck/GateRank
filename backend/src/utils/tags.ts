export const RISK_PRIORITY_TAGS = ['不推荐', '风险观察'] as const;

export const DISPLAY_TAG_ORDER = [
  '不推荐',
  '风险观察',
  '新入榜',
  '长期稳定',
  '新手友好',
  '性价比高',
  '高性能',
  '高端路线',
  '观察中',
] as const;

export function normalizeTagList(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return dedupeTags(value.map(String));
  }
  if (typeof value === 'object') {
    return [];
  }
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? dedupeTags(parsed.map(String)) : [];
  } catch {
    return [];
  }
}

export function mergeDisplayTags(manualTags: string[], autoTags: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const tag of RISK_PRIORITY_TAGS) {
    if (autoTags.includes(tag) && !seen.has(tag)) {
      result.push(tag);
      seen.add(tag);
    }
  }

  for (const tag of manualTags) {
    if (tag && !seen.has(tag)) {
      result.push(tag);
      seen.add(tag);
    }
  }

  for (const tag of DISPLAY_TAG_ORDER) {
    if (!(RISK_PRIORITY_TAGS as readonly string[]).includes(tag) && autoTags.includes(tag) && !seen.has(tag)) {
      result.push(tag);
      seen.add(tag);
    }
  }

  for (const tag of autoTags) {
    if (tag && !seen.has(tag)) {
      result.push(tag);
      seen.add(tag);
    }
  }

  return result;
}

export function sortDisplayTags(tags: string[]): string[] {
  return dedupeTags(tags).sort((left, right) => tagOrderIndex(left) - tagOrderIndex(right));
}

function tagOrderIndex(tag: string): number {
  const idx = DISPLAY_TAG_ORDER.indexOf(tag as (typeof DISPLAY_TAG_ORDER)[number]);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function dedupeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}
