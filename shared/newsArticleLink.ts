export interface NewsArticleLinkInput {
  title: string;
  url: string;
}

export function serializeNewsArticleLink(input: NewsArticleLinkInput): string {
  const title = escapeMarkdownLinkText(input.title.trim());
  const url = normalizeNewsArticleLinkUrl(input.url);
  if (!title || !url) {
    return '';
  }
  return `\n\n[${title}](<${url}>)\n\n`;
}

export function normalizeNewsArticleLinkUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/[\\[\]]/g, (char) => `\\${char}`);
}
