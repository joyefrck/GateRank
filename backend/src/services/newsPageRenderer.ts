import type { PublicNewsArticleView, PublicNewsListView, PublicNewsTopicPageView } from './newsPublicService';
import { formatNewsDate, formatNewsDateTime } from '../utils/news';
import { PUBLIC_TOP_NAV_STYLES, renderPublicTopNav } from '../../../shared/publicTopNav';

interface RenderListPageOptions {
  siteUrl: string;
  listView: PublicNewsListView;
}

interface RenderArticlePageOptions {
  siteUrl: string;
  article: PublicNewsArticleView;
  preview?: boolean;
}

interface RenderTopicPageOptions {
  siteUrl: string;
  topicView: PublicNewsTopicPageView;
}

const NEWS_FALLBACK_OG_IMAGES = {
  index: {
    path: '/og/news.png',
    alt: 'GateRank News 资讯中心分享图',
  },
  category: {
    path: '/og/news-category.png',
    alt: 'GateRank News 分类页分享图',
  },
  topic: {
    path: '/og/news-topic.png',
    alt: 'GateRank News 专题页分享图',
  },
  article: {
    path: '/og/news-article.png',
    alt: 'GateRank News 文章分享图',
  },
} as const;

const sharedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap');
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
  html {
    scroll-behavior: smooth;
    scrollbar-gutter: stable;
  }
  @supports not (scrollbar-gutter: stable) {
    html { overflow-y: scroll; }
  }
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
  ${PUBLIC_TOP_NAV_STYLES}
  .main-wrap,
  .footer-inner,
  .footer-links,
  .footer-brand-block {
    width: min(1280px, calc(100vw - 32px));
    margin: 0 auto;
    position: relative;
    z-index: 1;
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
    grid-template-columns: minmax(0, 0.96fr) minmax(380px, 1.04fr);
    min-height: 460px;
  }
  .hero-card.no-cover {
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .hero-copy {
    padding: 44px;
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
  .news-index-title {
    max-width: 860px;
    margin: 14px 0 0;
    font-size: clamp(34px, 4vw, 52px);
    line-height: 1.08;
    letter-spacing: -0.025em;
    font-weight: 800;
    text-wrap: balance;
  }
  .hero-title {
    font-family: var(--sans);
    line-height: 1.12;
    font-size: clamp(32px, 3.2vw, 48px);
    max-width: 13.5em;
    text-wrap: balance;
  }
  .hero-title a,
  .feed-card-title a,
  .news-panel-title,
  .topic-card-title {
    display: inline-block;
    transition: color 160ms ease, transform 160ms ease, text-shadow 160ms ease;
  }
  .hero-card:hover .hero-title a,
  .hero-title a:focus-visible,
  .feed-card-title a:hover,
  .feed-card-title a:focus-visible,
  .news-panel-link:hover .news-panel-title,
  .news-panel-link:focus-visible .news-panel-title {
    color: var(--accent);
    transform: translateY(-2px);
    text-shadow: 0 10px 24px rgba(201,58,46,0.16);
  }
  .topic-card:hover .topic-card-title,
  .topic-card:focus-visible .topic-card-title {
    color: var(--topic-accent, var(--accent));
    transform: translateY(-2px);
    text-shadow: 0 10px 24px rgba(17,17,17,0.12);
  }
  @media (prefers-reduced-motion: reduce) {
    .hero-title a,
    .feed-card-title a,
    .news-panel-title,
    .topic-card-title {
      transition: color 120ms ease, text-shadow 120ms ease;
    }
    .hero-card:hover .hero-title a,
    .hero-title a:focus-visible,
    .feed-card-title a:hover,
    .feed-card-title a:focus-visible,
    .news-panel-link:hover .news-panel-title,
    .news-panel-link:focus-visible .news-panel-title,
    .topic-card:hover .topic-card-title,
    .topic-card:focus-visible .topic-card-title {
      transform: none;
    }
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
  .news-airport-inline-link {
    color: var(--accent);
    font-weight: 800;
    text-decoration: underline;
    text-decoration-color: rgba(201,58,46,0.28);
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
  .news-airport-profile-card {
    margin: 34px 0;
    display: grid;
    grid-template-columns: 118px minmax(0, 1fr);
    gap: 18px;
    border: 1px solid rgba(17,17,17,0.08);
    border-radius: 28px;
    background: linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);
    box-shadow: 0 22px 56px rgba(15,23,42,0.08);
    padding: 18px;
  }
  .news-airport-profile-rank {
    border-radius: 20px;
    background: #111111;
    color: #ffffff;
    padding: 18px 16px;
  }
  .news-airport-profile-rank-label {
    font-size: 11px;
    line-height: 1.2;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.55);
  }
  .news-airport-profile-rank-value {
    margin-top: 8px;
    font-size: 34px;
    line-height: 1;
    font-weight: 900;
  }
  .news-airport-profile-score-block {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.12);
  }
  .news-airport-profile-score {
    margin-top: 8px;
    color: #5ee7b7;
    font-size: 28px;
    line-height: 1;
    font-weight: 900;
  }
  .news-airport-profile-date-label {
    margin-top: 14px;
    font-size: 11px;
    font-weight: 800;
    color: rgba(255,255,255,0.52);
  }
  .news-airport-profile-score-date {
    margin-top: 4px;
    font-family: "SFMono-Regular", Menlo, Consolas, monospace;
    font-size: 12px;
    font-weight: 800;
    color: rgba(255,255,255,0.72);
  }
  .news-airport-profile-main {
    min-width: 0;
  }
  .news-airport-profile-title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .news-airport-profile-title {
    margin: 0;
    font-size: 25px;
    line-height: 1.25;
    font-weight: 900;
    letter-spacing: 0;
  }
  .news-airport-profile-status {
    display: inline-flex;
    align-items: center;
    border: 1px solid rgba(16,185,129,0.34);
    border-radius: 999px;
    background: rgba(16,185,129,0.08);
    padding: 6px 12px;
    color: #047857;
    font-size: 12px;
    line-height: 1;
    font-weight: 900;
  }
  .news-airport-profile-intro {
    margin: 16px 0 0;
    color: rgba(17,17,17,0.72);
    font-size: 16px;
    line-height: 1.9;
  }
  .news-airport-profile-metrics {
    margin: 18px 0 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .news-airport-profile-metric {
    border: 1px solid rgba(17,17,17,0.08);
    border-radius: 16px;
    background: #ffffff;
    padding: 12px 14px;
  }
  .news-airport-profile-metric dt {
    color: rgba(17,17,17,0.42);
    font-size: 11px;
    line-height: 1.2;
    font-weight: 900;
    letter-spacing: 0.14em;
  }
  .news-airport-profile-metric dd {
    margin: 6px 0 0;
    color: rgba(17,17,17,0.84);
    font-size: 15px;
    line-height: 1.25;
    font-weight: 900;
  }
  .news-airport-profile-delta-down { color: #e11d48 !important; }
  .news-airport-profile-delta-up { color: #059669 !important; }
  .news-airport-profile-delta-neutral { color: rgba(17,17,17,0.62) !important; }
  .news-airport-profile-badges {
    margin-top: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .news-airport-profile-badge {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    border: 1px solid rgba(16,185,129,0.28);
    border-radius: 999px;
    background: rgba(16,185,129,0.08);
    padding: 0 12px;
    color: #047857;
    font-size: 12px;
    line-height: 1;
    font-weight: 900;
  }
  .news-airport-profile-actions {
    grid-column: 2;
    display: grid;
    grid-template-columns: minmax(0,1fr) 152px 152px;
    gap: 10px;
    align-items: stretch;
  }
  .news-airport-profile-action-note {
    border-radius: 18px;
    background: rgba(17,17,17,0.035);
    padding: 14px;
  }
  .news-airport-profile-action-label {
    color: rgba(17,17,17,0.42);
    font-size: 11px;
    line-height: 1.2;
    font-weight: 900;
    letter-spacing: 0.14em;
  }
  .news-airport-profile-action-note p {
    margin: 8px 0 0;
    color: rgba(17,17,17,0.56);
    font-size: 13px;
    line-height: 1.65;
  }
  .news-airport-profile-primary-link,
  .news-airport-profile-secondary-link,
  .news-airport-profile-disabled-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    border-radius: 18px;
    padding: 12px 14px;
    text-align: center;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 900;
    text-decoration: none;
  }
  .news-airport-profile-primary-link {
    background: #111111;
    color: #ffffff;
  }
  .news-airport-profile-secondary-link {
    border: 1px solid rgba(17,17,17,0.10);
    background: #ffffff;
    color: rgba(17,17,17,0.82);
  }
  .news-airport-profile-disabled-link {
    border: 1px solid rgba(17,17,17,0.08);
    background: rgba(17,17,17,0.035);
    color: rgba(17,17,17,0.38);
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
  .news-portal-intro {
    display: grid;
    gap: 18px;
  }
  .news-search-form {
    display: flex;
    align-items: center;
    gap: 10px;
    width: min(720px, 100%);
    padding: 7px;
    border: 1px solid rgba(17,17,17,0.1);
    border-radius: 999px;
    background: #ffffff;
    box-shadow: 0 18px 44px rgba(17,17,17,0.06);
  }
  .news-search-input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    padding: 12px 16px;
    font: 600 14px/1.4 var(--sans);
    color: #111111;
    background: transparent;
  }
  .news-search-button {
    border: 0;
    border-radius: 999px;
    padding: 12px 19px;
    background: #111111;
    color: #ffffff;
    font: 800 13px/1 var(--sans);
    cursor: pointer;
  }
  .news-category-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .news-category-nav a,
  .news-taxonomy-chip,
  .article-topic-link {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 7px 11px;
    border-radius: 999px;
    border: 1px solid rgba(17,17,17,0.1);
    background: #ffffff;
    color: rgba(17,17,17,0.68);
    font-size: 12px;
    font-weight: 800;
  }
  .news-category-nav a.is-active,
  .news-taxonomy-chip.is-active {
    background: #111111;
    color: #ffffff;
    border-color: #111111;
  }
  .news-hub-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 18px;
    align-items: stretch;
  }
  .news-side-stack {
    display: grid;
    gap: 14px;
  }
  .news-panel {
    border: 1px solid rgba(17,17,17,0.12);
    border-radius: 24px;
    padding: 20px;
    background: #ffffff;
  }
  .news-panel-list {
    display: grid;
    gap: 12px;
  }
  .news-panel-link {
    display: grid;
    gap: 5px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(17,17,17,0.07);
  }
  .news-panel-link:last-child {
    padding-bottom: 0;
    border-bottom: 0;
  }
  .news-panel-title {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    font-weight: 800;
  }
  .news-panel-meta {
    color: rgba(17,17,17,0.52);
    font-size: 12px;
    line-height: 1.4;
  }
  .topic-section {
    margin-top: 38px;
  }
  .topic-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }
  .topic-card {
    position: relative;
    overflow: hidden;
    min-height: 166px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 18px;
    border: 1px solid rgba(17,17,17,0.10);
    border-radius: 18px;
    padding: 22px;
    background:
      linear-gradient(135deg, var(--topic-soft, rgba(17,17,17,0.04)) 0%, #fff 48%, #fff 100%);
    box-shadow: 0 18px 44px rgba(17,17,17,0.04);
    transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  }
  .topic-card::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 5px;
    background: var(--topic-accent, #111);
  }
  .topic-card::after {
    content: "";
    position: absolute;
    right: 22px;
    top: 20px;
    width: 58px;
    height: 58px;
    border-radius: 18px;
    background: var(--topic-accent, #111);
    opacity: 0.10;
    transform: rotate(10deg);
  }
  .topic-card:hover {
    transform: translateY(-3px);
    border-color: rgba(17,17,17,0.20);
    box-shadow: 0 22px 52px rgba(17,17,17,0.09);
  }
  .topic-card:nth-child(1) { --topic-accent: #d43d31; --topic-soft: rgba(212,61,49,0.10); }
  .topic-card:nth-child(2) { --topic-accent: #0f766e; --topic-soft: rgba(15,118,110,0.10); }
  .topic-card:nth-child(3) { --topic-accent: #2563eb; --topic-soft: rgba(37,99,235,0.10); }
  .topic-card:nth-child(4) { --topic-accent: #16a34a; --topic-soft: rgba(22,163,74,0.10); }
  .topic-card:nth-child(5) { --topic-accent: #b45309; --topic-soft: rgba(180,83,9,0.11); }
  .topic-card:nth-child(6) { --topic-accent: #7c3aed; --topic-soft: rgba(124,58,237,0.10); }
  .topic-card > * {
    position: relative;
    z-index: 1;
  }
  .topic-card-index {
    color: var(--topic-accent, rgba(17,17,17,0.42));
    font-weight: 900;
    font-size: 15px;
    letter-spacing: 0;
  }
  .topic-card-title {
    margin: 0;
    max-width: 82%;
    font-size: 19px;
    line-height: 1.25;
    font-weight: 900;
  }
  .topic-card-desc {
    margin: 8px 0 0;
    color: rgba(17,17,17,0.62);
    font-size: 13px;
    line-height: 1.55;
  }
  .topic-card .news-taxonomy-chip {
    align-self: stretch;
    justify-content: space-between;
    border: 0;
    border-radius: 999px;
    padding: 11px 14px 11px 16px;
    background: var(--topic-accent, #111);
    color: #fff;
    box-shadow: 0 12px 26px rgba(17,17,17,0.12);
  }
  .topic-card .news-taxonomy-chip::after {
    content: "->";
    font-weight: 900;
  }
  .news-content-grid {
    margin-top: 44px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 26px;
    align-items: start;
  }
  .topic-page-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(340px, 0.72fr);
    gap: 20px;
    align-items: stretch;
    border-radius: 34px;
    background: linear-gradient(135deg, var(--topic-accent-soft, rgba(201,58,46,0.10)) 0%, #ffffff 54%, #ffffff 100%);
    border: 1px solid rgba(17,17,17,0.08);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .topic-page-hero.no-cover {
    grid-template-columns: 1fr;
  }
  .topic-hero-copy {
    padding: 48px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 36px;
  }
  .topic-hero-title {
    margin: 14px 0 0;
    max-width: 850px;
    font-size: clamp(38px, 5vw, 68px);
    line-height: 1.02;
    letter-spacing: -0.03em;
    font-weight: 900;
    text-wrap: balance;
  }
  .topic-hero-intro {
    max-width: 66ch;
    margin: 22px 0 0;
    color: rgba(17,17,17,0.72);
    font-size: 17px;
    line-height: 1.9;
  }
  .topic-hero-cover {
    min-height: 420px;
    overflow: hidden;
  }
  .topic-hero-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .topic-stat-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .topic-stat-pill {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    border-radius: 999px;
    background: #111111;
    color: #ffffff;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .topic-section-block {
    margin-top: 42px;
  }
  .topic-featured-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }
  .topic-faq-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .topic-faq-item {
    border: 1px solid rgba(17,17,17,0.10);
    border-radius: 22px;
    background: #ffffff;
    padding: 22px;
    box-shadow: 0 16px 38px rgba(17,17,17,0.04);
  }
  .topic-faq-question {
    margin: 0;
    font-size: 16px;
    line-height: 1.45;
    font-weight: 900;
  }
  .topic-faq-answer {
    margin: 10px 0 0;
    color: rgba(17,17,17,0.68);
    font-size: 14px;
    line-height: 1.75;
  }
  .news-section-heading {
    margin: 0 0 18px;
    font-size: 24px;
    line-height: 1.2;
    font-weight: 900;
    letter-spacing: -0.02em;
  }
  .feed-card-media {
    min-height: 100%;
  }
  .article-taxonomy {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
  @media (max-width: 980px) {
    .hero-card,
    .feed-card,
    .article-grid,
    .topic-page-hero,
    .news-hub-grid,
    .news-content-grid {
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
    .topic-hero-copy,
    .article-header,
    .article-content,
    .feed-card-body {
      padding-left: 20px;
      padding-right: 20px;
    }
    .hero-card,
    .topic-page-hero,
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
    .news-category-nav {
      flex-wrap: nowrap;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
    }
    .news-category-nav a {
      white-space: nowrap;
    }
    .news-search-form {
      border-radius: 22px;
      align-items: stretch;
      flex-direction: column;
      padding: 10px;
    }
    .news-search-button,
    .news-search-input {
      width: 100%;
    }
    .topic-grid {
      grid-template-columns: 1fr;
    }
    .topic-featured-grid,
    .topic-faq-grid {
      grid-template-columns: 1fr;
    }
    .topic-hero-cover {
      min-height: 240px;
    }
    .hero-title,
    .article-title {
      max-width: none;
    }
    .hero-title {
      font-size: clamp(30px, 8vw, 42px);
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
    .news-airport-profile-card {
      grid-template-columns: 1fr;
      border-radius: 24px;
      padding: 14px;
    }
    .news-airport-profile-actions {
      grid-column: auto;
      grid-template-columns: 1fr;
    }
    .news-airport-profile-metrics {
      grid-template-columns: 1fr;
    }
    .footer-copy { font-size: 13px; }
  }
`;

export function renderNewsIndexPage(options: RenderListPageOptions): string {
  const { siteUrl, listView } = options;
  const basePath = getNewsListBasePath(listView);
  const query = listView.query || '';
  const recommended = listView.recommended || [];
  const riskWatch = listView.risk_watch || [];
  const guides = listView.guides || [];
  const topics = listView.topics || [];
  const canonicalUrl = `${siteUrl}${buildPagedHref(basePath, listView.page, query)}`;
  const titlePrefix = listView.category?.name || listView.topic?.name || '机场榜资讯中心';
  const title = listView.page > 1
    ? `${titlePrefix} 第 ${listView.page} 页 | GateRank News`
    : `${titlePrefix} | GateRank News`;
  const description = buildListDescription(listView);
  const featured = listView.featured;
  const leadStory = featured || (listView.page > 1 ? listView.items[0] || null : null);
  const featuredCoverImage = featured ? toAbsoluteUrl(siteUrl, featured.cover_image_url) : null;
  const listOgImage = featuredCoverImage
    ? {
      url: featuredCoverImage,
      alt: featured?.title || title,
      type: inferImageMimeType(featuredCoverImage),
    }
    : buildStaticNewsOgImage(siteUrl, listView.category ? 'category' : 'index');
  const feedItems = leadStory && !featured
    ? listView.items.filter((item) => item.id !== leadStory.id)
    : listView.items;
  const listItems = feedItems.map((item) => renderFeedCard(item)).join('');
  const isSearch = Boolean(query);
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
        ...(listView.category || listView.topic ? [{
          '@type': 'ListItem',
          position: 3,
          name: (listView.category || listView.topic)?.name,
          item: `${siteUrl}${basePath}`,
        }] : []),
      ],
    },
  ];

  return renderDocument({
    title,
    description,
    canonicalUrl,
    ogImage: listOgImage.url,
    ogImageAlt: listOgImage.alt,
    ogImageType: listOgImage.type,
    ogType: 'website',
    robots: isSearch ? 'noindex,follow,max-image-preview:large' : 'index,follow,max-image-preview:large',
    jsonLd,
    body: `
      <div class="page-shell">
        ${renderPublicTopNav('news')}
        <main class="main-wrap">
          <section class="news-portal-intro">
            <div class="eyebrow">GateRank Newsroom</div>
            <h1 class="news-index-title">${escapeHtml(buildListH1(listView))}</h1>
            <form class="news-search-form" action="${escapeAttribute(basePath)}" method="get" role="search">
              <input class="news-search-input" type="search" name="q" value="${escapeAttribute(query)}" placeholder="搜索：机场推荐 / 跑路预警 / Clash / USDT / AI工具" />
              <button class="news-search-button" type="submit">搜索</button>
            </form>
            ${renderCategoryNav(listView)}
          </section>

          <section class="news-hub-grid" style="margin-top: 30px;">
            ${leadStory ? renderHeroCard(leadStory) : `
              <div class="empty-state">
                <div class="eyebrow" style="justify-content:center;">News</div>
                <p style="margin:0; font-size:16px; line-height:1.8;">第一篇文章发布后，这里会显示精选头条与最新文章流。</p>
              </div>
            `}
            <div class="news-side-stack">
              ${renderCompactPanel('最新风险预警', riskWatch)}
              ${renderCompactPanel('热门指南', guides.length ? guides : recommended.slice(0, 3))}
            </div>
          </section>

          <section class="topic-section">
            <h2 class="news-section-heading">专题</h2>
            <div class="topic-grid">
              ${topics.slice(0, 6).map((topic, index) => renderTopicCard(topic, index)).join('')}
            </div>
          </section>

          <section class="news-content-grid">
            <div>
              <h2 class="news-section-heading">${isSearch ? '搜索结果' : '最新文章'}</h2>
              ${listItems ? `<div class="feed-grid">${listItems}</div>` : `
                <div class="empty-state">
                  <p style="margin:0; font-size:16px; line-height:1.8;">当前条件下暂无已发布文章。</p>
                </div>
              `}
              ${renderPagination(basePath, listView.page, listView.total_pages, query)}
            </div>
            <aside class="news-panel">
              ${renderCompactPanel('热门文章', recommended, false)}
            </aside>
          </section>
        </main>
        ${renderFooter()}
      </div>
    `,
  });
}

export function renderNewsTopicPage(options: RenderTopicPageOptions): string {
  const { siteUrl, topicView } = options;
  const { topic } = topicView;
  const basePath = `/news/topic/${topic.slug}`;
  const query = topicView.query || '';
  const canonicalUrl = `${siteUrl}${buildPagedHref(basePath, topicView.page, query)}`;
  const titleBase = topic.seo_title?.trim() || `${topic.name} | GateRank News`;
  const title = topicView.page > 1 ? `${titleBase} 第 ${topicView.page} 页` : titleBase;
  const description = topic.seo_description?.trim() || topic.description;
  const h1 = topic.h1?.trim() || topic.name;
  const intro = topic.intro?.trim() || topic.description;
  const coverImage = toAbsoluteUrl(siteUrl, topic.cover_image_url || '');
  const topicOgImage = coverImage
    ? {
      url: coverImage,
      alt: topic.name,
      type: inferImageMimeType(coverImage),
    }
    : buildStaticNewsOgImage(siteUrl, 'topic');
  const faqItems = (topic.faq_items || []).filter((item) => item.question.trim() && item.answer.trim()).slice(0, 8);
  const accentColor = normalizeTopicAccent(topic.accent_color);
  const pinnedHtml = topicView.pinned.map((item) => renderFeedCard(item)).join('');
  const itemHtml = topicView.items.map((item) => renderFeedCard(item)).join('');
  const isSearch = Boolean(query);
  const jsonLd: unknown[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonicalUrl,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: [...topicView.pinned, ...topicView.items].map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${siteUrl}/news/${item.slug}`,
          name: item.title,
        })),
      },
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
        {
          '@type': 'ListItem',
          position: 3,
          name: topic.name,
          item: `${siteUrl}${basePath}`,
        },
      ],
    },
  ];
  if (faqItems.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  return renderDocument({
    title,
    description,
    canonicalUrl,
    ogImage: topicOgImage.url,
    ogImageAlt: topicOgImage.alt,
    ogImageType: topicOgImage.type,
    ogType: 'website',
    robots: isSearch ? 'noindex,follow,max-image-preview:large' : 'index,follow,max-image-preview:large',
    jsonLd,
    body: `
      <div class="page-shell" style="--topic-accent:${escapeAttribute(accentColor)};--topic-accent-soft:${escapeAttribute(hexToRgba(accentColor, 0.10))};">
        ${renderPublicTopNav('news')}
        <main class="main-wrap">
          <section class="topic-page-hero${coverImage ? '' : ' no-cover'}">
            <div class="topic-hero-copy">
              <div>
                <div class="eyebrow">GateRank Topic</div>
                <h1 class="topic-hero-title">${escapeHtml(h1)}</h1>
                <p class="topic-hero-intro">${escapeHtml(intro)}</p>
              </div>
              <div class="topic-stat-row">
                <span class="topic-stat-pill">${topicView.total + topicView.pinned.length} 篇内容</span>
                <span class="topic-stat-pill">专题</span>
                ${topic.updated_at ? `<span class="topic-stat-pill">${escapeHtml(formatNewsDate(topic.updated_at))} 更新</span>` : ''}
              </div>
            </div>
            ${coverImage ? `
              <div class="topic-hero-cover">
                <img src="${escapeAttribute(topic.cover_image_url || '')}" alt="${escapeAttribute(topic.name)}" ${renderImageLoadingAttrs('priority')} />
              </div>
            ` : ''}
          </section>

          ${topicView.pinned.length > 0 && !isSearch ? `
            <section class="topic-section-block">
              <h2 class="news-section-heading">专题精选</h2>
              <div class="topic-featured-grid">${pinnedHtml}</div>
            </section>
          ` : ''}

          ${faqItems.length > 0 ? `
            <section class="topic-section-block">
              <h2 class="news-section-heading">专题问答</h2>
              <div class="topic-faq-grid">
                ${faqItems.map((item) => `
                  <article class="topic-faq-item">
                    <h3 class="topic-faq-question">${escapeHtml(item.question)}</h3>
                    <p class="topic-faq-answer">${escapeHtml(item.answer)}</p>
                  </article>
                `).join('')}
              </div>
            </section>
          ` : ''}

          <section class="news-content-grid">
            <div>
              <h2 class="news-section-heading">${isSearch ? '专题搜索结果' : '专题最新文章'}</h2>
              ${itemHtml ? `<div class="feed-grid">${itemHtml}</div>` : `
                <div class="empty-state">
                  <p style="margin:0; font-size:16px; line-height:1.8;">当前专题暂无更多已发布文章。</p>
                </div>
              `}
              ${renderPagination(basePath, topicView.page, topicView.total_pages, query)}
            </div>
            <aside class="news-panel">
              ${renderCompactPanel('热门文章', topicView.recommended, false)}
            </aside>
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
  const articleOgImage = absoluteCoverImage
    ? {
      url: absoluteCoverImage,
      alt: article.title,
      type: inferImageMimeType(absoluteCoverImage),
    }
    : buildStaticNewsOgImage(siteUrl, 'article');
  const contentHtml = preview ? rewriteAirportPaidLinksForPreview(article.content_html) : article.content_html;
  const articleBodyHtml = demoteBodyH1(contentHtml);
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
  if (article.category) {
    articleJsonLd.articleSection = article.category.name;
  }
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
        ...(article.category ? [{
          '@type': 'ListItem',
          position: 3,
          name: article.category.name,
          item: `${siteUrl}/news/category/${article.category.slug}`,
        }] : []),
        {
          '@type': 'ListItem',
          position: article.category ? 4 : 3,
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
    ogImage: articleOgImage.url,
    ogImageAlt: articleOgImage.alt,
    ogImageType: articleOgImage.type,
    robots: preview ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large',
    jsonLd,
    body: `
      <div class="page-shell">
        ${renderPublicTopNav('news')}
        <div class="article-progress"><div class="article-progress-bar" id="reading-progress"></div></div>
        <main class="main-wrap">
          ${preview ? '<div class="preview-banner">Preview Mode · 该预览页不进入索引，不写入 sitemap</div>' : ''}
          <div class="article-grid">
            <article class="article-shell">
              <header class="article-header">
                <div class="eyebrow">GateRank News</div>
                <h1 class="article-title">${escapeHtml(article.title)}</h1>
                <p class="article-standfirst">${escapeHtml(article.excerpt)}</p>
                <div class="article-taxonomy">
                  ${article.category ? `<a class="news-taxonomy-chip is-active" href="/news/category/${escapeAttribute(article.category.slug)}">${escapeHtml(article.category.name)}</a>` : ''}
                  ${(article.topics || []).map((topic) => `<a class="article-topic-link" href="/news/topic/${escapeAttribute(topic.slug)}">${escapeHtml(topic.name)}</a>`).join('')}
                </div>
                <div class="article-meta">
                  <span>${escapeHtml(formatNewsDate(article.published_at))}</span>
                  <span>${escapeHtml(formatViewCount(article.view_count))}</span>
                  <span>${article.reading_minutes} min read</span>
                  <span>GateRank 编辑部</span>
                </div>
              </header>
              ${hasCover ? `
                <div class="article-cover">
                  <img src="${escapeAttribute(article.cover_image_url)}" alt="${escapeAttribute(article.title)}" ${renderImageLoadingAttrs('priority')} />
                </div>
              ` : ''}
              <div class="article-content">
                <div class="news-body">${articleBodyHtml}</div>
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

function demoteBodyH1(html: string): string {
  return html
    .replace(/<h1(\s[^>]*)?>/gi, '<h2$1>')
    .replace(/<\/h1>/gi, '</h2>');
}

function rewriteAirportPaidLinksForPreview(html: string): string {
  return html.replace(
    /<a\b([^>]*?)href="\/api\/v1\/outbound\/airports\/\d+\?target=website(?:&amp;|&)placement=news_article"([^>]*?)>/gi,
    (full, before: string, after: string) => {
      const attributes = `${before}${after}`;
      const website = extractAttribute(attributes, 'data-airport-website');
      const safeWebsite = website ? safePreviewExternalHref(website) : null;
      if (!safeWebsite) {
        return full;
      }
      return `<a${before}href="${escapeAttribute(safeWebsite)}"${after}>`;
    },
  );
}

function extractAttribute(attributes: string, name: string): string | null {
  const pattern = new RegExp(`${name}="([^"]*)"`, 'i');
  const matched = attributes.match(pattern);
  return matched ? decodeHtmlAttribute(matched[1]) : null;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function safePreviewExternalHref(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function buildListH1(listView: PublicNewsListView): string {
  if (listView.query) {
    return `机场榜资讯搜索：${listView.query}`;
  }
  if (listView.category) {
    return `${listView.category.name}：机场推荐、跑路预警与科学上网指南`;
  }
  if (listView.topic) {
    return listView.topic.name;
  }
  return '机场榜资讯中心：机场推荐、跑路预警与科学上网指南';
}

function buildListDescription(listView: PublicNewsListView): string {
  if (listView.query) {
    return `GateRank News 搜索「${listView.query}」相关的机场推荐、机场测评、风险预警、支付安全、客户端教程和 AI 工具访问内容，帮助用户快速定位科学上网指南。`;
  }
  if (listView.category) {
    return `GateRank ${listView.category.name}聚合${listView.category.description}覆盖机场推荐、机场测评、风险预警、官网判断、支付安全和科学上网选择指南。`;
  }
  if (listView.topic) {
    return `GateRank ${listView.topic.name}收录${listView.topic.description}帮助用户围绕机场 VPN 选择、风险判断、客户端配置和支付安全进行交叉判断。`;
  }
  return 'GateRank 机场榜资讯中心收录机场推荐、机场测评、跑路预警、科学上网教程、支付安全、客户端协议、行业监管和 AI 工具访问指南。';
}

function getNewsListBasePath(listView: PublicNewsListView): string {
  if (listView.category) {
    return `/news/category/${listView.category.slug}`;
  }
  if (listView.topic) {
    return `/news/topic/${listView.topic.slug}`;
  }
  return '/news';
}

function buildPagedHref(basePath: string, page: number, query = ''): string {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set('page', String(page));
  }
  if (query) {
    params.set('q', query);
  }
  const suffix = params.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

function renderCategoryNav(listView: PublicNewsListView): string {
  return `
    <nav class="news-category-nav" aria-label="资讯分类">
      <a href="/news" class="${!listView.category && !listView.topic ? 'is-active' : ''}">全部</a>
      ${(listView.categories || []).map((category) => `
        <a href="/news/category/${escapeAttribute(category.slug)}" class="${listView.category?.slug === category.slug ? 'is-active' : ''}">${escapeHtml(category.name)}</a>
      `).join('')}
    </nav>
  `;
}

function renderTopicCard(topic: PublicNewsListView['topics'][number], index: number): string {
  return `
    <a class="topic-card" href="/news/topic/${escapeAttribute(topic.slug)}">
      <span class="topic-card-index">${String(index + 1).padStart(2, '0')}.</span>
      <span>
        <h3 class="topic-card-title">${escapeHtml(topic.name)}</h3>
        <p class="topic-card-desc">${escapeHtml(topic.description)}</p>
      </span>
      <span class="news-taxonomy-chip">查看专题</span>
    </a>
  `;
}

function normalizeTopicAccent(value: string | null | undefined): string {
  const input = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(input) ? input : '#d43d31';
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeTopicAccent(hex);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red},${green},${blue},${Math.min(1, Math.max(0, alpha)).toFixed(2)})`;
}

function renderCompactPanel(title: string, items: PublicNewsListView['items'], wrap = true): string {
  const content = `
    <p class="section-label">${escapeHtml(title)}</p>
    ${
      items.length > 0
        ? `<div class="news-panel-list">${items.slice(0, 5).map((item) => `
            <a class="news-panel-link" href="/news/${escapeAttribute(item.slug)}">
              <span class="news-panel-title">${escapeHtml(item.title)}</span>
              <span class="news-panel-meta">${escapeHtml(item.category?.name || 'GateRank News')} · ${escapeHtml(formatNewsDate(item.published_at))} · ${escapeHtml(formatViewCount(item.view_count))}</span>
            </a>
          `).join('')}</div>`
        : '<div class="news-panel-meta">暂无内容</div>'
    }
  `;
  return wrap ? `<section class="news-panel">${content}</section>` : content;
}

function renderHeroCard(featured: PublicNewsArticleView | PublicNewsListView['featured']) {
  if (!featured) {
    return '';
  }
  const hasCover = Boolean(featured.cover_image_url && featured.cover_image_url.trim());
  const featuredTopics = featured.topics || [];

  return `
    <article class="hero-card${hasCover ? '' : ' no-cover'}">
      <div class="hero-copy">
        <div>
          <div class="eyebrow">Featured Story</div>
          <h2 class="hero-title"><a href="/news/${escapeAttribute(featured.slug)}">${escapeHtml(featured.title)}</a></h2>
          <p class="hero-summary">${escapeHtml(featured.excerpt)}</p>
          <div class="article-taxonomy">
            ${featured.category ? `<a class="news-taxonomy-chip" href="/news/category/${escapeAttribute(featured.category.slug)}">${escapeHtml(featured.category.name)}</a>` : ''}
            ${featuredTopics.slice(0, 2).map((topic) => `<a class="news-taxonomy-chip" href="/news/topic/${escapeAttribute(topic.slug)}">${escapeHtml(topic.name)}</a>`).join('')}
          </div>
        </div>
        <div style="display:grid; gap: 18px;">
          <div class="hero-meta">
            <span>${escapeHtml(formatNewsDate(featured.published_at))}</span>
            <span>${escapeHtml(formatViewCount(featured.view_count))}</span>
            <span>${featured.reading_minutes} min read</span>
          </div>
          <a class="hero-cta" href="/news/${escapeAttribute(featured.slug)}">阅读全文</a>
        </div>
      </div>
      ${hasCover ? `
        <div class="hero-cover">
          <img src="${escapeAttribute(featured.cover_image_url)}" alt="${escapeAttribute(featured.title)}" ${renderImageLoadingAttrs('priority')} />
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
          <img src="${escapeAttribute(item.cover_image_url)}" alt="${escapeAttribute(item.title)}" ${renderImageLoadingAttrs('lazy')} />
        </a>
      ` : ''}
      <div class="feed-card-body">
        <div class="card-meta">
          ${item.category ? `<span>${escapeHtml(item.category.name)}</span>` : ''}
          <span>${escapeHtml(formatNewsDate(item.published_at))}</span>
          <span>${escapeHtml(formatViewCount(item.view_count))}</span>
          <span>${item.reading_minutes} min read</span>
        </div>
        <h2 class="feed-card-title"><a href="/news/${escapeAttribute(item.slug)}">${escapeHtml(item.title)}</a></h2>
        <p class="feed-card-excerpt">${escapeHtml(item.excerpt)}</p>
        <a class="feed-card-link" href="/news/${escapeAttribute(item.slug)}">阅读全文</a>
      </div>
    </article>
  `;
}

function renderImageLoadingAttrs(mode: 'priority' | 'lazy'): string {
  if (mode === 'priority') {
    return 'loading="eager" decoding="async" fetchpriority="high" width="1280" height="720"';
  }
  return 'loading="lazy" decoding="async" width="1280" height="720"';
}

function renderPagination(basePath: string, currentPage: number, totalPages: number, query = ''): string {
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
        const href = buildPagedHref(basePath, page, query);
        return `<a href="${href}" class="${page === currentPage ? 'is-current' : ''}">${page}</a>`;
      }).join('')}
    </nav>
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
            GateRank 以公开监测数据、评分趋势和风险记录构建机场推荐体系，帮助用户在今日推荐、机场排行与测评报告之间完成交叉判断。
          </p>
        </div>
        <div class="footer-links">
          <a href="/">今日推荐</a>
          <a href="/rankings/all">机场排行</a>
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
  ogType?: string;
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
    <meta property="og:type" content="${escapeAttribute(options.ogType || 'article')}" />
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

function buildStaticNewsOgImage(siteUrl: string, key: keyof typeof NEWS_FALLBACK_OG_IMAGES) {
  const image = NEWS_FALLBACK_OG_IMAGES[key];
  return {
    url: `${siteUrl}${image.path}`,
    alt: image.alt,
    type: 'image/png',
  };
}

function toIsoDate(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.replace(' ', 'T') + '+08:00';
}

function formatViewCount(value: number | null | undefined): string {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  return `${count.toLocaleString('zh-CN')} 次访问`;
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
