import sanitizeHtml from 'sanitize-html';
import { Marked, type Tokens } from 'marked';
import type { NewsHeading } from '../utils/news';
import { estimateReadingMinutes, slugifyNewsText, stripHtml } from '../utils/news';
import {
  replaceNewsAirportProfileEmbeds,
  type NewsAirportProfileEmbed,
} from '../../../shared/newsAirportProfile';

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
    const markdownWithEmbeds = replaceNewsAirportProfileEmbeds(
      markdown,
      (embed) => renderAirportProfileEmbed(embed),
    );

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

    const rawHtml = marked.parse(markdownWithEmbeds, { async: false }) as string;
    const sanitizedHtml = sanitizeHtml(rawHtml, {
      allowedTags: [
        'a',
        'article',
        'blockquote',
        'br',
        'code',
        'dd',
        'div',
        'dl',
        'dt',
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
        'span',
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
        article: ['class'],
        blockquote: ['class'],
        code: ['class', 'data-language'],
        dd: ['class'],
        div: ['class'],
        dl: ['class'],
        dt: ['class'],
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
        span: ['class'],
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
      reading_minutes: estimateReadingMinutes(markdownWithEmbeds),
      plain_text: stripHtml(sanitizedHtml),
    };
  }
}

function renderAirportProfileEmbed(embed: NewsAirportProfileEmbed): string {
  const intro = embed.airport_intro || '该机场已进入正式榜单，当前公开页提供官网入口、标签、成立日期、价格与试用支持信息，便于用户快速完成横向比较。';
  const websiteHref = safeExternalHref(embed.website);
  const reportHref = safeInternalOrExternalHref(embed.report_url || '');
  const metricItems = [
    ['成立日期', formatValue(embed.founded_on)],
    ['月付价格', formatCurrency(embed.plan_price_month)],
    ['试用支持', embed.has_trial ? '支持试用' : '暂不支持'],
    ['收录日期', formatValue(embed.created_at)],
    ['公开分数', formatScore(embed.score)],
    [embed.score_delta_vs_yesterday.label || '对比昨天', formatDelta(embed.score_delta_vs_yesterday.value)],
  ];
  const badges = [...embed.tags, ...embed.capability_labels].slice(0, 18);

  const metricsHtml = metricItems.map(([label, value]) => {
    const isDelta = label === (embed.score_delta_vs_yesterday.label || '对比昨天');
    return [
      '<div class="news-airport-profile-metric">',
      `<dt>${escapeHtml(label)}</dt>`,
      `<dd class="${isDelta ? deltaClass(embed.score_delta_vs_yesterday.value) : ''}">${escapeHtml(value)}</dd>`,
      '</div>',
    ].join('');
  }).join('');
  const badgesHtml = badges.length > 0
    ? `<div class="news-airport-profile-badges">${badges.map((tag) => `<span class="news-airport-profile-badge">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';
  const websiteAction = websiteHref
    ? `<a class="news-airport-profile-primary-link" href="${escapeAttribute(websiteHref)}" target="_blank" rel="noreferrer noopener">打开官网</a>`
    : '<span class="news-airport-profile-disabled-link">暂无官网</span>';
  const reportAction = reportHref
    ? `<a class="news-airport-profile-secondary-link" href="${escapeAttribute(reportHref)}">查看测评报告</a>`
    : '<span class="news-airport-profile-disabled-link">暂无测评报告</span>';

  return [
    '<article class="news-airport-profile-card">',
    '<div class="news-airport-profile-rank">',
    '<div class="news-airport-profile-rank-label">Rank</div>',
    `<div class="news-airport-profile-rank-value">#${escapeHtml(String(embed.rank))}</div>`,
    '<div class="news-airport-profile-score-block">',
    '<div class="news-airport-profile-rank-label">Score</div>',
    `<div class="news-airport-profile-score">${escapeHtml(formatScore(embed.score))}</div>`,
    '<div class="news-airport-profile-date-label">评分日期</div>',
    `<div class="news-airport-profile-score-date">${escapeHtml(formatValue(embed.score_date))}</div>`,
    '</div>',
    '</div>',
    '<div class="news-airport-profile-main">',
    '<div class="news-airport-profile-title-row">',
    `<h2 class="news-airport-profile-title">${escapeHtml(embed.name || '未命名机场')}</h2>`,
    `<span class="news-airport-profile-status">${escapeHtml(formatAirportStatus(embed.status))}</span>`,
    '</div>',
    `<p class="news-airport-profile-intro">${escapeHtml(intro)}</p>`,
    `<dl class="news-airport-profile-metrics">${metricsHtml}</dl>`,
    badgesHtml,
    '</div>',
    '<div class="news-airport-profile-actions">',
    '<div class="news-airport-profile-action-note">',
    '<div class="news-airport-profile-action-label">操作入口</div>',
    '<p>先访问官网，再结合本站测评报告完成判断，能更快对照风险与稳定性变化。</p>',
    '</div>',
    websiteAction,
    reportAction,
    '</div>',
    '</article>',
  ].join('');
}

function formatAirportStatus(status: string): string {
  if (status === 'normal') return '正常';
  if (status === 'risk') return '观察';
  if (status === 'down') return '跑路';
  return status || '未知';
}

function formatValue(value: string | null): string {
  return value || '-';
}

function formatCurrency(value: number | null): string {
  if (value === null) {
    return '-';
  }
  return `¥${trimNumber(value)}/月`;
}

function formatScore(value: number | null): string {
  return value === null ? '未公开' : trimNumber(value);
}

function formatDelta(value: number | null): string {
  if (value === null) {
    return '-';
  }
  return value > 0 ? `+${trimNumber(value)}` : trimNumber(value);
}

function deltaClass(value: number | null): string {
  if (value === null || value === 0) {
    return 'news-airport-profile-delta-neutral';
  }
  return value > 0 ? 'news-airport-profile-delta-up' : 'news-airport-profile-delta-down';
}

function trimNumber(value: number): string {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function safeExternalHref(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeInternalOrExternalHref(value: string): string | null {
  if (value.startsWith('/airports/') || value.startsWith('/reports/')) {
    return value;
  }
  return safeExternalHref(value);
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
