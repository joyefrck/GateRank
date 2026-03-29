import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  Clock3,
  Eye,
  ImageUp,
  Plus,
  Save,
  Search,
  Send,
  X,
} from 'lucide-react';
import { estimateReadingMinutes, slugifyNewsText } from '../../news/renderMarkdown';

const TOKEN_KEY = 'gaterank_admin_token';

interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  content_html: string;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface NewsListResponse {
  page: number;
  page_size: number;
  total: number;
  items: Array<{
    id: number;
    title: string;
    slug: string;
    excerpt: string;
    cover_image_url: string;
    status: NewsArticle['status'];
    published_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

interface PexelsCoverCandidate {
  id: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographer_url: string;
  pexels_url: string;
  preview_url: string;
  download_url: string;
}

interface PexelsCoverSearchResponse {
  page: number;
  per_page: number;
  total: number;
  items: PexelsCoverCandidate[];
}

interface NewsEditorPageProps {
  articleId?: number;
  onBack: () => void;
  onNavigateToArticle: (id: number) => void;
}

interface NewsListPageProps {
  onCreate: () => void;
  onEdit: (id: number) => void;
}

interface NewsFormState {
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  status: NewsArticle['status'];
  published_at: string | null;
}

const emptyForm: NewsFormState = {
  title: '',
  slug: '',
  excerpt: '',
  cover_image_url: '',
  content_markdown: '',
  status: 'draft',
  published_at: null,
};

export function NewsListPage({ onCreate, onEdit }: NewsListPageProps) {
  const [items, setItems] = useState<NewsListResponse['items']>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | NewsArticle['status']>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const search = new URLSearchParams();
    search.set('page', String(page));
    search.set('page_size', '12');
    if (keyword.trim()) {
      search.set('keyword', keyword.trim());
    }
    if (status !== 'all') {
      search.set('status', status);
    }

    void apiFetch<NewsListResponse>(`/api/v1/admin/news?${search.toString()}`)
      .then((response) => {
        if (!active) {
          return;
        }
        setItems(response.items);
        setTotal(response.total);
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : '新闻列表加载失败');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [keyword, page, status]);

  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">News Module</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight">新闻内容管理</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-neutral-500">
            这里统一管理草稿、已发布文章和已下线内容。列表按发布时间和更新时间排序，方便运营回看最近改动。
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white"
          onClick={onCreate}
        >
          <Plus size={16} />
          新建文章
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-[minmax(0,1fr)_180px]">
        <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <Search size={15} className="text-neutral-400" />
          <input
            className="w-full bg-transparent text-sm outline-none"
            placeholder="搜索标题或 slug"
            value={keyword}
            onChange={(event) => {
              setPage(1);
              setKeyword(event.target.value);
            }}
          />
        </label>
        <select
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as 'all' | NewsArticle['status']);
          }}
        >
          <option value="all">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="archived">已下线</option>
        </select>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-neutral-200">
        <table className="w-full min-w-[960px] table-fixed text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.18em] text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-semibold">文章</th>
              <th className="px-4 py-3 font-semibold">状态</th>
              <th className="px-4 py-3 font-semibold">发布时间</th>
              <th className="px-4 py-3 font-semibold">更新时间</th>
              <th className="px-4 py-3 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {loading ? (
              <tr>
                <td className="px-4 py-10 text-center text-neutral-400" colSpan={5}>加载中...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-neutral-400" colSpan={5}>暂无文章</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-4">
                    <div className="min-w-0">
                      <button
                        className="line-clamp-2 text-left text-base leading-7 font-bold tracking-tight text-neutral-900 hover:text-neutral-700"
                        onClick={() => onEdit(item.id)}
                        title={item.title || '未命名文章'}
                      >
                        {item.title || '未命名文章'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusPill status={item.status} />
                  </td>
                  <td className="px-4 py-4 text-neutral-600">{formatDateTime(item.published_at)}</td>
                  <td className="px-4 py-4 text-neutral-600">{formatDateTime(item.updated_at)}</td>
                  <td className="px-4 py-4 text-right">
                    <button
                      className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
                      onClick={() => onEdit(item.id)}
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-500">共 {total} 篇文章</div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1}
          >
            上一页
          </button>
          <div className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium">
            {page} / {totalPages}
          </div>
          <button
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page >= totalPages}
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}

export function NewsEditorPage({ articleId, onBack, onNavigateToArticle }: NewsEditorPageProps) {
  const [form, setForm] = useState<NewsFormState>(emptyForm);
  const [loading, setLoading] = useState(Boolean(articleId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [slugTouched, setSlugTouched] = useState(Boolean(articleId));
  const [coverSearchQuery, setCoverSearchQuery] = useState('');
  const [coverSearchResults, setCoverSearchResults] = useState<PexelsCoverCandidate[]>([]);
  const [coverSearchLoading, setCoverSearchLoading] = useState(false);
  const [coverSearchImportingId, setCoverSearchImportingId] = useState<number | null>(null);
  const [coverSearchError, setCoverSearchError] = useState('');
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const markdownRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!articleId) {
      setForm(emptyForm);
      setSlugTouched(false);
      setLoading(false);
      setError('');
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    void apiFetch<NewsArticle>(`/api/v1/admin/news/${articleId}`)
      .then((article) => {
        if (!active) {
          return;
        }
        const shouldAutoGenerateSlug = article.status === 'draft';
        setForm({
          title: article.title,
          slug: shouldAutoGenerateSlug ? slugifyNewsText(article.title) : article.slug,
          excerpt: article.excerpt,
          cover_image_url: article.cover_image_url,
          content_markdown: article.content_markdown,
          status: article.status,
          published_at: article.published_at,
        });
        setSlugTouched(!shouldAutoGenerateSlug);
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : '文章加载失败');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [articleId]);

  useEffect(() => {
    if (slugTouched) {
      return;
    }
    setForm((current) => {
      const nextSlug = slugifyNewsText(current.title);
      if (current.slug === nextSlug) {
        return current;
      }
      return { ...current, slug: nextSlug };
    });
  }, [form.title, slugTouched]);

  const readingMinutes = useMemo(() => estimateReadingMinutes(form.content_markdown), [form.content_markdown]);

  async function saveDraft(): Promise<NewsArticle | null> {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        cover_image_url: form.cover_image_url,
        content_markdown: form.content_markdown,
      };
      const article = articleId
        ? await apiFetch<NewsArticle>(`/api/v1/admin/news/${articleId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<NewsArticle>('/api/v1/admin/news', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setForm((current) => ({
        ...current,
        status: article.status,
        published_at: article.published_at,
      }));
      if (!articleId) {
        onNavigateToArticle(article.id);
      }
      setNotice('草稿已保存');
      return article;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '草稿保存失败');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function publishArticle(): Promise<void> {
    let targetId = articleId;
    if (!targetId) {
      const draft = await saveDraft();
      if (!draft?.id) {
        return;
      }
      targetId = draft.id;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const article = await apiFetch<NewsArticle>(`/api/v1/admin/news/${targetId}/publish`, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          excerpt: form.excerpt,
          cover_image_url: form.cover_image_url,
          content_markdown: form.content_markdown,
        }),
      });
      setForm((current) => ({
        ...current,
        status: article.status,
        published_at: article.published_at,
      }));
      if (!articleId) {
        onNavigateToArticle(article.id);
      }
      setNotice('文章已发布');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '文章发布失败');
    } finally {
      setSaving(false);
    }
  }

  async function archiveArticle(): Promise<void> {
    if (!articleId) {
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const article = await apiFetch<NewsArticle>(`/api/v1/admin/news/${articleId}/archive`, {
        method: 'POST',
      });
      setForm((current) => ({
        ...current,
        status: article.status,
        published_at: article.published_at,
      }));
      setNotice('文章已下线');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '文章下线失败');
    } finally {
      setSaving(false);
    }
  }

  async function openPreview(): Promise<void> {
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.open();
      previewWindow.document.write('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8" /><title>预览加载中...</title><style>body{margin:0;padding:24px;font:16px/1.6 Inter,system-ui,sans-serif;color:#111} .muted{color:#666}</style></head><body><div>预览加载中...</div><div class="muted">正在生成前台全文效果。</div></body></html>');
      previewWindow.document.close();
    }
    const article = await saveDraft();
    if (article?.id) {
      try {
        const html = await apiFetchText(`/api/v1/admin/news/${article.id}/preview`);
        if (previewWindow) {
          previewWindow.document.open();
          previewWindow.document.write(html);
          previewWindow.document.close();
        } else {
          const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
          window.open(blobUrl, '_blank');
          window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        }
      } catch (err: unknown) {
        if (previewWindow) {
          previewWindow.close();
        }
        setError(err instanceof Error ? err.message : '全文预览打开失败');
      }
    } else if (previewWindow) {
      previewWindow.close();
    }
  }

  async function uploadImage(mode: 'cover' | 'body', file: File) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('mode', mode);
      const result = await apiFetch<{ url: string }>('/api/v1/admin/news/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (mode === 'cover') {
        setForm((current) => ({ ...current, cover_image_url: result.url }));
        setNotice('封面图已上传');
      } else {
        setForm((current) => {
          const markdown = current.content_markdown;
          const imageMarkdown = `\n\n![${file.name}](${result.url})\n\n`;
          const target = markdownRef.current;
          if (!target) {
            return { ...current, content_markdown: `${markdown}${imageMarkdown}` };
          }
          const start = target.selectionStart || markdown.length;
          const end = target.selectionEnd || markdown.length;
          return {
            ...current,
            content_markdown: `${markdown.slice(0, start)}${imageMarkdown}${markdown.slice(end)}`,
          };
        });
        setNotice('正文图片已插入');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '图片上传失败');
    } finally {
      setSaving(false);
    }
  }

  async function searchPexelsCovers(): Promise<void> {
    const query = coverSearchQuery.trim();
    if (!query) {
      setCoverSearchError('请输入封面关键词');
      setCoverSearchResults([]);
      return;
    }

    setCoverSearchLoading(true);
    setCoverSearchError('');
    try {
      const search = new URLSearchParams({
        q: query,
        page: '1',
        per_page: '12',
      });
      const result = await apiFetch<PexelsCoverSearchResponse>(`/api/v1/admin/news/cover-search?${search.toString()}`);
      setCoverSearchResults(result.items);
      if (result.items.length === 0) {
        setCoverSearchError('没有找到合适的横版封面');
      }
    } catch (err: unknown) {
      setCoverSearchResults([]);
      setCoverSearchError(err instanceof Error ? err.message : '封面搜索失败');
    } finally {
      setCoverSearchLoading(false);
    }
  }

  async function importPexelsCover(item: PexelsCoverCandidate): Promise<void> {
    setCoverSearchImportingId(item.id);
    setCoverSearchError('');
    setError('');
    setNotice('');
    try {
      const result = await apiFetch<{ url: string }>('/api/v1/admin/news/import-cover-image', {
        method: 'POST',
        body: JSON.stringify({
          id: item.id,
          download_url: item.download_url,
        }),
      });
      setForm((current) => ({ ...current, cover_image_url: result.url }));
      setNotice('Pexels 封面已导入');
      setCoverPickerOpen(false);
    } catch (err: unknown) {
      setCoverSearchError(err instanceof Error ? err.message : '封面导入失败');
    } finally {
      setCoverSearchImportingId(null);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-neutral-400">文章加载中...</div>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
            onClick={onBack}
          >
            <ArrowLeft size={15} />
            返回列表
          </button>
          <div className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-neutral-400">News Editor</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight">{articleId ? '编辑文章' : '新建文章'}</h1>
            <StatusPill status={form.status} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-500">
            <span className="inline-flex items-center gap-2"><Clock3 size={15} />预计阅读 {readingMinutes} 分钟</span>
            <span className="inline-flex items-center gap-2"><CalendarDays size={15} />{formatDateTime(form.published_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
            onClick={() => void openPreview()}
            disabled={saving}
          >
            <Eye size={16} />
            预览全文
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
            onClick={() => void saveDraft()}
            disabled={saving}
          >
            <Save size={16} />
            保存草稿
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void publishArticle()}
            disabled={saving}
          >
            <Send size={16} />
            发布文章
          </button>
          {articleId ? (
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 disabled:opacity-50"
              onClick={() => void archiveArticle()}
              disabled={saving}
            >
              <Archive size={16} />
              下线文章
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="grid gap-4">
            <Field label="标题">
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="例如：2026-03-28 机场 VPN 推荐与可靠性观察"
              />
            </Field>

            <Field
              label="Slug"
              action={(
                <button
                  type="button"
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
                  onClick={() => setSlugTouched(false)}
                >
                  按标题生成
                </button>
              )}
            >
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
                value={form.slug}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSlugTouched(nextValue.trim().length > 0);
                  setForm((current) => ({ ...current, slug: nextValue }));
                }}
                placeholder="ji-chang-bang-de-chuang-jian-si-lu"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
              <div className="mt-2 text-xs leading-5 text-neutral-500">
                用于文章链接。默认跟随标题自动生成；手动修改后会保持你的输入。
              </div>
            </Field>

            <Field label="摘要">
              <textarea
                className="min-h-[110px] w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
                value={form.excerpt}
                onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
                placeholder="搜索摘要、社交分享摘要与列表摘要共用这段文案。"
              />
            </Field>

            <Field
              label="封面图"
              action={(
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
                    <ImageUp size={14} />
                    上传封面
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void uploadImage('cover', file);
                        }
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
                    onClick={() => setCoverPickerOpen(true)}
                  >
                    <Search size={14} />
                    从图库选择封面
                  </button>
                </div>
              )}
            >
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
                value={form.cover_image_url}
                onChange={(event) => setForm((current) => ({ ...current, cover_image_url: event.target.value }))}
                placeholder="/uploads/news/..."
              />
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-6 text-neutral-500">
                第三方封面图库已收起为独立选择器。点击“从图库选择封面”后，在弹窗里搜索并导入，不会继续拉长编辑页。
              </div>
              {form.cover_image_url ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                  <img className="h-48 w-full object-cover" src={form.cover_image_url} alt="封面预览" />
                </div>
              ) : null}
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <Field
            label="正文 Markdown"
            action={(
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
                <ImageUp size={14} />
                插入正文图片
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadImage('body', file);
                    }
                    event.target.value = '';
                  }}
                />
              </label>
            )}
          >
            <textarea
              ref={markdownRef}
              className="min-h-[560px] w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm leading-7 outline-none focus:border-neutral-400"
              value={form.content_markdown}
              onChange={(event) => setForm((current) => ({ ...current, content_markdown: event.target.value }))}
              placeholder="# 标题&#10;&#10;使用 Markdown 写正文，支持图片、引用、列表和代码块。"
            />
          </Field>
        </div>
      </div>

      <CoverPickerModal
        open={coverPickerOpen}
        query={coverSearchQuery}
        results={coverSearchResults}
        loading={coverSearchLoading}
        importingId={coverSearchImportingId}
        error={coverSearchError}
        onClose={() => setCoverPickerOpen(false)}
        onQueryChange={setCoverSearchQuery}
        onSearch={() => void searchPexelsCovers()}
        onImport={(item) => void importPexelsCover(item)}
      />
    </section>
  );
}

function CoverPickerModal({
  open,
  query,
  results,
  loading,
  importingId,
  error,
  onClose,
  onQueryChange,
  onSearch,
  onImport,
}: {
  open: boolean;
  query: string;
  results: PexelsCoverCandidate[];
  loading: boolean;
  importingId: number | null;
  error: string;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onImport: (item: PexelsCoverCandidate) => void;
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end justify-center p-0 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="w-full h-full md:h-auto md:max-w-6xl md:max-h-[88vh] rounded-none md:rounded-[28px] border-0 md:border md:border-neutral-200 bg-white shadow-none md:shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-neutral-200 px-5 py-4 md:px-6 md:py-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">第三方封面图库</h3>
            <p className="text-sm text-neutral-500">搜索 Pexels 图片并导入为本站封面，结果只在当前选择器内滚动显示。</p>
          </div>
          <button
            type="button"
            className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6 md:py-6 space-y-5 overscroll-contain">
          <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 md:p-5 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Pexels 图库</div>
                <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                  <Search size={15} className="text-neutral-400" />
                  <input
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="例如：airport runway skyline"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onSearch();
                      }
                    }}
                  />
                </div>
              </div>
              <button
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
                onClick={onSearch}
                disabled={loading}
                type="button"
              >
                {loading ? '搜索中...' : '搜索封面'}
              </button>
            </div>
            <div className="text-xs leading-6 text-neutral-500">
              结果来自 Pexels，选中后会下载并转存到本站 `/uploads/news`，不会在正式文章中依赖第三方热链。
            </div>
            {error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {error}
              </div>
            ) : null}
          </section>

          {results.length > 0 ? (
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {results.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  <img className="h-40 w-full object-cover" src={item.preview_url} alt={item.alt || 'Pexels 封面候选'} />
                  <div className="space-y-3 p-4">
                    <div className="space-y-1">
                      <div className="line-clamp-2 text-sm font-semibold text-neutral-900">
                        {item.alt || '未命名封面'}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {item.width} × {item.height}
                      </div>
                    </div>
                    <div className="text-xs leading-5 text-neutral-600">
                      摄影师：
                      {item.photographer_url ? (
                        <a
                          className="ml-1 text-neutral-900 underline-offset-2 hover:underline"
                          href={item.photographer_url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {item.photographer || '未知'}
                        </a>
                      ) : (
                        <span className="ml-1 text-neutral-900">{item.photographer || '未知'}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <a
                        className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
                        href={item.pexels_url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        查看来源
                      </a>
                      <button
                        className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        onClick={() => onImport(item)}
                        disabled={importingId === item.id}
                        type="button"
                      >
                        {importingId === item.id ? '导入中...' : '导入为封面'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center text-sm text-neutral-500">
              输入关键词后开始搜索，结果会显示在这个弹窗里。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-neutral-700">{label}</span>
        {action}
      </div>
      {children}
    </label>
  );
}

function StatusPill({ status }: { status: NewsArticle['status'] }) {
  const tone = status === 'published'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'archived'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-neutral-200 bg-neutral-100 text-neutral-700';
  const label = status === 'published' ? '已发布' : status === 'archived' ? '已下线' : '草稿';
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function formatDateTime(value: string | null): string {
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

function getApiBase(): string {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.replace(/\/+$/, '');
  }
  return '';
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = buildAuthHeaders(init.headers);
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const data = (await safeJson(response)) as { message?: string } | null;
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }

  return (await safeJson(response)) as T;
}

async function apiFetchText(path: string, init: RequestInit = {}): Promise<string> {
  const headers = buildAuthHeaders(init.headers);
  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const data = (await safeJson(response)) as { message?: string } | null;
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }

  return response.text();
}

function buildAuthHeaders(source?: HeadersInit): Headers {
  const headers = new Headers(source || {});
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
