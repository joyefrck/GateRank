import path from 'node:path';

export interface NewsHeading {
  id: string;
  level: number;
  text: string;
}

export function slugifyNewsText(value: string): string {
  const normalized = value.normalize('NFKC').trim().toLowerCase();
  let normalizedSlug = '';
  let shouldInsertSeparator = false;

  for (const char of normalized) {
    const codePoint = char.codePointAt(0);
    if (!codePoint) {
      continue;
    }

    const isAsciiLower = codePoint >= 97 && codePoint <= 122;
    const isDigit = codePoint >= 48 && codePoint <= 57;
    if (isAsciiLower || isDigit) {
      if (shouldInsertSeparator && normalizedSlug) {
        normalizedSlug += '-';
      }
      normalizedSlug += char;
      shouldInsertSeparator = false;
      continue;
    }

    if (/[\s_-]/.test(char)) {
      shouldInsertSeparator = normalizedSlug.length > 0;
      continue;
    }

    if (/[\p{Letter}\p{Number}]/u.test(char)) {
      if (shouldInsertSeparator && normalizedSlug) {
        normalizedSlug += '-';
      }
      normalizedSlug += `u${codePoint.toString(36)}`;
      shouldInsertSeparator = false;
      continue;
    }

    shouldInsertSeparator = normalizedSlug.length > 0;
  }

  normalizedSlug = normalizedSlug.replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  return normalizedSlug || `news-${Date.now().toString(36)}`;
}

export function estimateReadingMinutes(value: string): number {
  const words = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/[#>*_\-\n]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const cjkChars = (value.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) || [])
    .length;

  const estimatedWords = words + Math.ceil(cjkChars / 2);
  return Math.max(1, Math.ceil(estimatedWords / 220));
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function fileExtensionFromMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/avif':
      return '.avif';
    default:
      return path.extname(mimeType) || '';
  }
}

export function formatNewsDate(value: string | null): string {
  if (!value) {
    return '未发布';
  }

  const date = new Date(value.replace(' ', 'T') + '+08:00');
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatNewsDateTime(value: string | null): string {
  if (!value) {
    return '未发布';
  }

  const date = new Date(value.replace(' ', 'T') + '+08:00');
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
