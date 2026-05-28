export const NEWS_AIRPORT_LINK_BLOCK = 'gaterank-airport-link';
export const NEWS_AIRPORT_LINK_VERSION = 1;

export interface NewsAirportLinkEmbed {
  version: 1;
  airport_id: number;
  name: string;
  website: string;
}

export interface NewsAirportLinkBlockMatch {
  start: number;
  end: number;
  raw: string;
  json: string;
  embed: NewsAirportLinkEmbed | null;
}

const AIRPORT_LINK_BLOCK_PATTERN = /(^|\n):::\s*gaterank-airport-link\s*\n([\s\S]*?)\n:::\s*(?=\n|$)/g;

export function serializeNewsAirportLinkEmbed(input: NewsAirportLinkEmbed): string {
  const embed = normalizeNewsAirportLinkEmbed({ ...input });
  return [
    '',
    `:::${NEWS_AIRPORT_LINK_BLOCK}`,
    JSON.stringify(embed),
    ':::',
    '',
  ].join('\n');
}

export function extractNewsAirportLinkEmbeds(markdown: string): NewsAirportLinkBlockMatch[] {
  const matches: NewsAirportLinkBlockMatch[] = [];
  for (const match of markdown.matchAll(AIRPORT_LINK_BLOCK_PATTERN)) {
    const leadingNewline = match[1] || '';
    const raw = match[0].slice(leadingNewline.length);
    const start = (match.index || 0) + leadingNewline.length;
    const json = (match[2] || '').trim();
    matches.push({
      start,
      end: start + raw.length,
      raw,
      json,
      embed: parseNewsAirportLinkEmbed(json),
    });
  }
  return matches;
}

export function removeNewsAirportLinkEmbedAt(markdown: string, start: number): string {
  const match = extractNewsAirportLinkEmbeds(markdown).find((item) => item.start === start);
  if (!match) {
    return markdown;
  }
  return `${markdown.slice(0, match.start)}${markdown.slice(match.end)}`.replace(/\n{4,}/g, '\n\n\n');
}

export function replaceNewsAirportLinkEmbeds(
  markdown: string,
  render: (embed: NewsAirportLinkEmbed, match: NewsAirportLinkBlockMatch) => string,
): string {
  const matches = extractNewsAirportLinkEmbeds(markdown);
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

export function parseNewsAirportLinkEmbed(json: string): NewsAirportLinkEmbed | null {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return normalizeNewsAirportLinkEmbed(parsed);
  } catch {
    return null;
  }
}

export function normalizeNewsAirportLinkEmbed(input: Record<string, unknown>): NewsAirportLinkEmbed {
  return {
    version: NEWS_AIRPORT_LINK_VERSION,
    airport_id: toInteger(input.airport_id),
    name: toText(input.name),
    website: toText(input.website),
  };
}

function toInteger(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : 0;
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}
