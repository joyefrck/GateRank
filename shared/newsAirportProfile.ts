export const NEWS_AIRPORT_PROFILE_BLOCK = 'gaterank-airport-profile';
export const NEWS_AIRPORT_PROFILE_VERSION = 1;

export interface NewsAirportProfileEmbed {
  version: 1;
  airport_id: number;
  rank: number;
  name: string;
  status: string;
  website: string;
  report_url: string | null;
  airport_intro: string | null;
  founded_on: string | null;
  plan_price_month: number | null;
  has_trial: boolean;
  created_at: string | null;
  score: number | null;
  score_date: string | null;
  score_delta_vs_yesterday: {
    label: string;
    value: number | null;
  };
  tags: string[];
  capability_labels: string[];
}

export interface NewsAirportProfileBlockMatch {
  start: number;
  end: number;
  raw: string;
  json: string;
  embed: NewsAirportProfileEmbed | null;
}

const AIRPORT_PROFILE_BLOCK_PATTERN = /(^|\n):::\s*gaterank-airport-profile\s*\n([\s\S]*?)\n:::\s*(?=\n|$)/g;

export function serializeNewsAirportProfileEmbed(input: NewsAirportProfileEmbed): string {
  const embed = normalizeNewsAirportProfileEmbed({ ...input });
  return [
    '',
    `:::${NEWS_AIRPORT_PROFILE_BLOCK}`,
    JSON.stringify(embed),
    ':::',
    '',
  ].join('\n');
}

export function extractNewsAirportProfileEmbeds(markdown: string): NewsAirportProfileBlockMatch[] {
  const matches: NewsAirportProfileBlockMatch[] = [];
  for (const match of markdown.matchAll(AIRPORT_PROFILE_BLOCK_PATTERN)) {
    const leadingNewline = match[1] || '';
    const raw = match[0].slice(leadingNewline.length);
    const start = (match.index || 0) + leadingNewline.length;
    const json = (match[2] || '').trim();
    matches.push({
      start,
      end: start + raw.length,
      raw,
      json,
      embed: parseNewsAirportProfileEmbed(json),
    });
  }
  return matches;
}

export function removeNewsAirportProfileEmbedAt(markdown: string, start: number): string {
  const match = extractNewsAirportProfileEmbeds(markdown).find((item) => item.start === start);
  if (!match) {
    return markdown;
  }
  return `${markdown.slice(0, match.start)}${markdown.slice(match.end)}`.replace(/\n{4,}/g, '\n\n\n');
}

export function replaceNewsAirportProfileEmbeds(
  markdown: string,
  render: (embed: NewsAirportProfileEmbed, match: NewsAirportProfileBlockMatch) => string,
): string {
  const matches = extractNewsAirportProfileEmbeds(markdown);
  if (matches.length === 0) {
    return markdown;
  }

  let result = '';
  let cursor = 0;
  for (const match of matches) {
    result += markdown.slice(cursor, match.start);
    result += match.embed ? render(match.embed, match) : '';
    cursor = match.end;
  }
  result += markdown.slice(cursor);
  return result;
}

export function parseNewsAirportProfileEmbed(json: string): NewsAirportProfileEmbed | null {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return normalizeNewsAirportProfileEmbed(parsed);
  } catch {
    return null;
  }
}

export function normalizeNewsAirportProfileEmbed(input: Record<string, unknown>): NewsAirportProfileEmbed {
  const delta = isRecord(input.score_delta_vs_yesterday) ? input.score_delta_vs_yesterday : {};
  return {
    version: NEWS_AIRPORT_PROFILE_VERSION,
    airport_id: toInteger(input.airport_id),
    rank: Math.max(1, toInteger(input.rank)),
    name: toText(input.name),
    status: toText(input.status || 'normal'),
    website: toText(input.website),
    report_url: toNullableText(input.report_url),
    airport_intro: toNullableText(input.airport_intro),
    founded_on: toNullableText(input.founded_on),
    plan_price_month: toNullableNumber(input.plan_price_month),
    has_trial: Boolean(input.has_trial),
    created_at: toNullableText(input.created_at),
    score: toNullableNumber(input.score),
    score_date: toNullableText(input.score_date),
    score_delta_vs_yesterday: {
      label: toText(delta.label || '对比昨天'),
      value: toNullableNumber(delta.value),
    },
    tags: toTextList(input.tags).slice(0, 12),
    capability_labels: toTextList(input.capability_labels).slice(0, 12),
  };
}

function toInteger(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => toText(item)).filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
