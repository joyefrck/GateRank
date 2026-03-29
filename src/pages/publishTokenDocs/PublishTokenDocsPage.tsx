import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  FileCode2,
  KeyRound,
  ListChecks,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import {
  buildAbsoluteUrl,
  buildPublishTokenDocsHref,
  PageFrame,
  usePageSeo,
} from '../../site/publicSite';

export function PublishTokenDocsPage() {
  const publishApiBase = `${window.location.origin.replace(/\/+$/, '')}/api/v1/publish`;
  const docSections = [
    { id: 'overview', label: '总览' },
    { id: 'security', label: '鉴权与安全' },
    { id: 'quickstart', label: '快速开始' },
    { id: 'workflow', label: '状态流转' },
    { id: 'create', label: '创建文章' },
    { id: 'upload', label: '上传封面' },
    { id: 'manage', label: '后续操作' },
    { id: 'errors', label: '错误码' },
    { id: 'scopes', label: '权限矩阵' },
  ] as const;

  usePageSeo({
    title: '发布令牌接入说明 | 机场榜 GateRank',
    description: 'GateRank 发布令牌接入说明，包含 Bearer 鉴权、文章创建、封面上传、草稿与发布模式定义。',
    keywords: 'GateRank, 发布令牌, API, 文档, 新闻发布, Bearer Token',
    canonicalPath: buildPublishTokenDocsHref(),
  });

  return (
    <PageFrame active="docs">
      <section className="bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_22%,#f8fafc_100%)]">
        <div className="max-w-7xl mx-auto px-4 pt-10 md:pt-14 pb-14 md:pb-20">
          <div className="relative overflow-hidden rounded-[36px] border border-neutral-200 bg-[linear-gradient(135deg,#f6f2ea_0%,#ffffff_44%,#eef4ff_100%)] px-6 py-8 md:px-10 md:py-12 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 12% 20%, rgba(245,158,11,0.12), transparent 24%), radial-gradient(circle at 78% 16%, rgba(59,130,246,0.12), transparent 22%), radial-gradient(circle at 70% 78%, rgba(16,185,129,0.08), transparent 20%)' }} />
            <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/90 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500 shadow-sm backdrop-blur">
                  <BookOpen className="h-3.5 w-3.5" />
                  Publish Token Docs
                </div>
                <h1 className="max-w-4xl text-4xl md:text-5xl lg:text-[58px] font-black leading-[0.95] tracking-tight text-neutral-900">
                  GateRank 发布令牌接入说明
                  <span className="block text-neutral-400">给第三方系统与 AI 的正式发文接口文档</span>
                </h1>
                <p className="max-w-3xl text-sm md:text-base leading-8 text-neutral-600">
                  这是一份公开接入文档，用于说明 GateRank 当前开放的新闻发布能力、Bearer 鉴权方式、草稿与直接发布的区别、
                  封面上传流程，以及你在接入时会遇到的常见错误和 scope 约束。
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="#quickstart"
                    className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-black text-white transition-transform hover:-translate-y-0.5"
                  >
                    快速开始
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="#scopes"
                    className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/85 px-5 py-3 text-sm font-black text-neutral-700 shadow-sm backdrop-blur"
                  >
                    查看权限矩阵
                    <ListChecks className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="rounded-[28px] border border-neutral-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="space-y-4">
                  <DocsKeyMetric icon={<KeyRound className="h-4 w-4" />} label="鉴权方式" value="Bearer publish_token" />
                  <DocsKeyMetric icon={<FileCode2 className="h-4 w-4" />} label="封面字段" value="cover_image_url" />
                  <DocsKeyMetric icon={<Upload className="h-4 w-4" />} label="发布模式" value="publish_mode = draft | publish" />
                  <DocsKeyMetric icon={<BookOpen className="h-4 w-4" />} label="公开文档 URL" value={buildAbsoluteUrl(buildPublishTokenDocsHref())} />
                  <DocsKeyMetric icon={<ShieldCheck className="h-4 w-4" />} label="文档状态" value="Public · Version 1" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 h-fit">
              <div className="rounded-[28px] border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <div className="px-2 pb-3 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">目录</div>
                <nav className="space-y-1">
                  {docSections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="block rounded-2xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      {section.label}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <main className="space-y-6">
              <DocsSection id="overview" index="01" title="总览" subtitle="Authentication & Data Contract">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ReadonlyInfoCard label="Base URL" value={publishApiBase} />
                  <ReadonlyInfoCard label="鉴权方式" value="Authorization: Bearer <publish_token>" />
                  <ReadonlyInfoCard label="封面字段" value="cover_image_url" />
                  <ReadonlyInfoCard label="发布模式字段" value="publish_mode" />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <DocPanel
                    title="字段说明"
                    items={[
                      { code: 'title', text: '文章标题。' },
                      { code: 'content_markdown', text: '正文 Markdown，发布时必填。' },
                      { code: 'slug', text: '可选，不传时会按标题自动生成。' },
                      { code: 'excerpt', text: '可选，不传时会根据正文自动提取摘要。' },
                      { code: 'cover_image_url', text: '封面地址字段，可直接传本站已上传图片 URL。' },
                      { code: 'publish_mode', text: '只支持 draft 或 publish，默认 draft。' },
                    ]}
                  />
                  <DocPanel
                    title="行为定义"
                    items={[
                      { code: 'draft', text: '只在后台创建草稿，不出现在前台 News。' },
                      { code: 'publish', text: '创建后立即上线，需要 news:create + news:publish。' },
                      { code: 'article.id', text: '创建成功后返回文章 ID，后续更新和发布都基于这个 ID。' },
                    ]}
                  />
                </div>
              </DocsSection>

              <DocsSection id="security" index="02" title="鉴权与安全" subtitle="Security Contract">
                <div className="grid gap-4 lg:grid-cols-2">
                  <DocPanel
                    title="鉴权约定"
                    items={[
                      { code: 'Authorization', text: '仅支持 Bearer Token，不接受 x-api-key。' },
                      { code: '401', text: '令牌不存在、已吊销、已过期，或 Authorization 格式不正确。' },
                      { code: '403', text: '令牌存在，但 scope 不足，无法访问当前接口。' },
                    ]}
                  />
                  <DocPanel
                    title="令牌管理约定"
                    items={[
                      { code: 'plain_token', text: '明文令牌只在创建成功时返回一次，之后不可找回。' },
                      { code: 'revoke', text: '吊销后立刻失效，后续请求全部按未授权处理。' },
                      { code: 'article.id', text: '第三方系统应保存创建返回的 article.id，后续操作均基于此值。' },
                    ]}
                  />
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-950">
                  建议将发布令牌视为后端服务密钥，仅保存在服务端配置或安全密钥系统中。不要把它写入前端页面、浏览器脚本或公开仓库。
                </div>
              </DocsSection>

              <DocsSection id="quickstart" index="03" title="快速开始" subtitle="Recommended Flow">
                <ol className="grid gap-3 md:grid-cols-2">
                  {[
                    '先准备 Bearer 令牌，并确认该令牌具备所需 scope。',
                    '如果有封面图，先调用 upload-image 拿到本站图片 URL。',
                    '调用 POST /news，创建草稿或直接发布。',
                    '如果创建的是草稿，再调用 /news/:id/publish 上线。',
                  ].map((item, index) => (
                    <li key={item} className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-sm leading-7 text-neutral-700">
                      <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs font-black text-white">{index + 1}</span>
                      {item}
                    </li>
                  ))}
                </ol>
                <CodeBlock code={`curl -X POST '${publishApiBase}/news' \\
  -H 'Authorization: Bearer <publish_token>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "title":"新文章",
    "content_markdown":"# Hello\\n\\n正文内容",
    "publish_mode":"draft"
  }'`} />
              </DocsSection>

              <DocsSection id="workflow" index="04" title="状态流转" subtitle="Draft → Publish → Archive">
                <div className="grid gap-4 lg:grid-cols-3">
                  <FlowStep
                    step="01"
                    title="Draft"
                    body="创建草稿后，内容只在后台存在，前台 News 页面不会展示。适合由第三方系统先写入，再由你在后台复核。"
                  />
                  <FlowStep
                    step="02"
                    title="Publish"
                    body="调用 publish 或在创建时直接使用 publish_mode=publish 后，文章会进入前台已发布集合。"
                  />
                  <FlowStep
                    step="03"
                    title="Archive"
                    body="归档后文章不再作为前台已发布新闻展示，但数据仍保留在后台系统中，便于追溯和再次处理。"
                  />
                </div>
              </DocsSection>

              <DocsSection id="create" index="05" title="创建文章" subtitle="POST /news">
                <EndpointCard
                  method="POST"
                  path="/api/v1/publish/news"
                  scopes="news:create；若 publish_mode=publish，还需要 news:publish"
                  summary="创建一篇新闻草稿，或直接创建并发布。"
                />
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_400px]">
                  <CodeBlock code={`{
  "title": "新文章",
  "slug": "new-article",
  "excerpt": "可选摘要",
  "cover_image_url": "/uploads/news/1743240000000-cover.webp",
  "content_markdown": "# Hello\\n\\n正文内容",
  "publish_mode": "draft"
}`} />
                  <div className="space-y-4">
                    <ResponseCard
                      title="返回要点"
                      lines={[
                        '返回完整 article 对象，其中包含 article.id。',
                        '如果 slug 冲突，会返回 NEWS_SLUG_CONFLICT。',
                        '未传 excerpt 时，会按正文自动提取摘要。',
                      ]}
                    />
                    <CodeBlock code={`{
  "article": {
    "id": 123,
    "title": "新文章",
    "slug": "new-article",
    "status": "draft",
    "cover_image_url": "/uploads/news/1743240000000-cover.webp",
    "published_at": null
  }
}`} />
                    <SchemaTable
                      title="Request Body"
                      rows={[
                        ['title', 'string', '是', '文章标题'],
                        ['content_markdown', 'string', '是', '正文 Markdown'],
                        ['slug', 'string', '否', '可选，不传自动生成'],
                        ['excerpt', 'string', '否', '可选，不传自动提取'],
                        ['cover_image_url', 'string', '否', '封面地址字段'],
                        ['publish_mode', 'draft | publish', '否', '默认 draft'],
                      ]}
                    />
                    <SchemaTable
                      title="Key Response Fields"
                      rows={[
                        ['article.id', 'number', '是', '文章主键，后续更新/发布/归档都基于此值'],
                        ['article.status', 'string', '是', 'draft 或 published'],
                        ['article.slug', 'string', '是', '最终文章 slug'],
                        ['article.published_at', 'string | null', '是', '未发布时为 null'],
                      ]}
                    />
                  </div>
                </div>
              </DocsSection>

              <DocsSection id="upload" index="06" title="上传封面" subtitle="POST /news/upload-image">
                <EndpointCard
                  method="POST"
                  path="/api/v1/publish/news/upload-image"
                  scopes="news:upload"
                  summary="上传正文图片或封面图片；如果 mode=cover，会按封面规则压缩处理。"
                />
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_400px]">
                  <div className="space-y-4">
                    <CodeBlock code={`curl -X POST '${publishApiBase}/news/upload-image' \\
  -H 'Authorization: Bearer <publish_token>' \\
  -F 'mode=cover' \\
  -F 'file=@/path/to/cover.png'`} />
                    <CodeBlock code={`{"url":"/uploads/news/1743240000000-cover.webp"}`} />
                  </div>
                  <div className="space-y-4">
                    <SchemaTable
                      title="Multipart Fields"
                      rows={[
                        ['file', 'binary', '是', '图片文件本体'],
                        ['mode', 'cover | inline', '否', '封面建议传 cover；不传时按普通正文图片处理'],
                      ]}
                    />
                    <SchemaTable
                      title="Response"
                      rows={[
                        ['url', 'string', '是', '上传完成后的本站图片地址'],
                      ]}
                    />
                  </div>
                </div>
              </DocsSection>

              <DocsSection id="manage" index="07" title="后续操作" subtitle="PATCH /publish / archive">
                <div className="space-y-4">
                  <EndpointCard
                    method="PATCH"
                    path="/api/v1/publish/news/:id"
                    scopes="news:update"
                    summary="更新已存在的文章内容。"
                  />
                  <EndpointCard
                    method="POST"
                    path="/api/v1/publish/news/:id/publish"
                    scopes="news:publish"
                    summary="将草稿正式发布到前台。"
                  />
                  <EndpointCard
                    method="POST"
                    path="/api/v1/publish/news/:id/archive"
                    scopes="news:archive"
                    summary="归档文章，使其不再作为前台已发布新闻展示。"
                  />
                </div>
                <CodeBlock code={`# 更新文章
curl -X PATCH '${publishApiBase}/news/123' \\
  -H 'Authorization: Bearer <publish_token>' \\
  -H 'Content-Type: application/json' \\
  -d '{"title":"更新后的标题","content_markdown":"# Updated"}'

# 发布草稿
curl -X POST '${publishApiBase}/news/123/publish' \\
  -H 'Authorization: Bearer <publish_token>' \\
  -H 'Content-Type: application/json' \\
  -d '{}'

# 归档文章
curl -X POST '${publishApiBase}/news/123/archive' \\
  -H 'Authorization: Bearer <publish_token>'`} />
                <div className="grid gap-4 lg:grid-cols-3">
                  <ResponseCard
                    title="更新文章"
                    lines={[
                      '适用于修正文案、摘要、slug、正文和封面。',
                      '建议只提交需要变更的字段，但 title 与 content_markdown 通常应保持完整。',
                    ]}
                  />
                  <ResponseCard
                    title="发布草稿"
                    lines={[
                      '发布成功后，article.status 会切换为 published。',
                      '如果文章不存在，会返回 NEWS_NOT_FOUND。',
                    ]}
                  />
                  <ResponseCard
                    title="归档文章"
                    lines={[
                      '归档后不会作为前台已发布新闻展示。',
                      '适合处理误发、过期活动或内容撤回场景。',
                    ]}
                  />
                </div>
              </DocsSection>

              <DocsSection id="errors" index="08" title="错误码" subtitle="Common Failures">
                <div className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white">
                  <div className="grid grid-cols-[160px_minmax(0,1fr)] border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
                    <div>Code</div>
                    <div>Meaning</div>
                  </div>
                  {[
                    ['UNAUTHORIZED', 'Bearer token 不存在、已吊销、格式不对，或已过期。'],
                    ['FORBIDDEN', '令牌存在，但缺少当前接口所需 scope。'],
                    ['NEWS_SLUG_CONFLICT', 'slug 已存在，需要更换。'],
                    ['BAD_REQUEST', '字段缺失、publish_mode 非法、文件或参数格式错误。'],
                    ['NEWS_NOT_FOUND', '文章 ID 不存在。'],
                  ].map(([code, desc]) => (
                    <div key={code} className="grid grid-cols-[160px_minmax(0,1fr)] border-b border-neutral-100 px-5 py-4 text-sm last:border-b-0">
                      <div className="font-mono font-semibold text-neutral-900">{code}</div>
                      <div className="leading-7 text-neutral-700">{desc}</div>
                    </div>
                  ))}
                </div>
                <CodeBlock code={`{
  "code": "FORBIDDEN",
  "message": "Publish token scope not allowed",
  "request_id": "..."
}`} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <DocPanel
                    title="排查顺序"
                    items={[
                      { code: '401', text: '先检查 Authorization 格式、令牌是否已吊销、是否已过期。' },
                      { code: '403', text: '再检查该 token 是否具备当前接口所需 scope。' },
                      { code: 'BAD_REQUEST', text: '最后检查 JSON 字段、multipart 参数和文章 ID 是否正确。' },
                    ]}
                  />
                  <DocPanel
                    title="接入建议"
                    items={[
                      { code: 'request_id', text: '建议在调用失败时记录返回中的 request_id 便于排查。' },
                      { code: 'retry', text: '仅对网络错误或明确可重试场景做有限重试，不要对 401/403 盲目重放。' },
                      { code: 'slug', text: '若系统自行生成 slug，需处理 NEWS_SLUG_CONFLICT 回退逻辑。' },
                    ]}
                  />
                </div>
              </DocsSection>

              <DocsSection id="scopes" index="09" title="权限矩阵" subtitle="Scope Matrix">
                <div className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white">
                  <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
                    <div>接口</div>
                    <div>需要的 Scope</div>
                  </div>
                  {[
                    ['/api/v1/publish/news', 'news:create'],
                    ['/api/v1/publish/news（publish_mode=publish）', 'news:create + news:publish'],
                    ['/api/v1/publish/news/:id', 'news:update'],
                    ['/api/v1/publish/news/:id/publish', 'news:publish'],
                    ['/api/v1/publish/news/:id/archive', 'news:archive'],
                    ['/api/v1/publish/news/upload-image', 'news:upload'],
                  ].map(([path, scopes]) => (
                    <div key={path} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] border-b border-neutral-100 px-5 py-4 text-sm last:border-b-0">
                      <div className="font-mono text-neutral-900 break-all">{path}</div>
                      <div className="text-neutral-700">{scopes}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                  v1 不支持按 slug / external id 的 upsert，也不提供基于 token 的文章列表查询。第三方系统如需后续更新文章，请保存创建接口返回的 <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[0.95em]">article.id</code>。
                </div>
              </DocsSection>
            </main>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

function FlowStep({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[26px] border border-neutral-200 bg-white p-5">
      <div className="inline-flex items-center gap-3 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
        <span className="text-neutral-300">{step}</span>
        <span>{title}</span>
      </div>
      <p className="mt-4 text-sm leading-7 text-neutral-700">{body}</p>
    </div>
  );
}

function DocsSection({
  id,
  index,
  title,
  subtitle,
  children,
}: {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[30px] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-6 md:p-8 space-y-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
      <div>
        <div className="inline-flex items-center gap-3 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
          <span className="text-neutral-300">{index}</span>
          <span>{subtitle}</span>
        </div>
        <h2 className="mt-4 text-2xl md:text-3xl font-black tracking-tight text-neutral-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ReadonlyInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">{label}</div>
      <div className="mt-2 break-all font-mono text-base md:text-lg text-neutral-900">{value}</div>
    </div>
  );
}

function DocLine({ code, text }: { code: string; text: string }) {
  return (
    <p className="text-sm md:text-base leading-7 text-neutral-700">
      <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[0.95em] text-neutral-900">{code}</code>
      {' '}
      {text}
    </p>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-neutral-950">
      <button
        type="button"
        onClick={() => void copyCode()}
        className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/14"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? '已复制' : '复制'}
      </button>
      <pre className="overflow-x-auto px-4 py-4 pr-24 text-xs md:text-sm leading-6 text-neutral-100">
        {code}
      </pre>
    </div>
  );
}

function DocsKeyMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">
        {icon}
        {label}
      </div>
      <div className="mt-3 break-all font-mono text-sm text-neutral-900">{value}</div>
    </div>
  );
}

function DocPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ code: string; text: string }>;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
      <div className="text-sm font-black text-neutral-900">{title}</div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <React.Fragment key={`${title}-${item.code}`}>
            <DocLine code={item.code} text={item.text} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function EndpointCard({
  method,
  path,
  scopes,
  summary,
}: {
  method: 'POST' | 'PATCH';
  path: string;
  scopes: string;
  summary: string;
}) {
  return (
    <div className="rounded-[26px] border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${method === 'POST' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
            {method}
          </span>
          <code className="font-mono text-sm md:text-base text-neutral-900 break-all">{path}</code>
        </div>
        <div className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
          {scopes}
        </div>
      </div>
      <p className="mt-4 text-sm md:text-base leading-7 text-neutral-700">{summary}</p>
    </div>
  );
}

function ResponseCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-[26px] border border-neutral-200 bg-neutral-50 p-5">
      <div className="text-sm font-black text-neutral-900">{title}</div>
      <div className="mt-4 space-y-3">
        {lines.map((line) => (
          <div key={line} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-7 text-neutral-700">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function SchemaTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string, string, string]>;
}) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-black text-neutral-900">{title}</div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[150px_140px_90px_minmax(0,1fr)] border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
            <div>Field</div>
            <div>Type</div>
            <div>Required</div>
            <div>Description</div>
          </div>
          {rows.map(([field, type, required, description]) => (
            <div key={field} className="grid grid-cols-[150px_140px_90px_minmax(0,1fr)] border-b border-neutral-100 px-5 py-4 text-sm last:border-b-0">
              <div className="font-mono text-neutral-900 break-all">{field}</div>
              <div className="font-mono text-neutral-600">{type}</div>
              <div className="text-neutral-700">{required}</div>
              <div className="leading-7 text-neutral-700">{description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
