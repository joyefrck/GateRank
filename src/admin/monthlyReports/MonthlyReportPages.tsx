import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Archive,
  ExternalLink,
  FileText,
  Image,
  Plus,
  RefreshCw,
  Save,
  Search,
  Upload,
  X,
} from 'lucide-react';

type MonthlyReportStatus = 'draft' | 'published' | 'archived';

interface MonthlyReportListItem {
  id: number;
  year: number;
  month: number;
  slug: string;
  title: string;
  h1: string;
  excerpt: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  cover_image_url: string;
  og_image_url: string;
  og_image_alt: string;
  status: MonthlyReportStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MonthlyReport extends MonthlyReportListItem {
  content_markdown: string;
  content_html: string;
}

interface MonthlyReportForm {
  year: string;
  month: string;
  slug: string;
  title: string;
  h1: string;
  excerpt: string;
  content_markdown: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  cover_image_url: string;
  og_image_url: string;
  og_image_alt: string;
}

interface MonthlyReportPeriodOption {
  year: number;
  month: number;
  label: string;
  available: boolean;
  reason: string | null;
}

interface MonthlyReportPeriodOptionsView {
  years: Array<{
    year: number;
    months: MonthlyReportPeriodOption[];
  }>;
}

const PAGE_SIZE = 20;

export function MonthlyReportListPage({
  onCreate,
  onEdit,
}: {
  onCreate: (id: number) => void;
  onEdit: (id: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [items, setItems] = useState<MonthlyReportListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'' | MonthlyReportStatus>('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [periodOptions, setPeriodOptions] = useState<MonthlyReportPeriodOptionsView | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [createYear, setCreateYear] = useState('');
  const [createMonth, setCreateMonth] = useState('');
  const [createError, setCreateError] = useState('');

  const load = async (targetPage = page) => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      query.set('page', String(targetPage));
      query.set('page_size', String(PAGE_SIZE));
      if (keyword.trim()) query.set('keyword', keyword.trim());
      if (status) query.set('status', status);
      if (year) query.set('year', year);
      const data = await apiFetch<{ page: number; total: number; items: MonthlyReportListItem[] }>(`/api/v1/admin/monthly-reports?${query.toString()}`);
      setItems(data.items || []);
      setPage(data.page || targetPage);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载月度报告失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const yearOptions = Array.from({ length: 8 }, (_, index) => currentYear - index);
  const selectedYearGroup = periodOptions?.years.find((item) => String(item.year) === createYear) || null;
  const selectedMonthOption = selectedYearGroup?.months.find((item) => String(item.month) === createMonth) || null;
  const canGenerate = Boolean(selectedMonthOption?.available && !generating && !periodLoading);

  const openCreate = async () => {
    setCreateOpen(true);
    setPeriodLoading(true);
    setCreateError('');
    try {
      const data = await apiFetch<MonthlyReportPeriodOptionsView>('/api/v1/admin/monthly-reports/period-options');
      setPeriodOptions(data);
      const first = findFirstAvailablePeriod(data);
      if (first) {
        setCreateYear(String(first.year));
        setCreateMonth(String(first.month));
      } else {
        const latestYear = data.years[0];
        setCreateYear(latestYear ? String(latestYear.year) : '');
        setCreateMonth('');
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '加载可生成月份失败');
    } finally {
      setPeriodLoading(false);
    }
  };

  const closeCreate = () => {
    if (generating) return;
    setCreateOpen(false);
    setCreateError('');
  };

  const generateReport = async () => {
    if (!selectedMonthOption?.available) {
      setCreateError(selectedMonthOption?.reason || '请选择可生成的月份');
      return;
    }
    setGenerating(true);
    setCreateError('');
    try {
      const report = await apiFetch<MonthlyReport>('/api/v1/admin/monthly-reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          year: Number(createYear),
          month: Number(createMonth),
        }),
      });
      setCreateOpen(false);
      onCreate(report.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '生成月度报告失败');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">月度报告</h2>
          <p className="mt-1 text-sm text-neutral-500">管理每月全站 SEO 报告、公开正文、封面和 OG 图。</p>
        </div>
        <button type="button" className="rounded bg-neutral-900 px-3 py-2 text-sm text-white" onClick={() => void openCreate()}>
          <span className="inline-flex items-center gap-2"><Plus size={14} />新增报告</span>
        </button>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load(1);
        }}
      >
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-neutral-400" />
          <input
            className="w-72 max-w-full rounded border py-2 pl-7 pr-3 text-sm"
            placeholder="搜索标题 / slug / 摘要"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <select className="rounded border px-3 py-2 text-sm" value={year} onChange={(event) => setYear(event.target.value)}>
          <option value="">全部年份</option>
          {yearOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="rounded border px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value as '' | MonthlyReportStatus)}>
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </select>
        <button type="submit" className="rounded border px-3 py-2 text-sm">查询</button>
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => void load(page)} disabled={loading}>
          <span className="inline-flex items-center gap-2"><RefreshCw size={14} />刷新</span>
        </button>
      </form>

      {error && <div className="text-sm text-rose-600">{error}</div>}

      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className="w-full min-w-[1100px] table-fixed text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="w-[11%] px-4 py-3 text-left">年月</th>
              <th className="w-[28%] px-4 py-3 text-left">标题</th>
              <th className="w-[20%] px-4 py-3 text-left">Slug</th>
              <th className="w-[10%] px-4 py-3 text-left">状态</th>
              <th className="w-[14%] px-4 py-3 text-left">发布时间</th>
              <th className="w-[17%] px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={6}>加载中...</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={6}>暂无月度报告</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-100 align-top">
                <td className="px-4 py-3 font-mono">{formatMonth(item.year, item.month)}</td>
                <td className="px-4 py-3">
                  <button className="text-left font-medium underline" onClick={() => onEdit(item.id)}>{item.title || '-'}</button>
                  <div className="mt-1 line-clamp-2 text-xs text-neutral-500">{item.excerpt || item.seo_description || '-'}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-600">{item.slug}</td>
                <td className="px-4 py-3">{formatStatus(item.status)}</td>
                <td className="px-4 py-3 text-neutral-600">{formatDateTime(item.published_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button className="underline" onClick={() => onEdit(item.id)}>编辑</button>
                    {item.status === 'published' && (
                      <a className="inline-flex items-center gap-1 underline" href={`/monthly-reports/${item.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} />公开页
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <div>共 {total} 篇，当前第 {page} / {totalPages} 页</div>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>上一页</button>
          <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={page >= totalPages || loading} onClick={() => void load(page + 1)}>下一页</button>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold">生成月度报告</h3>
                <p className="mt-1 text-sm text-neutral-500">选择已经结束且尚未生成报告的月份。</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 disabled:opacity-40"
                onClick={closeCreate}
                disabled={generating}
                aria-label="关闭生成月度报告弹窗"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="年份">
                  <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={createYear}
                    disabled={periodLoading || generating}
                    onChange={(event) => {
                      const nextYear = event.target.value;
                      const group = periodOptions?.years.find((item) => String(item.year) === nextYear);
                      const first = group?.months.find((item) => item.available);
                      setCreateYear(nextYear);
                      setCreateMonth(first ? String(first.month) : '');
                      setCreateError('');
                    }}
                  >
                    {(periodOptions?.years || []).map((group) => (
                      <option key={group.year} value={group.year}>{group.year}</option>
                    ))}
                  </select>
                </Field>
                <Field label="月份">
                  <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={createMonth}
                    disabled={periodLoading || generating || !selectedYearGroup}
                    onChange={(event) => {
                      setCreateMonth(event.target.value);
                      setCreateError('');
                    }}
                  >
                    <option value="">请选择月份</option>
                    {(selectedYearGroup?.months || []).map((option) => (
                      <option key={option.month} value={option.month} disabled={!option.available}>
                        {option.label}{option.available ? '' : ` - ${option.reason}`}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {selectedMonthOption && !selectedMonthOption.available ? (
                <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {selectedMonthOption.reason}
                </div>
              ) : null}
              {createError && <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{createError}</div>}
              {periodLoading ? <div className="text-sm text-neutral-500">加载可生成月份...</div> : null}
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-50" onClick={closeCreate} disabled={generating}>取消</button>
                <button
                  type="button"
                  className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                  onClick={() => void generateReport()}
                  disabled={!canGenerate}
                >
                  {generating ? '生成中...' : '确认生成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MonthlyReportEditorPage({
  reportId,
  onBack,
  onNavigateToReport,
}: {
  reportId?: number;
  onBack: () => void;
  onNavigateToReport: (id: number) => void;
}) {
  const defaults = useMemo(() => buildDefaultForm(), []);
  const [form, setForm] = useState<MonthlyReportForm>(defaults);
  const [status, setStatus] = useState<MonthlyReportStatus>('draft');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(reportId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'markdown' | 'cover' | 'og' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!reportId) {
      setForm(defaults);
      setStatus('draft');
      setPublishedAt(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    apiFetch<MonthlyReport>(`/api/v1/admin/monthly-reports/${reportId}`)
      .then((report) => {
        if (cancelled) return;
        setForm(toForm(report));
        setStatus(report.status);
        setPublishedAt(report.published_at);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载报告失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const publicHref = form.slug ? `/monthly-reports/${form.slug}` : '';

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = buildPayload(form);
      const report = reportId
        ? await apiFetch<MonthlyReport>(`/api/v1/admin/monthly-reports/${reportId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await apiFetch<MonthlyReport>('/api/v1/admin/monthly-reports', { method: 'POST', body: JSON.stringify(payload) });
      setMessage('已保存');
      if (!reportId) {
        onNavigateToReport(report.id);
      } else {
        setForm(toForm(report));
        setStatus(report.status);
        setPublishedAt(report.published_at);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!window.confirm('确认发布这篇月度报告？发布后会进入公开页和 sitemap。')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const report = await apiFetch<MonthlyReport>(`/api/v1/admin/monthly-reports/${reportId}/publish`, {
        method: 'POST',
        body: JSON.stringify(buildPayload(form)),
      });
      setForm(toForm(report));
      setStatus(report.status);
      setPublishedAt(report.published_at);
      setMessage('已发布');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!window.confirm('确认归档这篇月度报告？归档后公开页会变为不可访问，并从 sitemap 移除。')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const report = await apiFetch<MonthlyReport>(`/api/v1/admin/monthly-reports/${reportId}/archive`, { method: 'POST' });
      setStatus(report.status);
      setPublishedAt(report.published_at);
      setMessage('已归档');
    } catch (err) {
      setError(err instanceof Error ? err.message : '归档失败');
    } finally {
      setSaving(false);
    }
  };

  const uploadMarkdown = async (file: File) => {
    setUploading('markdown');
    setError('');
    setMessage('');
    try {
      const data = await uploadFile<{ content_markdown: string; excerpt: string }>('/api/v1/admin/monthly-reports/upload-markdown', file);
      setForm((current) => ({
        ...current,
        content_markdown: data.content_markdown,
        excerpt: current.excerpt || data.excerpt,
      }));
      setMessage('Markdown 已上传');
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传 Markdown 失败');
    } finally {
      setUploading(null);
    }
  };

  const uploadImage = async (target: 'cover' | 'og', file: File) => {
    setUploading(target);
    setError('');
    setMessage('');
    try {
      const data = await uploadFile<{ url: string }>('/api/v1/admin/monthly-reports/upload-image', file, {
        context_slug: form.slug,
        mode: 'cover',
      });
      setForm((current) => target === 'cover'
        ? { ...current, cover_image_url: data.url }
        : { ...current, og_image_url: data.url, og_image_alt: current.og_image_alt || current.title });
      setMessage(target === 'cover' ? '封面图已上传' : 'OG 图已上传');
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传图片失败');
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return <div className="text-sm text-neutral-500">加载中...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="inline-flex items-center gap-2 text-sm underline" onClick={onBack}>
          <ArrowLeft size={14} />返回月度报告
        </button>
        <div className="flex flex-wrap gap-2">
          {reportId && (
            <a className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm" href={`/api/v1/admin/monthly-reports/${reportId}/preview`} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />预览
            </a>
          )}
          {status === 'published' && publicHref && (
            <a className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm" href={publicHref} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />公开页
            </a>
          )}
          <button type="button" className="inline-flex items-center gap-2 rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => void save()} disabled={saving}>
            <Save size={14} />保存
          </button>
          {reportId && status !== 'published' && (
            <button type="button" className="inline-flex items-center gap-2 rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => void publish()} disabled={saving}>
              <FileText size={14} />发布
            </button>
          )}
          {reportId && status !== 'archived' && (
            <button type="button" className="inline-flex items-center gap-2 rounded border border-rose-200 px-3 py-2 text-sm text-rose-700 disabled:opacity-50" onClick={() => void archive()} disabled={saving}>
              <Archive size={14} />归档
            </button>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold">{reportId ? '编辑月度报告' : '新增月度报告'}</h2>
        <p className="mt-1 text-sm text-neutral-500">状态：{formatStatus(status)}{publishedAt ? ` · 发布时间：${formatDateTime(publishedAt)}` : ''}</p>
      </div>

      {error && <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <section className="rounded-xl border border-neutral-200 p-4">
        <h3 className="font-bold">基础信息</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="年份">
            <input className="w-full rounded border bg-neutral-50 px-3 py-2 text-sm text-neutral-600" value={form.year} readOnly />
          </Field>
          <Field label="月份">
            <input className="w-full rounded border bg-neutral-50 px-3 py-2 text-sm text-neutral-600" value={form.month} readOnly />
          </Field>
          <Field label="标题">
            <input className="w-full rounded border px-3 py-2 text-sm" value={form.title} onChange={(event) => {
              const title = event.target.value;
              setForm((current) => ({ ...current, title, h1: current.h1 || title, og_image_alt: current.og_image_alt || title }));
            }} />
          </Field>
          <Field label="Slug">
            <input className="w-full rounded border px-3 py-2 font-mono text-sm" value={form.slug} onChange={(event) => updateForm(setForm, 'slug', event.target.value)} />
          </Field>
          <Field label="H1">
            <input className="w-full rounded border px-3 py-2 text-sm" value={form.h1} onChange={(event) => updateForm(setForm, 'h1', event.target.value)} />
          </Field>
          <Field label="摘要">
            <textarea className="min-h-24 w-full rounded border px-3 py-2 text-sm" value={form.excerpt} onChange={(event) => updateForm(setForm, 'excerpt', event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-4">
        <h3 className="font-bold">SEO 配置</h3>
        <div className="mt-4 grid gap-4">
          <Field label="SEO Title">
            <input className="w-full rounded border px-3 py-2 text-sm" value={form.seo_title} onChange={(event) => updateForm(setForm, 'seo_title', event.target.value)} />
          </Field>
          <Field label="SEO Description">
            <textarea className="min-h-24 w-full rounded border px-3 py-2 text-sm" value={form.seo_description} onChange={(event) => updateForm(setForm, 'seo_description', event.target.value)} />
          </Field>
          <Field label="SEO Keywords">
            <input className="w-full rounded border px-3 py-2 text-sm" value={form.seo_keywords} onChange={(event) => updateForm(setForm, 'seo_keywords', event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-4">
        <h3 className="font-bold">封面与 OG 图</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ImageUploadField
            label="封面图"
            value={form.cover_image_url}
            uploading={uploading === 'cover'}
            onChange={(value) => updateForm(setForm, 'cover_image_url', value)}
            onUpload={(file) => void uploadImage('cover', file)}
          />
          <ImageUploadField
            label="OG 图"
            value={form.og_image_url}
            uploading={uploading === 'og'}
            onChange={(value) => updateForm(setForm, 'og_image_url', value)}
            onUpload={(file) => void uploadImage('og', file)}
          />
          <Field label="OG Alt">
            <input className="w-full rounded border px-3 py-2 text-sm" value={form.og_image_alt} onChange={(event) => updateForm(setForm, 'og_image_alt', event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold">Markdown 正文</h3>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm">
            <Upload size={14} />
            {uploading === 'markdown' ? '上传中...' : '上传 Markdown'}
            <input className="hidden" type="file" accept=".md,.markdown,text/markdown,text/plain" disabled={uploading === 'markdown'} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadMarkdown(file);
              event.currentTarget.value = '';
            }} />
          </label>
        </div>
        <textarea
          className="mt-4 min-h-[520px] w-full rounded border px-3 py-2 font-mono text-sm"
          value={form.content_markdown}
          onChange={(event) => updateForm(setForm, 'content_markdown', event.target.value)}
          placeholder="# 2026年6月机场 VPN 月度报告..."
        />
      </section>
    </div>
  );
}

function findFirstAvailablePeriod(view: MonthlyReportPeriodOptionsView): MonthlyReportPeriodOption | null {
  for (const group of view.years) {
    const option = group.months.find((item) => item.available);
    if (option) return option;
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function ImageUploadField({
  label,
  value,
  uploading,
  onChange,
  onUpload,
}: {
  label: string;
  value: string;
  uploading: boolean;
  onChange: (value: string) => void;
  onUpload: (file: File) => void;
}) {
  return (
    <Field label={label}>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input className="min-w-0 flex-1 rounded border px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm">
            <Image size={14} />
            {uploading ? '上传中' : '上传'}
            <input className="hidden" type="file" accept="image/*" disabled={uploading} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = '';
            }} />
          </label>
        </div>
        {value ? <img className="h-36 w-full rounded border object-cover" src={value} alt={label} /> : null}
      </div>
    </Field>
  );
}

function buildDefaultForm(): MonthlyReportForm {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  return {
    year: String(year),
    month: String(month),
    slug: `${year}-${String(month).padStart(2, '0')}-airport-vpn-ranking-report`,
    title: `${year}年${month}月机场 VPN 月度报告`,
    h1: `${year}年${month}月机场 VPN 月度报告`,
    excerpt: '',
    content_markdown: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '机场VPN月度报告,机场推荐,机场排名,机场VPN排名,科学上网机场,跑路机场,GateRank',
    cover_image_url: '',
    og_image_url: '',
    og_image_alt: '',
  };
}

function toForm(report: MonthlyReport): MonthlyReportForm {
  return {
    year: String(report.year),
    month: String(report.month),
    slug: report.slug,
    title: report.title,
    h1: report.h1,
    excerpt: report.excerpt,
    content_markdown: report.content_markdown,
    seo_title: report.seo_title,
    seo_description: report.seo_description,
    seo_keywords: report.seo_keywords,
    cover_image_url: report.cover_image_url,
    og_image_url: report.og_image_url,
    og_image_alt: report.og_image_alt,
  };
}

function buildPayload(form: MonthlyReportForm) {
  return {
    year: Number(form.year),
    month: Number(form.month),
    slug: form.slug.trim(),
    title: form.title.trim(),
    h1: form.h1.trim(),
    excerpt: form.excerpt.trim(),
    content_markdown: form.content_markdown,
    seo_title: form.seo_title.trim(),
    seo_description: form.seo_description.trim(),
    seo_keywords: form.seo_keywords.trim(),
    cover_image_url: form.cover_image_url.trim(),
    og_image_url: form.og_image_url.trim(),
    og_image_alt: form.og_image_alt.trim(),
  };
}

function updateForm(
  setForm: React.Dispatch<React.SetStateAction<MonthlyReportForm>>,
  key: keyof MonthlyReportForm,
  value: string,
) {
  setForm((current) => ({ ...current, [key]: value }));
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${getApiBase()}${path}`, { ...init, credentials: 'include', headers });
  if (response.status === 401) {
    if (window.location.pathname !== '/admin/login') {
      window.history.pushState({}, '', '/admin/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    throw new Error('登录已过期，请重新登录');
  }
  if (!response.ok) {
    const data = await safeJson(response) as { message?: string } | null;
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }
  return await safeJson(response) as T;
}

async function uploadFile<T>(path: string, file: File, fields: Record<string, string> = {}): Promise<T> {
  const body = new FormData();
  body.append('file', file);
  Object.entries(fields).forEach(([key, value]) => body.append(key, value));
  const response = await fetch(`${getApiBase()}${path}`, { method: 'POST', credentials: 'include', body });
  if (response.status === 401) {
    window.history.pushState({}, '', '/admin/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
    throw new Error('登录已过期，请重新登录');
  }
  if (!response.ok) {
    const data = await safeJson(response) as { message?: string } | null;
    throw new Error(data?.message || `上传失败: ${response.status}`);
  }
  return await safeJson(response) as T;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getApiBase(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.VITE_API_BASE || '';
}

function formatMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatStatus(status: MonthlyReportStatus): string {
  if (status === 'published') return '已发布';
  if (status === 'archived') return '已归档';
  return '草稿';
}

function formatDateTime(value: string | null): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '-';
}
