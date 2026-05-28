import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  Eye,
  ImageUp,
  Link2,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { estimateReadingMinutes } from '../../news/renderMarkdown';
import {
  extractNewsAirportProfileEmbeds,
  removeNewsAirportProfileEmbedAt,
  serializeNewsAirportProfileEmbed,
  type NewsAirportProfileEmbed,
} from '../../../shared/newsAirportProfile';
import {
  extractNewsAirportLinkEmbeds,
  removeNewsAirportLinkEmbedAt,
  serializeNewsAirportLinkEmbed,
  type NewsAirportLinkEmbed,
} from '../../../shared/newsAirportLink';

const COVER_SEARCH_PER_PAGE = 12;

interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  content_html: string;
  category_id: number | null;
  is_featured: boolean;
  is_recommended: boolean;
  recommend_weight: number;
  category: NewsTaxonomyItem | null;
  topics: NewsTaxonomyItem[];
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface NewsTaxonomyItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
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
    category_id: number | null;
    is_featured: boolean;
    is_recommended: boolean;
    recommend_weight: number;
    category: NewsTaxonomyItem | null;
    topics: NewsTaxonomyItem[];
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

interface ScoreDeltaView {
  label: string;
  value: number | null;
}

interface FullRankingItemResponse {
  airport_id: number;
  rank: number;
  name: string;
  website: string;
  status: string;
  tags: string[];
  founded_on?: string | null;
  plan_price_month: number | null;
  has_trial: boolean;
  airport_intro?: string | null;
  created_at: string | null;
  score: number | null;
  score_date?: string | null;
  score_delta_vs_yesterday: ScoreDeltaView;
  report_url?: string | null;
  capabilities?: {
    payment_methods: Array<{ label: string }>;
    streaming: Array<{ label: string }>;
    clients: Array<{ label: string }>;
    import_methods: Array<{ label: string }>;
    regions: Array<{ label: string }>;
    plan: {
      supports_annual: boolean | null;
      has_lifetime_plan: boolean | null;
    };
    telegram: {
      has_group: boolean | null;
    };
  };
}

interface FullRankingPageResponse {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: FullRankingItemResponse[];
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
  category_id: number | null;
  topic_ids: number[];
  is_featured: boolean;
  is_recommended: boolean;
  recommend_weight: number;
  status: NewsArticle['status'];
  published_at: string | null;
}

const emptyForm: NewsFormState = {
  title: '',
  slug: '',
  excerpt: '',
  cover_image_url: '',
  content_markdown: '',
  category_id: null,
  topic_ids: [],
  is_featured: false,
  is_recommended: false,
  recommend_weight: 0,
  status: 'draft',
  published_at: null,
};

export function NewsListPage({ onCreate, onEdit }: NewsListPageProps) {
  const [items, setItems] = useState<NewsListResponse['items']>([]);
  const [categories, setCategories] = useState<NewsTaxonomyItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | NewsArticle['status']>('all');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void apiFetch<{ items: NewsTaxonomyItem[] }>('/api/v1/admin/news/categories')
      .then((response) => setCategories(response.items))
      .catch(() => setCategories([]));
  }, []);

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
    if (category !== 'all') {
      search.set('category', category);
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
  }, [category, keyword, page, status, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(total / 12));

  async function deleteArticleFromList(item: NewsListResponse['items'][number]): Promise<void> {
    if (item.status === 'published') {
      return;
    }
    const confirmed = window.confirm(`确认删除「${item.title || '未命名文章'}」？删除后不能恢复。`);
    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    setError('');
    try {
      await apiFetch<void>(`/api/v1/admin/news/${item.id}/delete`, {
        method: 'POST',
      });
      if (items.length === 1 && page > 1) {
        setPage((value) => Math.max(1, value - 1));
      } else {
        setReloadKey((value) => value + 1);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '文章删除失败');
    } finally {
      setDeletingId(null);
    }
  }

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

      <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
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
        <select
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
          value={category}
          onChange={(event) => {
            setPage(1);
            setCategory(event.target.value);
          }}
        >
          <option value="all">全部分类</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>{item.name}</option>
          ))}
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
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-neutral-500">
                        {item.category ? <span className="rounded-full bg-neutral-100 px-2 py-0.5">{item.category.name}</span> : null}
                        {item.is_featured ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">主打</span> : null}
                        {item.is_recommended ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">推荐 {item.recommend_weight}</span> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusPill status={item.status} />
                  </td>
                  <td className="px-4 py-4 text-neutral-600">{formatDateTime(item.published_at)}</td>
                  <td className="px-4 py-4 text-neutral-600">{formatDateTime(item.updated_at)}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
                        onClick={() => onEdit(item.id)}
                      >
                        编辑
                      </button>
                      {item.status !== 'published' ? (
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          onClick={() => void deleteArticleFromList(item)}
                          disabled={deletingId === item.id}
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      ) : null}
                    </div>
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
  const [categories, setCategories] = useState<NewsTaxonomyItem[]>([]);
  const [topics, setTopics] = useState<NewsTaxonomyItem[]>([]);
  const [loading, setLoading] = useState(Boolean(articleId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [coverSearchQuery, setCoverSearchQuery] = useState('');
  const [coverSearchResults, setCoverSearchResults] = useState<PexelsCoverCandidate[]>([]);
  const [coverSearchPage, setCoverSearchPage] = useState(1);
  const [coverSearchPerPage, setCoverSearchPerPage] = useState(COVER_SEARCH_PER_PAGE);
  const [coverSearchTotal, setCoverSearchTotal] = useState(0);
  const [coverSearchLoading, setCoverSearchLoading] = useState(false);
  const [coverSearchImportingId, setCoverSearchImportingId] = useState<number | null>(null);
  const [coverSearchError, setCoverSearchError] = useState('');
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [airportProfilePickerOpen, setAirportProfilePickerOpen] = useState(false);
  const [airportPickerMode, setAirportPickerMode] = useState<'link' | 'profile'>('profile');
  const [airportProfileSearchQuery, setAirportProfileSearchQuery] = useState('');
  const [airportProfileResults, setAirportProfileResults] = useState<FullRankingItemResponse[]>([]);
  const [airportProfileSearchPage, setAirportProfileSearchPage] = useState(1);
  const [airportProfileSearchTotal, setAirportProfileSearchTotal] = useState(0);
  const [airportProfileTotalPages, setAirportProfileTotalPages] = useState(1);
  const [airportProfileSearchLoading, setAirportProfileSearchLoading] = useState(false);
  const [airportProfileSearchError, setAirportProfileSearchError] = useState('');
  const markdownRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    void Promise.all([
      apiFetch<{ items: NewsTaxonomyItem[] }>('/api/v1/admin/news/categories'),
      apiFetch<{ items: NewsTaxonomyItem[] }>('/api/v1/admin/news/topics'),
    ])
      .then(([categoryResponse, topicResponse]) => {
        setCategories(categoryResponse.items);
        setTopics(topicResponse.items);
      })
      .catch(() => {
        setCategories([]);
        setTopics([]);
      });
  }, []);

  useEffect(() => {
    if (!articleId) {
      setForm(emptyForm);
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
        setForm({
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          cover_image_url: article.cover_image_url,
          content_markdown: article.content_markdown,
          category_id: article.category_id,
          topic_ids: article.topics.map((topic) => topic.id),
          is_featured: article.is_featured,
          is_recommended: article.is_recommended,
          recommend_weight: article.recommend_weight,
          status: article.status,
          published_at: article.published_at,
        });
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

  const readingMinutes = useMemo(() => estimateReadingMinutes(form.content_markdown), [form.content_markdown]);
  const airportProfileEmbeds = useMemo(
    () => extractNewsAirportProfileEmbeds(form.content_markdown),
    [form.content_markdown],
  );
  const airportLinkEmbeds = useMemo(
    () => extractNewsAirportLinkEmbeds(form.content_markdown),
    [form.content_markdown],
  );
  const isSlugLocked = form.status !== 'draft';

  function buildPayload() {
    return {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt,
      cover_image_url: form.cover_image_url,
      content_markdown: form.content_markdown,
      category_id: form.category_id,
      topic_ids: form.topic_ids,
      is_featured: form.is_featured,
      is_recommended: form.is_recommended,
      recommend_weight: form.recommend_weight,
    };
  }

  function validateManualSlug(): boolean {
    if (form.slug.trim()) {
      return true;
    }
    setError('Slug 必填，请手动输入。');
    setNotice('');
    return false;
  }

  async function saveDraft(): Promise<NewsArticle | null> {
    if (!validateManualSlug()) {
      return null;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = buildPayload();
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
        category_id: article.category_id,
        topic_ids: article.topics.map((topic) => topic.id),
        is_featured: article.is_featured,
        is_recommended: article.is_recommended,
        recommend_weight: article.recommend_weight,
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
    if (!validateManualSlug()) {
      return;
    }

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
        body: JSON.stringify(buildPayload()),
      });
      setForm((current) => ({
        ...current,
        status: article.status,
        published_at: article.published_at,
        category_id: article.category_id,
        topic_ids: article.topics.map((topic) => topic.id),
        is_featured: article.is_featured,
        is_recommended: article.is_recommended,
        recommend_weight: article.recommend_weight,
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

  async function searchPexelsCovers(targetPage = 1): Promise<void> {
    const query = coverSearchQuery.trim();
    if (!query) {
      setCoverSearchError('请输入封面关键词');
      setCoverSearchResults([]);
      setCoverSearchPage(1);
      setCoverSearchTotal(0);
      return;
    }

    setCoverSearchLoading(true);
    setCoverSearchError('');
    try {
      const search = new URLSearchParams({
        q: query,
        page: String(targetPage),
        per_page: String(coverSearchPerPage),
      });
      const result = await apiFetch<PexelsCoverSearchResponse>(`/api/v1/admin/news/cover-search?${search.toString()}`);
      setCoverSearchResults(result.items);
      setCoverSearchPage(result.page);
      setCoverSearchPerPage(result.per_page);
      setCoverSearchTotal(result.total);
      if (result.items.length === 0) {
        setCoverSearchError('没有找到合适的横版封面');
      }
    } catch (err: unknown) {
      setCoverSearchResults([]);
      setCoverSearchTotal(0);
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

  function openAirportProfilePicker(): void {
    setAirportPickerMode('profile');
    setAirportProfilePickerOpen(true);
    if (airportProfileResults.length === 0) {
      void searchAirportProfiles(1, airportProfileSearchQuery);
    }
  }

  function openAirportLinkPicker(): void {
    setAirportPickerMode('link');
    setAirportProfilePickerOpen(true);
    if (airportProfileResults.length === 0) {
      void searchAirportProfiles(1, airportProfileSearchQuery);
    }
  }

  async function searchAirportProfiles(targetPage = 1, queryOverride = airportProfileSearchQuery): Promise<void> {
    setAirportProfileSearchLoading(true);
    setAirportProfileSearchError('');
    try {
      const search = new URLSearchParams();
      search.set('page', String(targetPage));
      const query = queryOverride.trim();
      if (query) {
        search.set('q', query);
      }
      const result = await apiFetch<FullRankingPageResponse>(`/api/v1/pages/full-ranking?${search.toString()}`);
      setAirportProfileResults(result.items);
      setAirportProfileSearchPage(result.page);
      setAirportProfileSearchTotal(result.total);
      setAirportProfileTotalPages(result.total_pages);
      if (result.items.length === 0) {
        setAirportProfileSearchError('没有找到匹配的机场');
      }
    } catch (err: unknown) {
      setAirportProfileResults([]);
      setAirportProfileSearchTotal(0);
      setAirportProfileTotalPages(1);
      setAirportProfileSearchError(err instanceof Error ? err.message : '机场搜索失败');
    } finally {
      setAirportProfileSearchLoading(false);
    }
  }

  function insertAirportProfile(item: FullRankingItemResponse): void {
    const embed = buildAirportProfileEmbed(item);
    const block = serializeNewsAirportProfileEmbed(embed);
    setForm((current) => {
      const markdown = current.content_markdown;
      const target = markdownRef.current;
      if (!target) {
        return { ...current, content_markdown: `${markdown}${block}` };
      }
      const start = target.selectionStart || markdown.length;
      const end = target.selectionEnd || markdown.length;
      return {
        ...current,
        content_markdown: `${markdown.slice(0, start)}${block}${markdown.slice(end)}`,
      };
    });
    setNotice(`已插入「${item.name}」机场简介`);
    setError('');
    setAirportProfilePickerOpen(false);
  }

  function insertAirportLink(item: FullRankingItemResponse): void {
    const embed = buildAirportLinkEmbed(item);
    const block = serializeNewsAirportLinkEmbed(embed);
    setForm((current) => {
      const markdown = current.content_markdown;
      const target = markdownRef.current;
      if (!target) {
        return { ...current, content_markdown: `${markdown}${block}` };
      }
      const start = target.selectionStart || markdown.length;
      const end = target.selectionEnd || markdown.length;
      return {
        ...current,
        content_markdown: `${markdown.slice(0, start)}${block}${markdown.slice(end)}`,
      };
    });
    setNotice(`已插入「${item.name}」机场超链接`);
    setError('');
    setAirportProfilePickerOpen(false);
  }

  function removeAirportProfileBlock(start: number): void {
    setForm((current) => ({
      ...current,
      content_markdown: removeNewsAirportProfileEmbedAt(current.content_markdown, start),
    }));
    setNotice('机场简介块已删除');
    setError('');
  }

  function removeAirportLinkBlock(start: number): void {
    setForm((current) => ({
      ...current,
      content_markdown: removeNewsAirportLinkEmbedAt(current.content_markdown, start),
    }));
    setNotice('机场超链接已删除');
    setError('');
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
          {articleId && form.status === 'published' ? (
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

            <Field label="Slug">
              <input
                className={`w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400 ${
                  isSlugLocked ? 'cursor-not-allowed bg-neutral-50 text-neutral-500' : ''
                }`}
                value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                placeholder="ji-chang-bang-de-chuang-jian-si-lu"
                required
                readOnly={isSlugLocked}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
              <div className="mt-2 text-xs leading-5 text-neutral-500">
                {isSlugLocked
                  ? '文章发布后 slug 会锁定，避免已公开链接失效。'
                  : '用于文章链接，必填。请手动输入稳定的英文、数字或连字符 slug。'}
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

            <Field label="分类与专题">
              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <select
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
                  value={form.category_id ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({ ...current, category_id: value ? Number(value) : null }));
                  }}
                >
                  <option value="">不设置分类</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  {topics.map((item) => {
                    const checked = form.topic_ids.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                          checked ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={checked}
                          onChange={(event) => {
                            setForm((current) => ({
                              ...current,
                              topic_ids: event.target.checked
                                ? Array.from(new Set([...current.topic_ids, item.id]))
                                : current.topic_ids.filter((id) => id !== item.id),
                            }));
                          }}
                        />
                        {item.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            </Field>

            <Field label="首页推荐">
              <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-[1fr_1fr_160px]">
                <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(event) => setForm((current) => ({ ...current, is_featured: event.target.checked }))}
                  />
                  设为 News 主打文章
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={form.is_recommended}
                    onChange={(event) => setForm((current) => ({ ...current, is_recommended: event.target.checked }))}
                  />
                  进入热门文章
                </label>
                <input
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
                  type="number"
                  value={form.recommend_weight}
                  onChange={(event) => setForm((current) => ({ ...current, recommend_weight: Number(event.target.value || 0) }))}
                  placeholder="推荐权重"
                />
              </div>
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
                  onClick={openAirportLinkPicker}
                >
                  <Link2 size={14} />
                  插入机场超链接
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
                  onClick={openAirportProfilePicker}
                >
                  <Building2 size={14} />
                  插入机场简介
                </button>
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
              </div>
            )}
          >
            <textarea
              ref={markdownRef}
              className="min-h-[560px] w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm leading-7 outline-none focus:border-neutral-400"
              value={form.content_markdown}
              onChange={(event) => setForm((current) => ({ ...current, content_markdown: event.target.value }))}
              placeholder="# 标题&#10;&#10;使用 Markdown 写正文，支持图片、引用、列表和代码块。"
            />
            {airportLinkEmbeds.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">已插入机场超链接</div>
                <div className="grid gap-2">
                  {airportLinkEmbeds.map((match) => (
                    <div
                      key={`${match.start}-${match.end}`}
                      className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-900">
                          {match.embed?.name || '无法解析的机场超链接'}
                        </div>
                        <div className="mt-1 truncate text-xs text-neutral-500">
                          {match.embed ? match.embed.website || '暂无官网' : '请删除后重新插入'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        onClick={() => removeAirportLinkBlock(match.start)}
                      >
                        <Trash2 size={13} />
                        整体删除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {airportProfileEmbeds.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">已插入机场简介</div>
                <div className="grid gap-2">
                  {airportProfileEmbeds.map((match) => (
                    <div
                      key={`${match.start}-${match.end}`}
                      className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-900">
                          {match.embed?.name || '无法解析的机场简介块'}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {match.embed ? `Rank #${match.embed.rank} · ${formatScoreLabel(match.embed.score)} · ${match.embed.report_url || '暂无测评报告'}` : '请删除后重新插入'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        onClick={() => removeAirportProfileBlock(match.start)}
                      >
                        <Trash2 size={13} />
                        整体删除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Field>
        </div>
      </div>

      <CoverPickerModal
        open={coverPickerOpen}
        query={coverSearchQuery}
        page={coverSearchPage}
        perPage={coverSearchPerPage}
        total={coverSearchTotal}
        results={coverSearchResults}
        loading={coverSearchLoading}
        importingId={coverSearchImportingId}
        error={coverSearchError}
        onClose={() => setCoverPickerOpen(false)}
        onQueryChange={(value) => {
          setCoverSearchQuery(value);
          setCoverSearchPage(1);
        }}
        onSearch={(page) => void searchPexelsCovers(page)}
        onPageChange={(page) => void searchPexelsCovers(page)}
        onImport={(item) => void importPexelsCover(item)}
      />
      <AirportProfilePickerModal
        open={airportProfilePickerOpen}
        mode={airportPickerMode}
        query={airportProfileSearchQuery}
        page={airportProfileSearchPage}
        totalPages={airportProfileTotalPages}
        total={airportProfileSearchTotal}
        results={airportProfileResults}
        loading={airportProfileSearchLoading}
        error={airportProfileSearchError}
        onClose={() => setAirportProfilePickerOpen(false)}
        onQueryChange={(value) => {
          setAirportProfileSearchQuery(value);
          setAirportProfileSearchPage(1);
        }}
        onSearch={(page) => void searchAirportProfiles(page)}
        onPageChange={(page) => void searchAirportProfiles(page)}
        onInsert={airportPickerMode === 'link' ? insertAirportLink : insertAirportProfile}
      />
    </section>
  );
}

function CoverPickerModal({
  open,
  query,
  page,
  perPage,
  total,
  results,
  loading,
  importingId,
  error,
  onClose,
  onQueryChange,
  onSearch,
  onPageChange,
  onImport,
}: {
  open: boolean;
  query: string;
  page: number;
  perPage: number;
  total: number;
  results: PexelsCoverCandidate[];
  loading: boolean;
  importingId: number | null;
  error: string;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSearch: (page: number) => void;
  onPageChange: (page: number) => void;
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

  const totalPages = Math.max(1, Math.ceil(total / perPage));

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
            <p className="text-sm text-neutral-500">搜索 Pexels 图片并导入为本站封面，可在弹窗内继续翻页浏览更多结果。</p>
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
                        onSearch(1);
                      }
                    }}
                  />
                </div>
              </div>
              <button
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
                onClick={() => onSearch(1)}
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
            <section className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-neutral-500">共 {total} 张结果</div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={loading || page <= 1}
                    type="button"
                  >
                    上一页
                  </button>
                  <div className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-700">
                    {page} / {totalPages}
                  </div>
                  <button
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    disabled={loading || page >= totalPages}
                    type="button"
                  >
                    下一页
                  </button>
                </div>
              </div>
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

function AirportProfilePickerModal({
  open,
  mode,
  query,
  page,
  totalPages,
  total,
  results,
  loading,
  error,
  onClose,
  onQueryChange,
  onSearch,
  onPageChange,
  onInsert,
}: {
  open: boolean;
  mode: 'link' | 'profile';
  query: string;
  page: number;
  totalPages: number;
  total: number;
  results: FullRankingItemResponse[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSearch: (page: number) => void;
  onPageChange: (page: number) => void;
  onInsert: (item: FullRankingItemResponse) => void;
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
  const isLinkMode = mode === 'link';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-none border-0 bg-white shadow-none md:h-auto md:max-h-[88vh] md:max-w-5xl md:rounded-[28px] md:border md:border-neutral-200 md:shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 md:px-6 md:py-5">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight md:text-2xl">{isLinkMode ? '插入机场超链接' : '插入机场简介'}</h3>
            <p className="text-sm text-neutral-500">
              {isLinkMode
                ? '从全量榜单选择机场，插入后正文会显示机场名称，正式发布页点击名称会跳转官网并扣费。'
                : '从全量榜单选择机场，插入后会在文章页渲染为可索引的机场简介卡片。'}
            </p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:text-neutral-900"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6 md:py-6">
          <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">机场搜索</div>
                <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                  <Search size={15} className="text-neutral-400" />
                  <input
                    className="w-full bg-transparent text-sm outline-none"
                    placeholder="输入机场名、官网、标签或简介关键词"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onSearch(1);
                      }
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
                onClick={() => onSearch(1)}
                disabled={loading}
              >
                {loading ? '搜索中...' : '搜索机场'}
              </button>
            </div>
            {error ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {error}
              </div>
            ) : null}
          </section>

          {results.length > 0 ? (
            <section className="space-y-4">
              <div className="grid gap-3">
                {results.map((item) => (
                  <div key={`${item.airport_id}-${item.rank}`} className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-neutral-950 px-2.5 py-1 text-xs font-black text-white">#{item.rank}</span>
                          <div className="text-lg font-black tracking-tight text-neutral-900">{item.name}</div>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {formatAirportStatusLabel(item.status)}
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-neutral-600">
                          {item.airport_intro?.trim() || '该机场已进入正式榜单，当前公开页提供官网入口、标签、成立日期、价格与试用支持信息。'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                          <span>公开分数 {formatScoreLabel(item.score)}</span>
                          <span>月付 {formatCurrencyLabel(item.plan_price_month)}</span>
                          <span>{item.has_trial ? '支持试用' : '暂不支持试用'}</span>
                          {item.report_url ? <span>{item.report_url}</span> : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {[...item.tags, ...buildCapabilityLabels(item)].slice(0, 8).map((label) => (
                            <span key={label} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={() => onInsert(item)}
                        disabled={loading}
                      >
                        {isLinkMode ? '插入链接' : '插入'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-neutral-500">共 {total} 个机场</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={loading || page <= 1}
                  >
                    上一页
                  </button>
                  <div className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-700">
                    {page} / {Math.max(1, totalPages)}
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                    onClick={() => onPageChange(Math.min(Math.max(1, totalPages), page + 1))}
                    disabled={loading || page >= Math.max(1, totalPages)}
                  >
                    下一页
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center text-sm text-neutral-500">
              {loading ? '正在加载机场列表...' : '输入关键词搜索机场，或直接从默认榜单里选择。'}
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

function buildAirportProfileEmbed(item: FullRankingItemResponse): NewsAirportProfileEmbed {
  return {
    version: 1,
    airport_id: item.airport_id,
    rank: item.rank,
    name: item.name,
    status: item.status,
    website: item.website,
    report_url: item.report_url || null,
    airport_intro: item.airport_intro || null,
    founded_on: item.founded_on || null,
    plan_price_month: item.plan_price_month,
    has_trial: item.has_trial,
    created_at: item.created_at || null,
    score: item.score,
    score_date: item.score_date || null,
    score_delta_vs_yesterday: {
      label: item.score_delta_vs_yesterday.label,
      value: item.score_delta_vs_yesterday.value,
    },
    tags: item.tags,
    capability_labels: buildCapabilityLabels(item),
  };
}

function buildAirportLinkEmbed(item: FullRankingItemResponse): NewsAirportLinkEmbed {
  return {
    version: 1,
    airport_id: item.airport_id,
    name: item.name,
    website: item.website,
  };
}

function buildCapabilityLabels(item: FullRankingItemResponse): string[] {
  if (!item.capabilities) {
    return [];
  }
  return [
    ...item.capabilities.payment_methods.slice(0, 3).map((capability) => capability.label),
    ...item.capabilities.clients.slice(0, 3).map((capability) => capability.label),
    ...item.capabilities.import_methods.slice(0, 2).map((capability) => capability.label),
    ...item.capabilities.regions.slice(0, 4).map((region) => region.label),
    item.capabilities.plan.supports_annual ? '年付' : '',
    item.capabilities.plan.has_lifetime_plan ? '不限时套餐' : '',
    item.capabilities.telegram.has_group ? 'Telegram 群' : '',
  ].filter(Boolean);
}

function formatAirportStatusLabel(status: string): string {
  if (status === 'normal') return '正常';
  if (status === 'risk') return '观察';
  if (status === 'down') return '跑路';
  return status || '未知';
}

function formatScoreLabel(value: number | null): string {
  return value === null ? '未公开' : trimNumber(value);
}

function formatCurrencyLabel(value: number | null): string {
  return value === null ? '-' : `¥${trimNumber(value)}/月`;
}

function trimNumber(value: number): string {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
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
    credentials: 'include',
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
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const data = (await safeJson(response)) as { message?: string } | null;
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }

  return response.text();
}

function buildAuthHeaders(source?: HeadersInit): Headers {
  return new Headers(source || {});
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
