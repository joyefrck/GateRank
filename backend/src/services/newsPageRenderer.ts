import type { PublicNewsArticleView, PublicNewsListView } from './newsPublicService';
import { formatNewsDate, formatNewsDateTime } from '../utils/news';

interface RenderListPageOptions {
  siteUrl: string;
  listView: PublicNewsListView;
}

interface RenderArticlePageOptions {
  siteUrl: string;
  article: PublicNewsArticleView;
  preview?: boolean;
}

const sharedStyles = `
  :root {
    --surface: rgba(255,255,255,0.94);
    --text: #111111;
    --muted: #6b6b6b;
    --line: rgba(17,17,17,0.1);
    --accent: #c93a2e;
    --shadow: 0 22px 70px rgba(17,17,17,0.08);
    --sans: "Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    --serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    font-family: var(--sans);
    color: var(--text);
    background: #ffffff;
  }
  a { color: inherit; text-decoration: none; }
  img { max-width: 100%; display: block; }
  .page-shell {
    min-height: 100vh;
    position: relative;
  }
  .page-shell::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    opacity: 0.018;
    background-image:
      linear-gradient(#111111 1px, transparent 1px),
      linear-gradient(90deg, #111111 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.8);
    border-bottom: 1px solid rgb(245,245,245);
  }
  .main-wrap,
  .footer-inner,
  .footer-links,
  .footer-brand-block {
    width: min(1280px, calc(100vw - 32px));
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }
  .topbar-inner {
    width: min(1280px, 100%);
    margin: 0 auto;
    padding: 0 16px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px;
    gap: 16px;
  }
  .topbar-start {
    display: flex;
    align-items: center;
    gap: 40px;
    min-width: 0;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
  }
  .brand-mark {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #111111;
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
  }
  .brand-mark svg {
    width: 20px;
    height: 20px;
    display: block;
  }
  .brand-mark path {
    stroke: #ffffff;
    stroke-width: 2.25;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1;
  }
  .brand-title {
    font-weight: 900;
    font-size: 18px;
    letter-spacing: -0.05em;
    line-height: 1;
  }
  .brand-subtitle {
    margin-top: 0;
    font-size: 10px;
    line-height: 1;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: rgb(163,163,163);
    font-weight: 900;
  }
  .nav-links {
    display: none;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .apply-link {
    background: #111111;
    color: #ffffff;
    min-height: 48px;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.18em;
    transition: 180ms ease;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
    display: inline-flex;
    align-items: center;
    gap: 12px;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .apply-link:hover {
    background: #1f1f1f;
  }
  .apply-link .apply-short {
    display: none;
  }
  .nav-link {
    padding: 8px 16px;
    border-radius: 999px;
    color: rgb(115,115,115);
    transition: 180ms ease;
    display: inline-flex;
    align-items: center;
    line-height: 1;
  }
  .nav-link:hover { color: #111111; background: rgb(245,245,245); }
  .nav-link.is-active {
    background: #111111;
    color: #ffffff;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
  }
  .nav-link.is-news {
    color: var(--accent);
    font-family: var(--serif);
    font-size: 18px;
    background: transparent;
    box-shadow: none;
  }
  .nav-link.is-news:hover {
    background: rgb(245,245,245);
  }
  .nav-link.is-news.is-active {
    color: var(--accent);
    background: transparent;
    box-shadow: none;
  }
  .risk-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 999px;
    padding: 8px 16px;
    color: rgb(115,115,115);
    transition: 180ms ease;
    line-height: 1;
  }
  .risk-link:hover {
    color: #111111;
  }
  .risk-badge {
    border-radius: 6px;
    background: rgb(244,63,94);
    padding: 4px 8px;
    font-size: 10px;
    letter-spacing: 0.18em;
    color: #ffffff;
    font-weight: 900;
    line-height: 1;
  }
  @media (min-width: 768px) {
    .brand-subtitle {
      font-size: 11px;
    }
    .apply-link {
      font-size: 12px;
    }
  }
  @media (min-width: 1024px) {
    .nav-links {
      display: flex;
    }
  }
  @media (max-width: 639px) {
    .apply-link {
      padding-left: 16px;
      padding-right: 16px;
    }
    .apply-link .apply-long {
      display: none;
    }
    .apply-link .apply-short {
      display: inline;
    }
  }
  .main-wrap {
    padding: 36px 0 72px;
  }
  .footer {
    border-top: 1px solid rgb(229,229,229);
    background: #ffffff;
    padding: 64px 0;
    margin-top: 96px;
  }
  .footer-inner {
    text-align: center;
  }
  .footer-brand-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    margin-bottom: 48px;
  }
  .footer-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .footer-brand-mark {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #000000;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .footer-brand-mark svg {
    width: 20px;
    height: 20px;
  }
  .footer-brand-title {
    font-weight: 900;
    font-size: 20px;
    letter-spacing: -0.05em;
    line-height: 1;
  }
  .footer-brand-subtitle {
    margin-top: 5px;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.24em;
    color: rgb(163,163,163);
  }
  .footer-copy {
    max-width: 42rem;
    font-size: 14px;
    line-height: 1.75;
    color: rgb(115,115,115);
  }
  .footer-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px 48px;
    font-size: 14px;
    font-weight: 700;
    color: rgb(82,82,82);
    margin-bottom: 48px;
  }
  .footer-links a:hover {
    color: #000000;
  }
  .footer-bottom {
    border-top: 1px solid rgb(245,245,245);
    padding-top: 32px;
    font-size: 12px;
    color: rgb(163,163,163);
    font-weight: 500;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(17,17,17,0.52);
  }
  .eyebrow::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--accent);
  }
  .hero-card,
  .feed-card,
  .article-shell,
  .aside-card {
    background: var(--surface);
    border: 1px solid rgba(255,255,255,0.7);
    box-shadow: var(--shadow);
    backdrop-filter: blur(10px);
  }
  .hero-card {
    border-radius: 34px;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
    min-height: 520px;
  }
  .hero-card.no-cover {
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .hero-copy {
    padding: 48px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 24px;
  }
  .hero-title,
  .article-title {
    font-weight: 700;
    letter-spacing: -0.035em;
    margin: 0;
  }
  .hero-title {
    font-family: var(--sans);
    line-height: 1.02;
    font-size: clamp(38px, 5.4vw, 68px);
    max-width: none;
    text-wrap: balance;
  }
  .hero-summary {
    max-width: 50ch;
    font-size: 16px;
    line-height: 1.8;
    color: rgba(17,17,17,0.72);
  }
  .hero-meta,
  .card-meta,
  .article-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 18px;
    color: rgba(17,17,17,0.58);
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .hero-cta {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    border-radius: 999px;
    background: #111111;
    color: #ffffff;
    font-weight: 800;
    width: fit-content;
  }
  .hero-cover {
    min-height: 100%;
    position: relative;
    overflow: hidden;
  }
  .hero-cover img,
  .feed-card-media img,
  .article-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .feed-grid {
    margin-top: 26px;
    display: grid;
    gap: 18px;
  }
  .feed-card {
    border-radius: 28px;
    overflow: hidden;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
  }
  .feed-card.no-cover {
    grid-template-columns: 1fr;
  }
  .feed-card-body {
    padding: 28px 28px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .feed-card-title {
    margin: 0;
    font-size: 30px;
    line-height: 1.14;
    letter-spacing: -0.025em;
    font-family: var(--sans);
    font-weight: 800;
  }
  .feed-card-excerpt {
    font-size: 15px;
    line-height: 1.9;
    color: rgba(17,17,17,0.7);
    margin: 0;
    max-width: 58ch;
  }
  .feed-card-link {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    color: var(--accent);
    font-weight: 800;
  }
  .article-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 24px;
    align-items: start;
  }
  .article-shell {
    border-radius: 34px;
    overflow: hidden;
  }
  .article-header {
    padding: 48px 48px 28px;
    border-bottom: 1px solid rgba(17,17,17,0.08);
  }
  .article-title {
    font-family: var(--sans);
    line-height: 1.02;
    font-size: clamp(36px, 4.8vw, 64px);
    margin-top: 16px;
    max-width: none;
    text-wrap: balance;
  }
  .article-standfirst {
    margin-top: 22px;
    max-width: 54ch;
    font-size: 17px;
    line-height: 1.9;
    color: rgba(17,17,17,0.7);
  }
  .article-cover {
    aspect-ratio: 16 / 9;
    overflow: hidden;
  }
  .article-progress {
    position: sticky;
    top: 76px;
    z-index: 19;
    height: 3px;
    background: rgba(17,17,17,0.05);
  }
  .article-progress-bar {
    height: 100%;
    width: 0;
    background: linear-gradient(90deg, #111111 0%, var(--accent) 100%);
  }
  .article-content {
    padding: 40px 48px 52px;
  }
  .news-body {
    max-width: 760px;
  }
  .news-heading {
    font-family: var(--sans);
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.025em;
    margin: 2.2em 0 0.75em;
    scroll-margin-top: 110px;
  }
  .news-heading-1 { font-size: 36px; }
  .news-heading-2 { font-size: 28px; }
  .news-heading-3 { font-size: 22px; }
  .news-paragraph,
  .news-list,
  .news-blockquote {
    font-size: 18px;
    line-height: 1.95;
    color: rgba(17,17,17,0.84);
  }
  .news-list { padding-left: 24px; }
  .news-list-item + .news-list-item { margin-top: 10px; }
  .news-blockquote {
    margin: 28px 0;
    padding: 0 0 0 20px;
    border-left: 3px solid var(--accent);
    color: rgba(17,17,17,0.68);
    font-family: var(--serif);
    font-size: 25px;
    line-height: 1.55;
  }
  .news-link {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: rgba(201,58,46,0.24);
    text-underline-offset: 0.16em;
  }
  .news-figure {
    margin: 34px 0;
  }
  .news-image {
    border-radius: 24px;
    width: 100%;
    box-shadow: 0 18px 45px rgba(17,17,17,0.12);
  }
  .news-figure-caption {
    margin-top: 12px;
    color: rgba(17,17,17,0.55);
    font-size: 13px;
    line-height: 1.7;
    text-align: center;
  }
  .news-code-block {
    background: #111111;
    color: #f4efe7;
    border-radius: 24px;
    padding: 22px;
    overflow-x: auto;
    margin: 28px 0;
  }
  .news-code {
    font-size: 14px;
    line-height: 1.7;
    font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  }
  .news-table-wrap {
    overflow-x: auto;
    margin: 32px 0;
  }
  .news-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 560px;
  }
  .news-table th,
  .news-table td {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(17,17,17,0.08);
    text-align: left;
    font-size: 15px;
    line-height: 1.6;
  }
  .news-divider {
    border: 0;
    border-top: 1px solid rgba(17,17,17,0.08);
    margin: 38px 0;
  }
  .aside-card {
    border-radius: 28px;
    padding: 24px;
    position: sticky;
    top: 108px;
  }
  .toc-list,
  .share-list,
  .prev-next {
    display: grid;
    gap: 10px;
  }
  .toc-link {
    display: block;
    color: rgba(17,17,17,0.62);
    font-size: 14px;
    line-height: 1.5;
    padding-left: 0;
  }
  .toc-link.level-3 { padding-left: 14px; }
  .share-link,
  .prev-next a,
  .copy-link-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(17,17,17,0.04);
    font-size: 14px;
    font-weight: 700;
    color: rgba(17,17,17,0.82);
    border: 0;
    cursor: pointer;
  }
  .copy-link-button { width: 100%; }
  .section-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: rgba(17,17,17,0.48);
    font-weight: 800;
    margin: 0 0 12px;
  }
  .preview-banner {
    margin-bottom: 18px;
    padding: 14px 18px;
    border-radius: 18px;
    background: rgba(201,58,46,0.1);
    color: var(--accent);
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .empty-state {
    padding: 62px 24px;
    border-radius: 32px;
    text-align: center;
    color: rgba(17,17,17,0.6);
    background: rgba(255,255,255,0.95);
    border: 1px solid rgba(17,17,17,0.06);
    box-shadow: var(--shadow);
  }
  .pagination {
    margin-top: 22px;
    display: flex;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .pagination a {
    padding: 11px 15px;
    border-radius: 999px;
    background: rgba(17,17,17,0.05);
    color: rgba(17,17,17,0.74);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .pagination a.is-current {
    background: #111111;
    color: #ffffff;
  }
  @media (max-width: 980px) {
    .hero-card,
    .feed-card,
    .article-grid {
      grid-template-columns: 1fr;
    }
    .article-grid {
      gap: 16px;
    }
    .aside-card {
      position: static;
    }
  }
  @media (max-width: 720px) {
    .main-wrap,
    .footer-inner {
      width: min(100vw - 20px, 1280px);
    }
    .hero-copy,
    .article-header,
    .article-content,
    .feed-card-body {
      padding-left: 20px;
      padding-right: 20px;
    }
    .hero-card,
    .article-shell,
    .feed-card,
    .aside-card {
      border-radius: 24px;
    }
    .feed-card {
      overflow: hidden;
    }
    .feed-card-media {
      aspect-ratio: 16 / 10;
    }
    .hero-title,
    .article-title {
      max-width: none;
    }
    .hero-title {
      font-size: clamp(34px, 9vw, 52px);
    }
    .article-title {
      font-size: clamp(32px, 10vw, 48px);
    }
    .news-heading-1 { font-size: 30px; }
    .news-heading-2 { font-size: 24px; }
    .news-heading-3 { font-size: 20px; }
    .news-paragraph,
    .news-list,
    .news-blockquote {
      font-size: 16px;
    }
    .footer-copy { font-size: 13px; }
  }
`;

export function renderNewsIndexPage(options: RenderListPageOptions): string {
  const { siteUrl, listView } = options;
  const canonicalUrl = `${siteUrl}/news${listView.page > 1 ? `?page=${listView.page}` : ''}`;
  const title = listView.page > 1
    ? `GateRank News 第 ${listView.page} 页 | 机场榜`
    : 'GateRank News | 机场榜';
  const description = 'GateRank News 聚合机场行业观察、测评方法更新与风控动态，采用长文阅读结构与可分享详情页，方便检索与转发。';
  const featured = listView.featured;
  const featuredCoverImage = featured ? toAbsoluteUrl(siteUrl, featured.cover_image_url) : null;
  const listItems = listView.items.map((item) => renderFeedCard(item)).join('');
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonicalUrl,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '首页',
          item: `${siteUrl}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'News',
          item: `${siteUrl}/news`,
        },
      ],
    },
  ];

  return renderDocument({
    title,
    description,
    canonicalUrl,
    ogImage: featuredCoverImage,
    ogImageAlt: featured?.title || null,
    ogImageType: featuredCoverImage ? inferImageMimeType(featuredCoverImage) : null,
    robots: 'index,follow,max-image-preview:large',
    jsonLd,
    body: `
      <div class="page-shell">
        ${renderTopbar('news')}
        <main class="main-wrap">
          <section>
            <div class="eyebrow">GateRank Newsroom</div>
            <div style="display:grid; gap: 24px; margin-top: 18px;">
              ${featured ? renderHeroCard(featured) : `
                <div class="empty-state">
                  <div class="eyebrow" style="justify-content:center;">News</div>
                  <h1 class="article-title" style="font-size:48px; margin:18px 0 10px;">新闻内容还在准备中</h1>
                  <p style="margin:0; font-size:16px; line-height:1.8;">第一篇文章发布后，这里会显示精选头条与最新文章流。</p>
                </div>
              `}
              ${listItems ? `<div class="feed-grid">${listItems}</div>` : ''}
              ${renderPagination('/news', listView.page, listView.total_pages)}
            </div>
          </section>
        </main>
        ${renderFooter()}
      </div>
    `,
  });
}

export function renderNewsArticlePage(options: RenderArticlePageOptions): string {
  const { siteUrl, article, preview = false } = options;
  const hasCover = Boolean(article.cover_image_url && article.cover_image_url.trim());
  const absoluteCoverImage = hasCover ? toAbsoluteUrl(siteUrl, article.cover_image_url) : null;
  const articlePath = preview ? `/api/v1/admin/news/${article.id}/preview` : `/news/${article.slug}`;
  const canonicalUrl = `${siteUrl}${articlePath}`;
  const title = `${article.title} | GateRank News`;
  const description = article.excerpt;
  const shareUrl = preview ? canonicalUrl : `${siteUrl}/news/${article.slug}`;
  const shareText = `${article.title} | GateRank News`;
  const articleJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    datePublished: toIsoDate(article.published_at),
    dateModified: toIsoDate(article.published_at),
    author: {
      '@type': 'Organization',
      name: 'GateRank 编辑部',
    },
    publisher: {
      '@type': 'Organization',
      name: '机场榜 GateRank',
    },
    mainEntityOfPage: shareUrl,
  };
  if (absoluteCoverImage) {
    articleJsonLd.image = [absoluteCoverImage];
  }
  const jsonLd = [
    articleJsonLd,
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '首页',
          item: `${siteUrl}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'News',
          item: `${siteUrl}/news`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: article.title,
          item: shareUrl,
        },
      ],
    },
  ];

  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const redditUrl = `https://www.reddit.com/submit?title=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

  return renderDocument({
    title,
    description,
    canonicalUrl,
    ogImage: absoluteCoverImage,
    ogImageAlt: article.title,
    ogImageType: absoluteCoverImage ? inferImageMimeType(absoluteCoverImage) : null,
    robots: preview ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large',
    jsonLd,
    body: `
      <div class="page-shell">
        ${renderTopbar('news')}
        <div class="article-progress"><div class="article-progress-bar" id="reading-progress"></div></div>
        <main class="main-wrap">
          ${preview ? '<div class="preview-banner">Preview Mode · 该预览页不进入索引，不写入 sitemap</div>' : ''}
          <div class="article-grid">
            <article class="article-shell">
              <header class="article-header">
                <div class="eyebrow">GateRank News</div>
                <h1 class="article-title">${escapeHtml(article.title)}</h1>
                <p class="article-standfirst">${escapeHtml(article.excerpt)}</p>
                <div class="article-meta">
                  <span>${escapeHtml(formatNewsDate(article.published_at))}</span>
                  <span>${article.reading_minutes} min read</span>
                  <span>GateRank 编辑部</span>
                </div>
              </header>
              ${hasCover ? `
                <div class="article-cover">
                  <img src="${escapeAttribute(article.cover_image_url)}" alt="${escapeAttribute(article.title)}" />
                </div>
              ` : ''}
              <div class="article-content">
                <div class="news-body">${article.content_html}</div>
                ${(article.previous || article.next) ? `
                  <section style="margin-top: 42px;">
                    <p class="section-label">继续阅读</p>
                    <div class="prev-next">
                      ${article.previous ? `<a href="/news/${escapeAttribute(article.previous.slug)}">上一篇 · ${escapeHtml(article.previous.title)}</a>` : ''}
                      ${article.next ? `<a href="/news/${escapeAttribute(article.next.slug)}">下一篇 · ${escapeHtml(article.next.title)}</a>` : ''}
                    </div>
                  </section>
                ` : ''}
              </div>
            </article>

            <aside class="aside-card">
              <div style="display:grid; gap: 22px;">
                <section>
                  <p class="section-label">目录</p>
                  ${
                    article.headings.length > 0
                      ? `<div class="toc-list">${article.headings.map((heading) => `
                          <a class="toc-link level-${heading.level}" href="#${escapeAttribute(heading.id)}">${escapeHtml(heading.text)}</a>
                        `).join('')}</div>`
                      : '<div style="color: rgba(17,17,17,0.56); font-size: 14px;">正文较短，无目录。</div>'
                  }
                </section>
                <section>
                  <p class="section-label">分享</p>
                  <div class="share-list">
                    <a class="share-link" href="${xUrl}" target="_blank" rel="noreferrer noopener">分享到 X</a>
                    <a class="share-link" href="${redditUrl}" target="_blank" rel="noreferrer noopener">分享到 Reddit</a>
                    <a class="share-link" href="${telegramUrl}" target="_blank" rel="noreferrer noopener">分享到 Telegram</a>
                    <button class="copy-link-button" data-copy-url="${escapeAttribute(shareUrl)}">复制链接</button>
                  </div>
                </section>
                <section>
                  <p class="section-label">发布时间</p>
                  <div style="font-size: 14px; line-height: 1.7; color: rgba(17,17,17,0.72);">
                    ${escapeHtml(formatNewsDateTime(article.published_at))}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </main>
        ${renderFooter()}
      </div>
      <script>
        (function () {
          var progress = document.getElementById('reading-progress');
          var article = document.querySelector('.article-shell');
          if (progress && article) {
            var onScroll = function () {
              var rect = article.getBoundingClientRect();
              var articleTop = window.scrollY + rect.top;
              var articleHeight = Math.max(article.scrollHeight - window.innerHeight, 1);
              var current = Math.min(Math.max(window.scrollY - articleTop, 0), articleHeight);
              progress.style.width = ((current / articleHeight) * 100).toFixed(2) + '%';
            };
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
          }

          var copyButton = document.querySelector('.copy-link-button');
          if (copyButton) {
            copyButton.addEventListener('click', function () {
              var url = copyButton.getAttribute('data-copy-url') || window.location.href;
              navigator.clipboard.writeText(url).then(function () {
                copyButton.textContent = '链接已复制';
                window.setTimeout(function () {
                  copyButton.textContent = '复制链接';
                }, 1600);
              });
            });
          }
        })();
      </script>
    `,
  });
}

function renderHeroCard(featured: PublicNewsArticleView | PublicNewsListView['featured']) {
  if (!featured) {
    return '';
  }
  const hasCover = Boolean(featured.cover_image_url && featured.cover_image_url.trim());

  return `
    <article class="hero-card${hasCover ? '' : ' no-cover'}">
      <div class="hero-copy">
        <div>
          <div class="eyebrow">Featured Story</div>
          <h1 class="hero-title">${escapeHtml(featured.title)}</h1>
          <p class="hero-summary">${escapeHtml(featured.excerpt)}</p>
        </div>
        <div style="display:grid; gap: 18px;">
          <div class="hero-meta">
            <span>${escapeHtml(formatNewsDate(featured.published_at))}</span>
            <span>${featured.reading_minutes} min read</span>
          </div>
          <a class="hero-cta" href="/news/${escapeAttribute(featured.slug)}">阅读全文</a>
        </div>
      </div>
      ${hasCover ? `
        <div class="hero-cover">
          <img src="${escapeAttribute(featured.cover_image_url)}" alt="${escapeAttribute(featured.title)}" />
        </div>
      ` : ''}
    </article>
  `;
}

function renderFeedCard(item: PublicNewsListView['items'][number]): string {
  const hasCover = Boolean(item.cover_image_url && item.cover_image_url.trim());
  return `
    <article class="feed-card${hasCover ? '' : ' no-cover'}">
      ${hasCover ? `
        <a class="feed-card-media" href="/news/${escapeAttribute(item.slug)}">
          <img src="${escapeAttribute(item.cover_image_url)}" alt="${escapeAttribute(item.title)}" />
        </a>
      ` : ''}
      <div class="feed-card-body">
        <div class="card-meta">
          <span>${escapeHtml(formatNewsDate(item.published_at))}</span>
          <span>${item.reading_minutes} min read</span>
        </div>
        <h2 class="feed-card-title"><a href="/news/${escapeAttribute(item.slug)}">${escapeHtml(item.title)}</a></h2>
        <p class="feed-card-excerpt">${escapeHtml(item.excerpt)}</p>
        <a class="feed-card-link" href="/news/${escapeAttribute(item.slug)}">阅读全文</a>
      </div>
    </article>
  `;
}

function renderPagination(basePath: string, currentPage: number, totalPages: number): string {
  if (totalPages <= 1) {
    return '';
  }

  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return `
    <nav class="pagination" aria-label="pagination">
      ${pages.map((page) => {
        const href = page === 1 ? basePath : `${basePath}?page=${page}`;
        return `<a href="${href}" class="${page === currentPage ? 'is-current' : ''}">${page}</a>`;
      }).join('')}
    </nav>
  `;
}

function renderTopbar(active: 'news' | 'home' | 'rankings' | 'methodology'): string {
  return `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="topbar-start">
          <a class="brand" href="/">
            <span class="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M13 2 6 13h5l-1 9 8-12h-5l0-8Z"></path>
              </svg>
            </span>
            <span class="brand-text">
              <span class="brand-title">机场榜</span>
              <span class="brand-subtitle">GateRank</span>
            </span>
          </a>
          <nav class="nav-links">
            <a class="nav-link ${active === 'home' ? 'is-active' : ''}" href="/">今日推荐</a>
            <a class="nav-link ${active === 'rankings' ? 'is-active' : ''}" href="/rankings/all">全量榜单</a>
            <a class="risk-link" href="/risk-monitor">跑路监测 <span class="risk-badge">快照</span></a>
            <a class="nav-link ${active === 'methodology' ? 'is-active' : ''}" href="/methodology">测评方法</a>
            <a class="nav-link is-news ${active === 'news' ? 'is-active' : ''}" href="/news">News</a>
          </nav>
        </div>
        <a class="apply-link" href="/apply" target="_blank" rel="noreferrer">
          <span class="apply-long">申请入驻测试</span>
          <span class="apply-short">申请</span>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </a>
      </div>
    </header>
  `;
}

function renderFooter(): string {
  return `
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand-block">
          <div class="footer-brand">
            <span class="footer-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M13 2 6 13h5l-1 9 8-12h-5l0-8Z" stroke="#ffffff" stroke-width="2.25" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </span>
            <span style="display:flex;flex-direction:column;align-items:flex-start;">
              <span class="footer-brand-title">机场榜</span>
              <span class="footer-brand-subtitle">GateRank</span>
            </span>
          </div>
          <p class="footer-copy">
            GateRank 以公开监测数据、评分趋势和风险记录构建机场推荐体系，帮助用户在今日推荐、全量榜单与测评报告之间完成交叉判断。
          </p>
        </div>
        <div class="footer-links">
          <a href="/">今日推荐</a>
          <a href="/rankings/all">全量榜单</a>
          <a href="/risk-monitor">跑路监测</a>
          <a href="/methodology">测评方法</a>
          <a href="/news">News</a>
          <a href="/apply">申请入驻</a>
        </div>
        <div class="footer-bottom">
          © 2026 GateRank. All rights reserved. 评分独立性声明：本站不含任何付费推广排名。
        </div>
      </div>
    </footer>
  `;
}

function renderDocument(options: {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string | null;
  ogImageAlt?: string | null;
  ogImageType?: string | null;
  robots: string;
  jsonLd: unknown;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
    <meta name="description" content="${escapeAttribute(options.description)}" />
    <meta name="robots" content="${escapeAttribute(options.robots)}" />
    <link rel="canonical" href="${escapeAttribute(options.canonicalUrl)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="机场榜 GateRank" />
    <meta property="og:title" content="${escapeAttribute(options.title)}" />
    <meta property="og:description" content="${escapeAttribute(options.description)}" />
    <meta property="og:url" content="${escapeAttribute(options.canonicalUrl)}" />
    ${options.ogImage ? `<meta property="og:image" content="${escapeAttribute(options.ogImage)}" />` : ''}
    ${options.ogImage ? `<meta property="og:image:secure_url" content="${escapeAttribute(options.ogImage)}" />` : ''}
    ${options.ogImageType ? `<meta property="og:image:type" content="${escapeAttribute(options.ogImageType)}" />` : ''}
    ${options.ogImageAlt ? `<meta property="og:image:alt" content="${escapeAttribute(options.ogImageAlt)}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttribute(options.title)}" />
    <meta name="twitter:description" content="${escapeAttribute(options.description)}" />
    ${options.ogImage ? `<meta name="twitter:image" content="${escapeAttribute(options.ogImage)}" />` : ''}
    ${options.ogImageAlt ? `<meta name="twitter:image:alt" content="${escapeAttribute(options.ogImageAlt)}" />` : ''}
    <style>${sharedStyles}</style>
    <script type="application/ld+json">${JSON.stringify(options.jsonLd)}</script>
  </head>
  <body>${options.body}</body>
</html>`;
}

function toIsoDate(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.replace(' ', 'T') + '+08:00';
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

function toAbsoluteUrl(siteUrl: string, value: string | null | undefined): string | null {
  const input = String(value || '').trim();
  if (!input) {
    return null;
  }
  try {
    return new URL(input, `${siteUrl}/`).toString();
  } catch {
    return null;
  }
}

function inferImageMimeType(imageUrl: string): string | null {
  try {
    const pathname = new URL(imageUrl).pathname.toLowerCase();
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    if (pathname.endsWith('.png')) {
      return 'image/png';
    }
    if (pathname.endsWith('.webp')) {
      return 'image/webp';
    }
    if (pathname.endsWith('.gif')) {
      return 'image/gif';
    }
    if (pathname.endsWith('.avif')) {
      return 'image/avif';
    }
  } catch {
    return null;
  }
  return null;
}
