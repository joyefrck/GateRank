import sanitizeHtml from 'sanitize-html';
import { Marked, type Tokens } from 'marked';
import type { NewsHeading } from '../utils/news';
import { estimateReadingMinutes, slugifyNewsText, stripHtml } from '../utils/news';

interface HeadingTokenWithId extends Tokens.Heading {
  _newsHeadingId?: string;
}

export interface RenderedNewsDocument {
  html: string;
  headings: NewsHeading[];
  reading_minutes: number;
  plain_text: string;
}

export class NewsContentService {
  render(markdown: string): RenderedNewsDocument {
    const headings: NewsHeading[] = [];
    const headingSlugCount = new Map<string, number>();
    const marked = new Marked();

    marked.use({
      gfm: true,
      breaks: true,
      async: false,
      walkTokens(token) {
        if (token.type !== 'heading') {
          return;
        }

        const headingToken = token as HeadingTokenWithId;
        const baseId = slugifyNewsText(headingToken.text);
        const currentCount = headingSlugCount.get(baseId) || 0;
        const headingId = currentCount === 0 ? baseId : `${baseId}-${currentCount + 1}`;
        headingSlugCount.set(baseId, currentCount + 1);
        headingToken._newsHeadingId = headingId;
        headings.push({
          id: headingId,
          level: headingToken.depth,
          text: headingToken.text,
        });
      },
      renderer: {
        heading(token) {
          const headingToken = token as HeadingTokenWithId;
          const level = Math.min(6, Math.max(1, headingToken.depth));
          const id = headingToken._newsHeadingId || slugifyNewsText(headingToken.text);
          const innerHtml = this.parser.parseInline(headingToken.tokens);
          return `<h${level} id="${escapeAttribute(id)}" class="news-heading news-heading-${level}">${innerHtml}</h${level}>`;
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
          const language = token.lang ? ` data-language="${escapeAttribute(token.lang)}"` : '';
          return `<pre class="news-code-block"><code class="news-code"${language}>${escapeHtml(token.text)}</code></pre>`;
        },
        table(token) {
          const headerHtml = token.header
            .map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`)
            .join('');
          const rowsHtml = token.rows
            .map((row) => `<tr>${row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`)
            .join('');
          return `<div class="news-table-wrap"><table class="news-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
        },
        image(token) {
          const src = escapeAttribute(token.href);
          const alt = escapeAttribute(token.text || '');
          const caption = token.title || token.text || '';
          const captionHtml = caption ? `<figcaption class="news-figure-caption">${escapeHtml(caption)}</figcaption>` : '';
          return `<figure class="news-figure"><img class="news-image" src="${src}" alt="${alt}" loading="lazy" />${captionHtml}</figure>`;
        },
        link(token) {
          const href = escapeAttribute(token.href);
          const isExternal = /^https?:\/\//i.test(token.href);
          const rel = isExternal ? ' rel="noreferrer noopener"' : '';
          const target = isExternal ? ' target="_blank"' : '';
          return `<a class="news-link" href="${href}"${target}${rel}>${this.parser.parseInline(token.tokens)}</a>`;
        },
        hr() {
          return '<hr class="news-divider" />';
        },
      },
    });

    const rawHtml = marked.parse(markdown, { async: false }) as string;
    const sanitizedHtml = sanitizeHtml(rawHtml, {
      allowedTags: [
        'a',
        'blockquote',
        'br',
        'code',
        'div',
        'em',
        'figcaption',
        'figure',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'hr',
        'img',
        'li',
        'ol',
        'p',
        'pre',
        'strong',
        'table',
        'tbody',
        'td',
        'th',
        'thead',
        'tr',
        'ul',
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel', 'class'],
        blockquote: ['class'],
        code: ['class', 'data-language'],
        div: ['class'],
        figcaption: ['class'],
        figure: ['class'],
        h1: ['id', 'class'],
        h2: ['id', 'class'],
        h3: ['id', 'class'],
        h4: ['id', 'class'],
        h5: ['id', 'class'],
        h6: ['id', 'class'],
        hr: ['class'],
        img: ['src', 'alt', 'loading', 'class'],
        li: ['class'],
        ol: ['class'],
        p: ['class'],
        pre: ['class'],
        table: ['class'],
        tbody: ['class'],
        td: ['class'],
        th: ['class'],
        thead: ['class'],
        tr: ['class'],
        ul: ['class'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowProtocolRelative: false,
    });

    return {
      html: sanitizedHtml,
      headings,
      reading_minutes: estimateReadingMinutes(markdown),
      plain_text: stripHtml(sanitizedHtml),
    };
  }
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
