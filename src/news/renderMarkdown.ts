import { Marked, type Tokens } from 'marked';

interface HeadingTokenWithId extends Tokens.Heading {
  _newsHeadingId?: string;
}

export interface RenderedNewsPreview {
  html: string;
  headings: Array<{ id: string; level: number; text: string }>;
  readingMinutes: number;
}

export function slugifyNewsText(value: string): string {
  const normalized = value.normalize('NFKC').trim().toLowerCase();
  let slug = '';
  let shouldInsertSeparator = false;

  for (const char of normalized) {
    const codePoint = char.codePointAt(0);
    if (!codePoint) {
      continue;
    }

    const isAsciiLower = codePoint >= 97 && codePoint <= 122;
    const isDigit = codePoint >= 48 && codePoint <= 57;
    if (isAsciiLower || isDigit) {
      if (shouldInsertSeparator && slug) {
        slug += '-';
      }
      slug += char;
      shouldInsertSeparator = false;
      continue;
    }

    if (/[\s_-]/.test(char)) {
      shouldInsertSeparator = slug.length > 0;
      continue;
    }

    if (/[\p{Letter}\p{Number}]/u.test(char)) {
      if (shouldInsertSeparator && slug) {
        slug += '-';
      }
      slug += `u${codePoint.toString(36)}`;
      shouldInsertSeparator = false;
      continue;
    }

    shouldInsertSeparator = slug.length > 0;
  }

  return slug.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
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

  return Math.max(1, Math.ceil((words + Math.ceil(cjkChars / 2)) / 220));
}

export function renderNewsPreview(markdown: string): RenderedNewsPreview {
  const marked = new Marked();
  const headings: RenderedNewsPreview['headings'] = [];
  const slugCount = new Map<string, number>();

  marked.use({
    gfm: true,
    breaks: true,
    async: false,
    walkTokens(token) {
      if (token.type !== 'heading') {
        return;
      }
      const headingToken = token as HeadingTokenWithId;
      const baseSlug = slugifyNewsText(headingToken.text);
      const count = slugCount.get(baseSlug) || 0;
      const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
      slugCount.set(baseSlug, count + 1);
      headingToken._newsHeadingId = slug;
      headings.push({ id: slug, level: headingToken.depth, text: headingToken.text });
    },
    renderer: {
      html() {
        return '';
      },
      heading(token) {
        const headingToken = token as HeadingTokenWithId;
        const level = Math.min(6, Math.max(1, headingToken.depth));
        return `<h${level} id="${escapeAttribute(headingToken._newsHeadingId || slugifyNewsText(headingToken.text))}" class="news-heading news-heading-${level}">${this.parser.parseInline(headingToken.tokens)}</h${level}>`;
      },
      paragraph(token) {
        return `<p class="news-paragraph">${this.parser.parseInline(token.tokens)}</p>`;
      },
      blockquote(token) {
        return `<blockquote class="news-blockquote">${this.parser.parse(token.tokens)}</blockquote>`;
      },
      list(token) {
        const tag = token.ordered ? 'ol' : 'ul';
        const className = token.ordered ? 'news-list news-list-ordered' : 'news-list news-list-unordered';
        const itemsHtml = token.items
          .map((item) => `<li class="news-list-item">${this.parser.parse(item.tokens)}</li>`)
          .join('');
        return `<${tag} class="${className}">${itemsHtml}</${tag}>`;
      },
      code(token) {
        return `<pre class="news-code-block"><code class="news-code">${escapeHtml(token.text)}</code></pre>`;
      },
      image(token) {
        const caption = token.title || token.text || '';
        return `<figure class="news-figure"><img class="news-image" src="${escapeAttribute(token.href)}" alt="${escapeAttribute(token.text || '')}" loading="lazy" />${caption ? `<figcaption class="news-figure-caption">${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
      },
      link(token) {
        const isExternal = /^https?:\/\//i.test(token.href);
        const target = isExternal ? ' target="_blank" rel="noreferrer noopener"' : '';
        return `<a class="news-link" href="${escapeAttribute(token.href)}"${target}>${this.parser.parseInline(token.tokens)}</a>`;
      },
      hr() {
        return '<hr class="news-divider" />';
      },
    },
  });

  return {
    html: marked.parse(markdown, { async: false }) as string,
    headings,
    readingMinutes: estimateReadingMinutes(markdown),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
