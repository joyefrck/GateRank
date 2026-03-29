export interface PublishTokenDocNavSection {
  id: string;
  label: string;
}

export interface PublishTokenDocLineItem {
  code: string;
  text: string;
}

export interface PublishTokenDocWorkflowStep {
  step: string;
  title: string;
  body: string;
}

export interface PublishTokenDocEndpoint {
  method: string;
  path: string;
  scopes: string;
  summary: string;
}

export interface PublishTokenDocResponseCard {
  title: string;
  lines: string[];
}

export type PublishTokenDocSchemaRow = [field: string, type: string, required: string, description: string];

export const PUBLISH_TOKEN_DOCS_PATH = '/publish-token-docs';
export const PUBLISH_TOKEN_DOCS_MARKDOWN_PATH = '/publish-token-docs.md';
export const PUBLISH_TOKEN_DOCS_LAST_UPDATED = '2026-03-29T00:00:00+08:00';

export const PUBLISH_TOKEN_DOCS_META = {
  title: '发布令牌接入说明 | 机场榜 GateRank',
  description: 'GateRank 发布令牌接入说明，包含 Bearer 鉴权、文章创建、封面上传、草稿与发布模式定义。',
  keywords: 'GateRank, 发布令牌, API, 文档, 新闻发布, Bearer Token',
  shortTitle: 'GateRank 发布令牌接入说明',
  heroEyebrow: 'Publish Token Docs',
  heroSubtitle: '给第三方系统与 AI 的正式发文接口文档',
  heroSummary:
    '这是一份公开接入文档，用于说明 GateRank 当前开放的新闻发布能力、Bearer 鉴权方式、草稿与直接发布的区别、封面上传流程，以及你在接入时会遇到的常见错误和 scope 约束。',
} as const;

export const PUBLISH_TOKEN_DOCS_NAV: PublishTokenDocNavSection[] = [
  { id: 'overview', label: '总览' },
  { id: 'security', label: '鉴权与安全' },
  { id: 'quickstart', label: '快速开始' },
  { id: 'workflow', label: '状态流转' },
  { id: 'create', label: '创建文章' },
  { id: 'upload', label: '上传封面' },
  { id: 'manage', label: '后续操作' },
  { id: 'errors', label: '错误码' },
  { id: 'scopes', label: '权限矩阵' },
];

export const PUBLISH_TOKEN_DOCS_OVERVIEW_FIELDS = [
  { label: '鉴权方式', value: 'Authorization: Bearer <publish_token>' },
  { label: '封面字段', value: 'cover_image_url' },
  { label: '发布模式字段', value: 'publish_mode' },
];

export const PUBLISH_TOKEN_DOCS_OVERVIEW_FIELD_NOTES: PublishTokenDocLineItem[] = [
  { code: 'title', text: '文章标题。' },
  { code: 'content_markdown', text: '正文 Markdown，发布时必填。' },
  { code: 'slug', text: '可选，不传时会按标题自动生成。' },
  { code: 'excerpt', text: '可选，不传时会根据正文自动提取摘要。' },
  { code: 'cover_image_url', text: '封面地址字段，可直接传本站已上传图片 URL。' },
  { code: 'publish_mode', text: '只支持 draft 或 publish，默认 draft。' },
];

export const PUBLISH_TOKEN_DOCS_OVERVIEW_BEHAVIOR_NOTES: PublishTokenDocLineItem[] = [
  { code: 'draft', text: '只在后台创建草稿，不出现在前台 News。' },
  { code: 'publish', text: '创建后立即上线，需要 news:create + news:publish。' },
  { code: 'article.id', text: '创建成功后返回文章 ID，后续更新和发布都基于这个 ID。' },
];

export const PUBLISH_TOKEN_DOCS_SECURITY_AUTH_NOTES: PublishTokenDocLineItem[] = [
  { code: 'Authorization', text: '仅支持 Bearer Token，不接受 x-api-key。' },
  { code: '401', text: '令牌不存在、已吊销、已过期，或 Authorization 格式不正确。' },
  { code: '403', text: '令牌存在，但 scope 不足，无法访问当前接口。' },
];

export const PUBLISH_TOKEN_DOCS_SECURITY_TOKEN_NOTES: PublishTokenDocLineItem[] = [
  { code: 'plain_token', text: '明文令牌只在创建成功时返回一次，之后不可找回。' },
  { code: 'revoke', text: '吊销后立刻失效，后续请求全部按未授权处理。' },
  { code: 'article.id', text: '第三方系统应保存创建返回的 article.id，后续操作均基于此值。' },
];

export const PUBLISH_TOKEN_DOCS_SECURITY_WARNING =
  '建议将发布令牌视为后端服务密钥，仅保存在服务端配置或安全密钥系统中。不要把它写入前端页面、浏览器脚本或公开仓库。';

export const PUBLISH_TOKEN_DOCS_QUICKSTART_STEPS = [
  '先准备 Bearer 令牌，并确认该令牌具备所需 scope。',
  '如果有封面图，先调用 upload-image 拿到本站图片 URL。',
  '调用 POST /news，创建草稿或直接发布。',
  '如果创建的是草稿，再调用 /news/:id/publish 上线。',
];

export const PUBLISH_TOKEN_DOCS_WORKFLOW_STEPS: PublishTokenDocWorkflowStep[] = [
  {
    step: '01',
    title: 'Draft',
    body: '创建草稿后，内容只在后台存在，前台 News 页面不会展示。适合由第三方系统先写入，再由你在后台复核。',
  },
  {
    step: '02',
    title: 'Publish',
    body: '调用 publish 或在创建时直接使用 publish_mode=publish 后，文章会进入前台已发布集合。',
  },
  {
    step: '03',
    title: 'Archive',
    body: '归档后文章不再作为前台已发布新闻展示，但数据仍保留在后台系统中，便于追溯和再次处理。',
  },
];

export const PUBLISH_TOKEN_DOCS_CREATE_ENDPOINT: PublishTokenDocEndpoint = {
  method: 'POST',
  path: '/api/v1/publish/news',
  scopes: 'news:create；若 publish_mode=publish，还需要 news:publish',
  summary: '创建一篇新闻草稿，或直接创建并发布。',
};

export const PUBLISH_TOKEN_DOCS_CREATE_RESPONSE_CARDS: PublishTokenDocResponseCard[] = [
  {
    title: '返回要点',
    lines: [
      '返回完整 article 对象，其中包含 article.id。',
      '如果 slug 冲突，会返回 NEWS_SLUG_CONFLICT。',
      '未传 excerpt 时，会按正文自动提取摘要。',
    ],
  },
];

export const PUBLISH_TOKEN_DOCS_CREATE_REQUEST_ROWS: PublishTokenDocSchemaRow[] = [
  ['title', 'string', '是', '文章标题'],
  ['content_markdown', 'string', '是', '正文 Markdown'],
  ['slug', 'string', '否', '可选，不传自动生成'],
  ['excerpt', 'string', '否', '可选，不传自动提取'],
  ['cover_image_url', 'string', '否', '封面地址字段'],
  ['publish_mode', 'draft | publish', '否', '默认 draft'],
];

export const PUBLISH_TOKEN_DOCS_CREATE_RESPONSE_ROWS: PublishTokenDocSchemaRow[] = [
  ['article.id', 'number', '是', '文章主键，后续更新/发布/归档都基于此值'],
  ['article.status', 'string', '是', 'draft 或 published'],
  ['article.slug', 'string', '是', '最终文章 slug'],
  ['article.published_at', 'string | null', '是', '未发布时为 null'],
];

export const PUBLISH_TOKEN_DOCS_UPLOAD_ENDPOINT: PublishTokenDocEndpoint = {
  method: 'POST',
  path: '/api/v1/publish/news/upload-image',
  scopes: 'news:upload',
  summary: '上传正文图片或封面图片；如果 mode=cover，会按封面规则压缩处理。',
};

export const PUBLISH_TOKEN_DOCS_UPLOAD_REQUEST_ROWS: PublishTokenDocSchemaRow[] = [
  ['file', 'binary', '是', '图片文件本体'],
  ['mode', 'cover | inline', '否', '封面建议传 cover；不传时按普通正文图片处理'],
];

export const PUBLISH_TOKEN_DOCS_UPLOAD_RESPONSE_ROWS: PublishTokenDocSchemaRow[] = [
  ['url', 'string', '是', '上传完成后的本站图片地址'],
];

export const PUBLISH_TOKEN_DOCS_MANAGE_ENDPOINTS: PublishTokenDocEndpoint[] = [
  {
    method: 'PATCH',
    path: '/api/v1/publish/news/:id',
    scopes: 'news:update',
    summary: '更新已存在的文章内容。',
  },
  {
    method: 'POST',
    path: '/api/v1/publish/news/:id/publish',
    scopes: 'news:publish',
    summary: '将草稿正式发布到前台。',
  },
  {
    method: 'POST',
    path: '/api/v1/publish/news/:id/archive',
    scopes: 'news:archive',
    summary: '归档文章，使其不再作为前台已发布新闻展示。',
  },
];

export const PUBLISH_TOKEN_DOCS_MANAGE_RESPONSE_CARDS: PublishTokenDocResponseCard[] = [
  {
    title: '更新文章',
    lines: [
      '适用于修正文案、摘要、slug、正文和封面。',
      '建议只提交需要变更的字段，但 title 与 content_markdown 通常应保持完整。',
    ],
  },
  {
    title: '发布草稿',
    lines: [
      '发布成功后，article.status 会切换为 published。',
      '如果文章不存在，会返回 NEWS_NOT_FOUND。',
    ],
  },
  {
    title: '归档文章',
    lines: [
      '归档后不会作为前台已发布新闻展示。',
      '适合处理误发、过期活动或内容撤回场景。',
    ],
  },
];

export const PUBLISH_TOKEN_DOCS_ERROR_CODES: Array<[code: string, meaning: string]> = [
  ['UNAUTHORIZED', 'Bearer token 不存在、已吊销、格式不对，或已过期。'],
  ['FORBIDDEN', '令牌存在，但缺少当前接口所需 scope。'],
  ['NEWS_SLUG_CONFLICT', 'slug 已存在，需要更换。'],
  ['BAD_REQUEST', '字段缺失、publish_mode 非法、文件或参数格式错误。'],
  ['NEWS_NOT_FOUND', '文章 ID 不存在。'],
];

export const PUBLISH_TOKEN_DOCS_ERROR_TROUBLESHOOTING: PublishTokenDocLineItem[] = [
  { code: '401', text: '先检查 Authorization 格式、令牌是否已吊销、是否已过期。' },
  { code: '403', text: '再检查该 token 是否具备当前接口所需 scope。' },
  { code: 'BAD_REQUEST', text: '最后检查 JSON 字段、multipart 参数和文章 ID 是否正确。' },
];

export const PUBLISH_TOKEN_DOCS_INTEGRATION_TIPS: PublishTokenDocLineItem[] = [
  { code: 'request_id', text: '建议在调用失败时记录返回中的 request_id 便于排查。' },
  { code: 'retry', text: '仅对网络错误或明确可重试场景做有限重试，不要对 401/403 盲目重放。' },
  { code: 'slug', text: '若系统自行生成 slug，需处理 NEWS_SLUG_CONFLICT 回退逻辑。' },
];

export const PUBLISH_TOKEN_DOCS_SCOPE_MATRIX: Array<[path: string, scopes: string]> = [
  ['/api/v1/publish/news', 'news:create'],
  ['/api/v1/publish/news（publish_mode=publish）', 'news:create + news:publish'],
  ['/api/v1/publish/news/:id', 'news:update'],
  ['/api/v1/publish/news/:id/publish', 'news:publish'],
  ['/api/v1/publish/news/:id/archive', 'news:archive'],
  ['/api/v1/publish/news/upload-image', 'news:upload'],
];

export const PUBLISH_TOKEN_DOCS_CLOSING_NOTE =
  'v1 不支持按 slug / external id 的 upsert，也不提供基于 token 的文章列表查询。第三方系统如需后续更新文章，请保存创建接口返回的 article.id。';

export function buildPublishTokenDocsUrl(siteUrl: string): string {
  return buildAbsoluteUrl(siteUrl, PUBLISH_TOKEN_DOCS_PATH);
}

export function buildPublishTokenDocsMarkdownUrl(siteUrl: string): string {
  return buildAbsoluteUrl(siteUrl, PUBLISH_TOKEN_DOCS_MARKDOWN_PATH);
}

export function buildPublishApiBase(siteUrl: string): string {
  return buildAbsoluteUrl(siteUrl, '/api/v1/publish');
}

export function buildPublishTokenDocsQuickstartCurl(siteUrl: string): string {
  const base = buildPublishApiBase(siteUrl);
  return `curl -X POST '${base}/news' \\
  -H 'Authorization: Bearer <publish_token>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "title":"新文章",
    "content_markdown":"# Hello\\n\\n正文内容",
    "publish_mode":"draft"
  }'`;
}

export function buildPublishTokenDocsCreateRequestExample(): string {
  return `{
  "title": "新文章",
  "slug": "new-article",
  "excerpt": "可选摘要",
  "cover_image_url": "/uploads/news/1743240000000-cover.webp",
  "content_markdown": "# Hello\\n\\n正文内容",
  "publish_mode": "draft"
}`;
}

export function buildPublishTokenDocsCreateResponseExample(): string {
  return `{
  "article": {
    "id": 123,
    "title": "新文章",
    "slug": "new-article",
    "status": "draft",
    "cover_image_url": "/uploads/news/1743240000000-cover.webp",
    "published_at": null
  }
}`;
}

export function buildPublishTokenDocsUploadCurl(siteUrl: string): string {
  const base = buildPublishApiBase(siteUrl);
  return `curl -X POST '${base}/news/upload-image' \\
  -H 'Authorization: Bearer <publish_token>' \\
  -F 'mode=cover' \\
  -F 'file=@/path/to/cover.png'`;
}

export function buildPublishTokenDocsUploadResponseExample(): string {
  return '{"url":"/uploads/news/1743240000000-cover.webp"}';
}

export function buildPublishTokenDocsManageCurl(siteUrl: string): string {
  const base = buildPublishApiBase(siteUrl);
  return `# 更新文章
curl -X PATCH '${base}/news/123' \\
  -H 'Authorization: Bearer <publish_token>' \\
  -H 'Content-Type: application/json' \\
  -d '{"title":"更新后的标题","content_markdown":"# Updated"}'

# 发布草稿
curl -X POST '${base}/news/123/publish' \\
  -H 'Authorization: Bearer <publish_token>' \\
  -H 'Content-Type: application/json' \\
  -d '{}'

# 归档文章
curl -X POST '${base}/news/123/archive' \\
  -H 'Authorization: Bearer <publish_token>'`;
}

export function buildPublishTokenDocsErrorResponseExample(): string {
  return `{
  "code": "FORBIDDEN",
  "message": "Publish token scope not allowed",
  "request_id": "..."
}`;
}

export function buildPublishTokenDocsStructuredData(siteUrl: string): Array<Record<string, unknown>> {
  const docUrl = buildPublishTokenDocsUrl(siteUrl);
  const markdownUrl = buildPublishTokenDocsMarkdownUrl(siteUrl);

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: PUBLISH_TOKEN_DOCS_META.shortTitle,
      description: PUBLISH_TOKEN_DOCS_META.description,
      url: docUrl,
      mainEntityOfPage: docUrl,
      inLanguage: 'zh-CN',
      datePublished: PUBLISH_TOKEN_DOCS_LAST_UPDATED,
      dateModified: PUBLISH_TOKEN_DOCS_LAST_UPDATED,
      author: {
        '@type': 'Organization',
        name: 'GateRank',
      },
      publisher: {
        '@type': 'Organization',
        name: 'GateRank',
      },
      about: [
        'Publish Token',
        'Bearer Authentication',
        'News Publishing API',
        'Markdown Content',
      ],
      mentions: PUBLISH_TOKEN_DOCS_SCOPE_MATRIX.map(([path, scopes]) => ({
        '@type': 'DefinedTerm',
        name: path,
        description: scopes,
      })),
      hasPart: [
        {
          '@type': 'DigitalDocument',
          name: 'Markdown Source',
          encodingFormat: 'text/markdown',
          url: markdownUrl,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'GateRank',
          item: buildAbsoluteUrl(siteUrl, '/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: '发布令牌接入说明',
          item: docUrl,
        },
      ],
    },
  ];
}

export function renderPublishTokenDocsMarkdown(siteUrl: string): string {
  const docUrl = buildPublishTokenDocsUrl(siteUrl);
  const apiBase = buildPublishApiBase(siteUrl);

  return [
    `# ${PUBLISH_TOKEN_DOCS_META.shortTitle}`,
    '',
    PUBLISH_TOKEN_DOCS_META.heroSubtitle,
    '',
    `- 文档地址：${docUrl}`,
    `- Base URL：${apiBase}`,
    `- 更新时间：${PUBLISH_TOKEN_DOCS_LAST_UPDATED}`,
    '',
    '## 总览',
    '',
    ...PUBLISH_TOKEN_DOCS_OVERVIEW_FIELDS.map((item) => `- ${item.label}：${item.value}`),
    '',
    '### 字段说明',
    '',
    ...PUBLISH_TOKEN_DOCS_OVERVIEW_FIELD_NOTES.map((item) => `- \`${item.code}\`：${item.text}`),
    '',
    '### 行为定义',
    '',
    ...PUBLISH_TOKEN_DOCS_OVERVIEW_BEHAVIOR_NOTES.map((item) => `- \`${item.code}\`：${item.text}`),
    '',
    '## 鉴权与安全',
    '',
    ...PUBLISH_TOKEN_DOCS_SECURITY_AUTH_NOTES.map((item) => `- \`${item.code}\`：${item.text}`),
    '',
    ...PUBLISH_TOKEN_DOCS_SECURITY_TOKEN_NOTES.map((item) => `- \`${item.code}\`：${item.text}`),
    '',
    `> ${PUBLISH_TOKEN_DOCS_SECURITY_WARNING}`,
    '',
    '## 快速开始',
    '',
    ...PUBLISH_TOKEN_DOCS_QUICKSTART_STEPS.map((item, index) => `${index + 1}. ${item}`),
    '',
    '```bash',
    buildPublishTokenDocsQuickstartCurl(siteUrl),
    '```',
    '',
    '## 状态流转',
    '',
    ...PUBLISH_TOKEN_DOCS_WORKFLOW_STEPS.map((item) => `- ${item.title}：${item.body}`),
    '',
    `## 创建文章：\`${PUBLISH_TOKEN_DOCS_CREATE_ENDPOINT.method} ${PUBLISH_TOKEN_DOCS_CREATE_ENDPOINT.path}\``,
    '',
    `- 需要 Scope：${PUBLISH_TOKEN_DOCS_CREATE_ENDPOINT.scopes}`,
    `- 说明：${PUBLISH_TOKEN_DOCS_CREATE_ENDPOINT.summary}`,
    '',
    '### Request Body',
    '',
    ...PUBLISH_TOKEN_DOCS_CREATE_REQUEST_ROWS.map((row) => `- \`${row[0]}\` (${row[1]}, ${row[2]})：${row[3]}`),
    '',
    '```json',
    buildPublishTokenDocsCreateRequestExample(),
    '```',
    '',
    '### Response',
    '',
    ...PUBLISH_TOKEN_DOCS_CREATE_RESPONSE_ROWS.map((row) => `- \`${row[0]}\` (${row[1]}, ${row[2]})：${row[3]}`),
    '',
    '```json',
    buildPublishTokenDocsCreateResponseExample(),
    '```',
    '',
    `## 上传封面：\`${PUBLISH_TOKEN_DOCS_UPLOAD_ENDPOINT.method} ${PUBLISH_TOKEN_DOCS_UPLOAD_ENDPOINT.path}\``,
    '',
    `- 需要 Scope：${PUBLISH_TOKEN_DOCS_UPLOAD_ENDPOINT.scopes}`,
    `- 说明：${PUBLISH_TOKEN_DOCS_UPLOAD_ENDPOINT.summary}`,
    '',
    ...PUBLISH_TOKEN_DOCS_UPLOAD_REQUEST_ROWS.map((row) => `- \`${row[0]}\` (${row[1]}, ${row[2]})：${row[3]}`),
    '',
    '```bash',
    buildPublishTokenDocsUploadCurl(siteUrl),
    '```',
    '',
    '```json',
    buildPublishTokenDocsUploadResponseExample(),
    '```',
    '',
    '## 后续操作',
    '',
    ...PUBLISH_TOKEN_DOCS_MANAGE_ENDPOINTS.map((item) => `- \`${item.method} ${item.path}\`：${item.scopes}。${item.summary}`),
    '',
    '```bash',
    buildPublishTokenDocsManageCurl(siteUrl),
    '```',
    '',
    '## 错误码',
    '',
    ...PUBLISH_TOKEN_DOCS_ERROR_CODES.map(([code, meaning]) => `- \`${code}\`：${meaning}`),
    '',
    '```json',
    buildPublishTokenDocsErrorResponseExample(),
    '```',
    '',
    '### 排查顺序',
    '',
    ...PUBLISH_TOKEN_DOCS_ERROR_TROUBLESHOOTING.map((item) => `- \`${item.code}\`：${item.text}`),
    '',
    '### 接入建议',
    '',
    ...PUBLISH_TOKEN_DOCS_INTEGRATION_TIPS.map((item) => `- \`${item.code}\`：${item.text}`),
    '',
    '## 权限矩阵',
    '',
    ...PUBLISH_TOKEN_DOCS_SCOPE_MATRIX.map(([path, scopes]) => `- \`${path}\`：${scopes}`),
    '',
    `> ${PUBLISH_TOKEN_DOCS_CLOSING_NOTE}`,
    '',
  ].join('\n');
}

function buildAbsoluteUrl(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
