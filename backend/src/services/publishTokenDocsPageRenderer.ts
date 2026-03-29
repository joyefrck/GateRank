import {
  buildPublishApiBase,
  buildPublishTokenDocsCreateRequestExample,
  buildPublishTokenDocsCreateResponseExample,
  buildPublishTokenDocsErrorResponseExample,
  buildPublishTokenDocsManageCurl,
  buildPublishTokenDocsMarkdownUrl,
  buildPublishTokenDocsQuickstartCurl,
  buildPublishTokenDocsStructuredData,
  buildPublishTokenDocsUploadCurl,
  buildPublishTokenDocsUploadResponseExample,
  buildPublishTokenDocsUrl,
  PUBLISH_TOKEN_DOCS_CLOSING_NOTE,
  PUBLISH_TOKEN_DOCS_CREATE_ENDPOINT,
  PUBLISH_TOKEN_DOCS_CREATE_REQUEST_ROWS,
  PUBLISH_TOKEN_DOCS_CREATE_RESPONSE_CARDS,
  PUBLISH_TOKEN_DOCS_CREATE_RESPONSE_ROWS,
  PUBLISH_TOKEN_DOCS_ERROR_CODES,
  PUBLISH_TOKEN_DOCS_ERROR_TROUBLESHOOTING,
  PUBLISH_TOKEN_DOCS_HERO_METRICS,
  PUBLISH_TOKEN_DOCS_INTEGRATION_TIPS,
  PUBLISH_TOKEN_DOCS_LAST_UPDATED,
  PUBLISH_TOKEN_DOCS_MANAGE_ENDPOINTS,
  PUBLISH_TOKEN_DOCS_MANAGE_RESPONSE_CARDS,
  PUBLISH_TOKEN_DOCS_META,
  PUBLISH_TOKEN_DOCS_NAV,
  PUBLISH_TOKEN_DOCS_OVERVIEW_BEHAVIOR_NOTES,
  PUBLISH_TOKEN_DOCS_OVERVIEW_FIELD_NOTES,
  PUBLISH_TOKEN_DOCS_OVERVIEW_FIELDS,
  PUBLISH_TOKEN_DOCS_QUICKSTART_STEPS,
  PUBLISH_TOKEN_DOCS_SCOPE_MATRIX,
  PUBLISH_TOKEN_DOCS_SECURITY_AUTH_NOTES,
  PUBLISH_TOKEN_DOCS_SECURITY_TOKEN_NOTES,
  PUBLISH_TOKEN_DOCS_SECURITY_WARNING,
  PUBLISH_TOKEN_DOCS_UPLOAD_ENDPOINT,
  PUBLISH_TOKEN_DOCS_UPLOAD_REQUEST_ROWS,
  PUBLISH_TOKEN_DOCS_UPLOAD_RESPONSE_ROWS,
  PUBLISH_TOKEN_DOCS_WORKFLOW_STEPS,
  renderPublishTokenDocsMarkdown,
  type PublishTokenDocEndpoint,
  type PublishTokenDocLineItem,
  type PublishTokenDocResponseCard,
  type PublishTokenDocSchemaRow,
} from '../../../shared/publishTokenDocs';

export function renderPublishTokenDocsPage(siteUrl: string): string {
  const canonicalUrl = buildPublishTokenDocsUrl(siteUrl);
  const markdownUrl = buildPublishTokenDocsMarkdownUrl(siteUrl);
  const publishApiBase = buildPublishApiBase(siteUrl);
  const jsonLd = buildPublishTokenDocsStructuredData(siteUrl);
  const heroMetrics = [
    ...PUBLISH_TOKEN_DOCS_HERO_METRICS,
    { label: '公开文档 URL', value: canonicalUrl },
    { label: 'Markdown 原文', value: markdownUrl },
  ];

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(PUBLISH_TOKEN_DOCS_META.title)}</title>
    <meta name="description" content="${escapeAttribute(PUBLISH_TOKEN_DOCS_META.description)}" />
    <meta name="keywords" content="${escapeAttribute(PUBLISH_TOKEN_DOCS_META.keywords)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="${escapeAttribute(canonicalUrl)}" />
    <link rel="alternate" type="text/markdown" href="${escapeAttribute(markdownUrl)}" title="Markdown Source" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="机场榜 GateRank" />
    <meta property="og:title" content="${escapeAttribute(PUBLISH_TOKEN_DOCS_META.title)}" />
    <meta property="og:description" content="${escapeAttribute(PUBLISH_TOKEN_DOCS_META.description)}" />
    <meta property="og:url" content="${escapeAttribute(canonicalUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttribute(PUBLISH_TOKEN_DOCS_META.title)}" />
    <meta name="twitter:description" content="${escapeAttribute(PUBLISH_TOKEN_DOCS_META.description)}" />
    <style>${styles}</style>
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>
  <body>
    <div class="page-shell">
      ${renderTopbar()}
      <main class="page-main">
        <div class="hero">
          <div class="hero-copy">
            <div class="eyebrow">${escapeHtml(PUBLISH_TOKEN_DOCS_META.heroEyebrow)}</div>
            <h1>${escapeHtml(PUBLISH_TOKEN_DOCS_META.shortTitle)}</h1>
            <p class="hero-subtitle">${escapeHtml(PUBLISH_TOKEN_DOCS_META.heroSubtitle)}</p>
            <p class="hero-summary">${escapeHtml(PUBLISH_TOKEN_DOCS_META.heroSummary)}</p>
            <div class="hero-actions">
              <a class="button button-primary" href="#quickstart">快速开始</a>
              <a class="button button-secondary" href="#scopes">查看权限矩阵</a>
              <a class="button button-ghost" href="${escapeAttribute(markdownUrl)}">Markdown 原文</a>
            </div>
          </div>
          <aside class="hero-card">
            ${heroMetrics
              .map((item) => `
                <div class="metric-card">
                  <div class="metric-label">${escapeHtml(item.label)}</div>
                  <div class="metric-value">${escapeHtml(item.value)}</div>
                </div>
              `)
              .join('')}
          </aside>
        </div>

        <div class="layout">
          <aside class="toc">
            <div class="toc-title">目录</div>
            <nav>
              ${PUBLISH_TOKEN_DOCS_NAV.map((item) => `<a href="#${escapeAttribute(item.id)}">${escapeHtml(item.label)}</a>`).join('')}
            </nav>
          </aside>

          <article class="content">
            <section id="overview" class="doc-section">
              ${renderSectionHeader('01', 'Authentication & Data Contract', '总览')}
              <div class="info-grid">
                <div class="info-card">
                  <div class="metric-label">Base URL</div>
                  <div class="metric-value">${escapeHtml(publishApiBase)}</div>
                </div>
                ${PUBLISH_TOKEN_DOCS_OVERVIEW_FIELDS.map((item) => `
                  <div class="info-card">
                    <div class="metric-label">${escapeHtml(item.label)}</div>
                    <div class="metric-value">${escapeHtml(item.value)}</div>
                  </div>
                `).join('')}
              </div>
              <div class="two-col">
                ${renderDocPanel('字段说明', PUBLISH_TOKEN_DOCS_OVERVIEW_FIELD_NOTES)}
                ${renderDocPanel('行为定义', PUBLISH_TOKEN_DOCS_OVERVIEW_BEHAVIOR_NOTES)}
              </div>
            </section>

            <section id="security" class="doc-section">
              ${renderSectionHeader('02', 'Security Contract', '鉴权与安全')}
              <div class="two-col">
                ${renderDocPanel('鉴权约定', PUBLISH_TOKEN_DOCS_SECURITY_AUTH_NOTES)}
                ${renderDocPanel('令牌管理约定', PUBLISH_TOKEN_DOCS_SECURITY_TOKEN_NOTES)}
              </div>
              <div class="notice notice-warn">${escapeHtml(PUBLISH_TOKEN_DOCS_SECURITY_WARNING)}</div>
            </section>

            <section id="quickstart" class="doc-section">
              ${renderSectionHeader('03', 'Recommended Flow', '快速开始')}
              <ol class="steps">
                ${PUBLISH_TOKEN_DOCS_QUICKSTART_STEPS.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ol>
              ${renderCodeBlock(buildPublishTokenDocsQuickstartCurl(siteUrl), 'bash')}
            </section>

            <section id="workflow" class="doc-section">
              ${renderSectionHeader('04', 'Draft → Publish → Archive', '状态流转')}
              <div class="three-col">
                ${PUBLISH_TOKEN_DOCS_WORKFLOW_STEPS.map((item) => `
                  <div class="step-card">
                    <div class="section-pill"><span>${escapeHtml(item.step)}</span><span>${escapeHtml(item.title)}</span></div>
                    <p>${escapeHtml(item.body)}</p>
                  </div>
                `).join('')}
              </div>
            </section>

            <section id="create" class="doc-section">
              ${renderSectionHeader('05', 'POST /news', '创建文章')}
              ${renderEndpoint(PUBLISH_TOKEN_DOCS_CREATE_ENDPOINT)}
              <div class="two-col">
                <div class="stack">
                  ${renderCodeBlock(buildPublishTokenDocsCreateRequestExample(), 'json')}
                  ${PUBLISH_TOKEN_DOCS_CREATE_RESPONSE_CARDS.map(renderResponseCard).join('')}
                  ${renderCodeBlock(buildPublishTokenDocsCreateResponseExample(), 'json')}
                </div>
                <div class="stack">
                  ${renderSchemaTable('Request Body', PUBLISH_TOKEN_DOCS_CREATE_REQUEST_ROWS)}
                  ${renderSchemaTable('Key Response Fields', PUBLISH_TOKEN_DOCS_CREATE_RESPONSE_ROWS)}
                </div>
              </div>
            </section>

            <section id="upload" class="doc-section">
              ${renderSectionHeader('06', 'POST /news/upload-image', '上传封面')}
              ${renderEndpoint(PUBLISH_TOKEN_DOCS_UPLOAD_ENDPOINT)}
              <div class="two-col">
                <div class="stack">
                  ${renderCodeBlock(buildPublishTokenDocsUploadCurl(siteUrl), 'bash')}
                  ${renderCodeBlock(buildPublishTokenDocsUploadResponseExample(), 'json')}
                </div>
                <div class="stack">
                  ${renderSchemaTable('Multipart Fields', PUBLISH_TOKEN_DOCS_UPLOAD_REQUEST_ROWS)}
                  ${renderSchemaTable('Response', PUBLISH_TOKEN_DOCS_UPLOAD_RESPONSE_ROWS)}
                </div>
              </div>
            </section>

            <section id="manage" class="doc-section">
              ${renderSectionHeader('07', 'PATCH /publish / archive', '后续操作')}
              <div class="stack">
                ${PUBLISH_TOKEN_DOCS_MANAGE_ENDPOINTS.map(renderEndpoint).join('')}
              </div>
              ${renderCodeBlock(buildPublishTokenDocsManageCurl(siteUrl), 'bash')}
              <div class="three-col">
                ${PUBLISH_TOKEN_DOCS_MANAGE_RESPONSE_CARDS.map(renderResponseCard).join('')}
              </div>
            </section>

            <section id="errors" class="doc-section">
              ${renderSectionHeader('08', 'Common Failures', '错误码')}
              <div class="table-card">
                <div class="table-row table-head">
                  <div>Code</div>
                  <div>Meaning</div>
                </div>
                ${PUBLISH_TOKEN_DOCS_ERROR_CODES.map(([code, meaning]) => `
                  <div class="table-row">
                    <div class="code-cell">${escapeHtml(code)}</div>
                    <div>${escapeHtml(meaning)}</div>
                  </div>
                `).join('')}
              </div>
              ${renderCodeBlock(buildPublishTokenDocsErrorResponseExample(), 'json')}
              <div class="two-col">
                ${renderDocPanel('排查顺序', PUBLISH_TOKEN_DOCS_ERROR_TROUBLESHOOTING)}
                ${renderDocPanel('接入建议', PUBLISH_TOKEN_DOCS_INTEGRATION_TIPS)}
              </div>
            </section>

            <section id="scopes" class="doc-section">
              ${renderSectionHeader('09', 'Scope Matrix', '权限矩阵')}
              <div class="table-card">
                <div class="table-row table-head">
                  <div>接口</div>
                  <div>需要的 Scope</div>
                </div>
                ${PUBLISH_TOKEN_DOCS_SCOPE_MATRIX.map(([path, scopes]) => `
                  <div class="table-row">
                    <div class="code-cell">${escapeHtml(path)}</div>
                    <div>${escapeHtml(scopes)}</div>
                  </div>
                `).join('')}
              </div>
              <div class="notice">${escapeHtml(PUBLISH_TOKEN_DOCS_CLOSING_NOTE)}</div>
            </section>
          </article>
        </div>
      </main>
      ${renderFooter()}
    </div>
  </body>
</html>`;
}

export function renderPublishTokenDocsRawMarkdown(siteUrl: string): string {
  return renderPublishTokenDocsMarkdown(siteUrl);
}

function renderSectionHeader(index: string, subtitle: string, title: string): string {
  return `
    <div class="section-header">
      <div class="section-pill"><span>${escapeHtml(index)}</span><span>${escapeHtml(subtitle)}</span></div>
      <h2>${escapeHtml(title)}</h2>
    </div>
  `;
}

function renderDocPanel(title: string, items: PublishTokenDocLineItem[]): string {
  return `
    <section class="panel">
      <h3>${escapeHtml(title)}</h3>
      <div class="stack">
        ${items
          .map((item) => `<p><code>${escapeHtml(item.code)}</code> ${escapeHtml(item.text)}</p>`)
          .join('')}
      </div>
    </section>
  `;
}

function renderEndpoint(endpoint: PublishTokenDocEndpoint): string {
  return `
    <section class="endpoint-card">
      <div class="endpoint-top">
        <div class="method-pill">${escapeHtml(endpoint.method)}</div>
        <code>${escapeHtml(endpoint.path)}</code>
      </div>
      <div class="endpoint-meta">${escapeHtml(endpoint.scopes)}</div>
      <p>${escapeHtml(endpoint.summary)}</p>
    </section>
  `;
}

function renderResponseCard(card: PublishTokenDocResponseCard): string {
  return `
    <section class="panel">
      <h3>${escapeHtml(card.title)}</h3>
      <div class="stack">
        ${card.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
      </div>
    </section>
  `;
}

function renderSchemaTable(title: string, rows: PublishTokenDocSchemaRow[]): string {
  return `
    <section class="panel">
      <h3>${escapeHtml(title)}</h3>
      <div class="table-card">
        <div class="table-row table-head table-grid-4">
          <div>Field</div>
          <div>Type</div>
          <div>Required</div>
          <div>Description</div>
        </div>
        ${rows
          .map((row) => `
            <div class="table-row table-grid-4">
              <div class="code-cell">${escapeHtml(row[0])}</div>
              <div>${escapeHtml(row[1])}</div>
              <div>${escapeHtml(row[2])}</div>
              <div>${escapeHtml(row[3])}</div>
            </div>
          `)
          .join('')}
      </div>
    </section>
  `;
}

function renderCodeBlock(code: string, language: string): string {
  return `
    <section class="code-block">
      <div class="code-lang">${escapeHtml(language)}</div>
      <pre><code>${escapeHtml(code)}</code></pre>
    </section>
  `;
}

function renderTopbar(): string {
  return `
    <header class="topbar">
      <div class="topbar-inner">
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
          <a href="/">今日推荐</a>
          <a href="/rankings/all">全量榜单</a>
          <a href="/methodology">测评方法</a>
          <a href="/news">News</a>
        </nav>
      </div>
    </header>
  `;
}

function renderFooter(): string {
  return `
    <footer class="footer">
      <div class="footer-inner">
        <p>GateRank 以公开监测数据、评分趋势和风险记录构建机场推荐体系，帮助用户在今日推荐、全量榜单与测评报告之间完成交叉判断。</p>
        <div class="footer-links">
          <a href="/">今日推荐</a>
          <a href="/rankings/all">全量榜单</a>
          <a href="/methodology">测评方法</a>
          <a href="/news">News</a>
          <a href="/apply">申请入驻</a>
        </div>
        <div class="footer-bottom">更新时间：${escapeHtml(PUBLISH_TOKEN_DOCS_LAST_UPDATED)}</div>
      </div>
    </footer>
  `;
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

const styles = `
  :root {
    --bg: #f8fafc;
    --panel: rgba(255,255,255,0.94);
    --line: rgba(15,23,42,0.1);
    --text: #0f172a;
    --muted: #64748b;
    --code: #020617;
    --accent: #111827;
    --accent-soft: #f8fafc;
    --warn-bg: #fffbeb;
    --warn-line: #fcd34d;
    --sans: "Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    --mono: "SFMono-Regular", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    font-family: var(--sans);
    color: var(--text);
    background:
      radial-gradient(circle at top left, rgba(245,158,11,0.08), transparent 24%),
      radial-gradient(circle at top right, rgba(59,130,246,0.08), transparent 22%),
      linear-gradient(180deg, #fafaf9 0%, #ffffff 22%, #f8fafc 100%);
  }
  a { color: inherit; text-decoration: none; }
  code, pre { font-family: var(--mono); }
  .page-shell { min-height: 100vh; }
  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.86);
    border-bottom: 1px solid rgba(15,23,42,0.06);
  }
  .topbar-inner,
  .page-main,
  .footer-inner {
    width: min(1280px, calc(100vw - 32px));
    margin: 0 auto;
  }
  .topbar-inner {
    min-height: 72px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
  }
  .brand-mark {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #111111;
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 18px 28px rgba(15,23,42,0.12);
  }
  .brand-mark svg {
    width: 20px;
    height: 20px;
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
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.05em;
  }
  .brand-subtitle {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: #94a3b8;
  }
  .nav-links {
    display: flex;
    gap: 16px;
    font-size: 13px;
    font-weight: 800;
    color: #475569;
  }
  .page-main {
    padding: 40px 0 72px;
  }
  .hero {
    display: grid;
    gap: 24px;
    grid-template-columns: minmax(0, 1.2fr) minmax(320px, 380px);
    padding: 36px;
    border: 1px solid var(--line);
    border-radius: 36px;
    background: linear-gradient(135deg, #f6f2ea 0%, #ffffff 44%, #eef4ff 100%);
    box-shadow: 0 24px 70px rgba(15,23,42,0.08);
  }
  .eyebrow,
  .section-pill,
  .metric-label,
  .code-lang {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-weight: 900;
  }
  .eyebrow,
  .section-pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: rgba(255,255,255,0.82);
    color: #64748b;
    font-size: 11px;
  }
  h1, h2, h3, p {
    margin: 0;
  }
  h1 {
    margin-top: 20px;
    font-size: clamp(38px, 6vw, 58px);
    line-height: 0.96;
    letter-spacing: -0.05em;
  }
  .hero-subtitle {
    margin-top: 12px;
    font-size: 22px;
    font-weight: 700;
    color: #94a3b8;
  }
  .hero-summary {
    margin-top: 16px;
    max-width: 720px;
    font-size: 16px;
    line-height: 1.9;
    color: #475569;
  }
  .hero-actions {
    margin-top: 24px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 20px;
    border-radius: 999px;
    border: 1px solid var(--line);
    font-size: 14px;
    font-weight: 900;
  }
  .button-primary {
    background: var(--accent);
    color: #ffffff;
    border-color: var(--accent);
  }
  .button-secondary,
  .button-ghost {
    background: rgba(255,255,255,0.84);
  }
  .hero-card,
  .toc,
  .doc-section,
  .panel,
  .endpoint-card,
  .table-card,
  .code-block,
  .info-card,
  .step-card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 28px;
  }
  .hero-card {
    padding: 20px;
    display: grid;
    gap: 14px;
    align-self: start;
  }
  .metric-card,
  .info-card {
    padding: 18px 20px;
    background: rgba(255,255,255,0.9);
    border: 1px solid rgba(15,23,42,0.08);
    border-radius: 22px;
  }
  .metric-label {
    font-size: 11px;
    color: #94a3b8;
  }
  .metric-value {
    margin-top: 10px;
    font-size: 14px;
    line-height: 1.7;
    word-break: break-word;
  }
  .layout {
    margin-top: 32px;
    display: grid;
    gap: 24px;
    grid-template-columns: 260px minmax(0, 1fr);
    align-items: start;
  }
  .toc {
    position: sticky;
    top: 96px;
    padding: 18px;
  }
  .toc-title {
    padding: 8px 10px 14px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }
  .toc nav {
    display: grid;
    gap: 6px;
  }
  .toc a {
    padding: 12px 14px;
    border-radius: 16px;
    color: #475569;
    font-size: 14px;
    font-weight: 600;
  }
  .toc a:hover {
    background: #f8fafc;
    color: #0f172a;
  }
  .content {
    display: grid;
    gap: 24px;
  }
  .doc-section {
    padding: 28px;
    box-shadow: 0 16px 40px rgba(15,23,42,0.04);
  }
  .section-header h2 {
    margin-top: 18px;
    font-size: clamp(28px, 4vw, 36px);
    line-height: 1.1;
    letter-spacing: -0.04em;
  }
  .info-grid,
  .two-col,
  .three-col {
    display: grid;
    gap: 16px;
    margin-top: 20px;
  }
  .info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .two-col {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .three-col {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .panel,
  .endpoint-card,
  .code-block,
  .step-card {
    padding: 20px;
  }
  .panel h3 {
    margin-bottom: 14px;
    font-size: 18px;
    line-height: 1.3;
  }
  .stack {
    display: grid;
    gap: 12px;
  }
  .stack p {
    font-size: 15px;
    line-height: 1.8;
    color: #334155;
  }
  .stack code,
  .table-row code,
  .code-cell {
    font-size: 13px;
    word-break: break-word;
  }
  .stack p code,
  .code-cell {
    padding: 3px 6px;
    border-radius: 8px;
    background: #f8fafc;
    color: #0f172a;
  }
  .endpoint-top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .method-pill {
    min-width: 64px;
    padding: 8px 12px;
    border-radius: 999px;
    background: #111827;
    color: #ffffff;
    font-size: 12px;
    font-weight: 900;
    text-align: center;
  }
  .endpoint-top code {
    font-size: 16px;
    color: #0f172a;
  }
  .endpoint-meta,
  .endpoint-card p,
  .step-card p,
  .notice {
    margin-top: 12px;
    font-size: 15px;
    line-height: 1.8;
    color: #334155;
  }
  .steps {
    margin: 20px 0 0;
    padding-left: 22px;
    display: grid;
    gap: 12px;
  }
  .steps li {
    padding-left: 4px;
    font-size: 15px;
    line-height: 1.8;
    color: #334155;
  }
  .code-block {
    margin-top: 20px;
    background: #020617;
    color: #e2e8f0;
    overflow: hidden;
  }
  .code-lang {
    font-size: 11px;
    color: #94a3b8;
  }
  .code-block pre {
    margin: 14px 0 0;
    overflow-x: auto;
    white-space: pre;
    font-size: 13px;
    line-height: 1.7;
  }
  .table-card {
    margin-top: 20px;
    overflow: hidden;
  }
  .table-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    padding: 16px 18px;
    border-top: 1px solid rgba(15,23,42,0.08);
    align-items: start;
  }
  .table-row:first-child {
    border-top: 0;
  }
  .table-grid-4 {
    grid-template-columns: minmax(120px, 0.9fr) minmax(110px, 0.8fr) minmax(90px, 0.6fr) minmax(0, 1.2fr);
  }
  .table-head {
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .notice {
    margin-top: 20px;
    padding: 16px 18px;
    border-radius: 20px;
    background: #f8fafc;
    border: 1px solid rgba(15,23,42,0.08);
  }
  .notice-warn {
    background: var(--warn-bg);
    border-color: var(--warn-line);
  }
  .footer {
    padding: 40px 0 64px;
  }
  .footer-inner {
    padding: 24px 0 0;
    border-top: 1px solid rgba(15,23,42,0.08);
  }
  .footer-inner p,
  .footer-bottom {
    font-size: 14px;
    line-height: 1.8;
    color: #64748b;
  }
  .footer-links {
    margin-top: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    color: #334155;
    font-weight: 700;
  }
  .footer-bottom {
    margin-top: 16px;
  }
  @media (max-width: 1080px) {
    .hero,
    .layout {
      grid-template-columns: 1fr;
    }
    .toc {
      position: static;
    }
  }
  @media (max-width: 760px) {
    .page-main {
      padding-top: 24px;
    }
    .hero,
    .doc-section {
      padding: 22px;
      border-radius: 28px;
    }
    .nav-links {
      display: none;
    }
    .info-grid,
    .two-col,
    .three-col,
    .table-grid-4,
    .table-row {
      grid-template-columns: 1fr;
    }
    .button {
      width: 100%;
    }
    .hero-actions {
      display: grid;
    }
  }
`;
