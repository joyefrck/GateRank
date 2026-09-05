import React, { useEffect, useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import {
  EMPTY_SEO_TOPIC,
  type SeoTopic,
  type SeoTopicInput,
} from "../../../shared/seoTopics";
import { insertSeoTopicImageMarkdown } from "../../../shared/seoTopicMarkdown";

type Airport = { airport_id: number; name: string };
const apiBase = (
  (import.meta as ImportMeta & { env?: Record<string, string> }).env
    ?.VITE_API_BASE || ""
).replace(/\/$/, "");
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${apiBase}/api/v1/admin/topics${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message || data.error?.message || "请求失败");
  return data as T;
}
const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-indigo-500";
const buttonClass =
  "min-h-10 rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-40";
const statusLabels = { draft: "草稿", published: "已发布", archived: "已下线" };
export function TopicPages({
  path,
  navigate,
}: {
  path: string;
  navigate: (path: string) => void;
}) {
  const id = /^\/admin\/topics\/(\d+)$/.exec(path)?.[1];
  const editing = Boolean(id) || path === "/admin/topics/new";
  const [items, setItems] = useState<SeoTopic[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<SeoTopicInput>({ ...EMPTY_SEO_TOPIC });
  const [saved, setSaved] = useState("");
  const [airports, setAirports] = useState<Airport[]>([]);
  const [airportQuery, setAirportQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unavailable, setUnavailable] = useState<number[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dirty = editing && saved !== "" && JSON.stringify(form) !== saved;
  const patch = <K extends keyof SeoTopicInput>(
    key: K,
    value: SeoTopicInput[K],
  ) => setForm((old) => ({ ...old, [key]: value }));
  const refresh = () =>
    api<{ items: SeoTopic[] }>("").then((data) => setItems(data.items));
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [path]);
  useEffect(() => {
    let active = true;
    setError("");
    setNotice("");
    setUnavailable([]);
    setLoading(Boolean(id));
    if (!id) {
      const blank = { ...EMPTY_SEO_TOPIC, airports: [], related_ids: [] };
      setForm(blank);
      setSaved(JSON.stringify(blank));
      return;
    }
    void api<SeoTopic & { unavailable_ids: number[] }>(`/${id}`)
      .then((data) => {
        if (active) {
          const {
            id: _id,
            updated_at: _date,
            unavailable_ids,
            ...value
          } = data;
          setForm(value);
          setSaved(JSON.stringify(value));
          setUnavailable(unavailable_ids || []);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, path]);
  useEffect(() => {
    if (editing)
      void api<{ items: Airport[] }>("/airports")
        .then((data) => setAirports(data.items))
        .catch((e) => setError(e.message));
  }, [editing]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function insert(text: string) {
    const area = textRef.current;
    const start = area?.selectionStart ?? form.content_markdown.length;
    const end = area?.selectionEnd ?? start;
    patch(
      "content_markdown",
      form.content_markdown.slice(0, start) +
        text +
        form.content_markdown.slice(end),
    );
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(start + text.length, start + text.length);
    });
  }
  async function uploadBodyImage(file: File) {
    setImageUploading(true);
    setError("");
    setNotice("");
    try {
      const data = new FormData();
      data.set("file", file);
      const result = await api<{ url: string }>("/upload-image", {
        method: "POST",
        body: data,
      });
      const area = textRef.current;
      const selectionStart =
        area?.selectionStart ?? form.content_markdown.length;
      const selectionEnd = area?.selectionEnd ?? selectionStart;
      let nextCursor = selectionStart;
      setForm((current) => {
        const inserted = insertSeoTopicImageMarkdown({
          markdown: current.content_markdown,
          start: selectionStart,
          end: selectionEnd,
          url: result.url,
          alt: file.name.replace(/\.[^.]+$/, ""),
        });
        nextCursor = inserted.cursor;
        return { ...current, content_markdown: inserted.markdown };
      });
      requestAnimationFrame(() => {
        area?.focus();
        area?.setSelectionRange(nextCursor, nextCursor);
      });
      setNotice("正文图片已上传并插入");
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片上传失败");
    } finally {
      setImageUploading(false);
    }
  }
  async function save(nextStatus = form.status) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<SeoTopic>(id ? `/${id}` : "", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({ ...form, status: nextStatus }),
      });
      const { id: newId, updated_at, ...value } = result;
      setForm(value);
      setSaved(JSON.stringify(value));
      setNotice("已保存");
      if (!id) navigate(`/admin/topics/${newId}`);
      else {
        const detail = await api<SeoTopic & { unavailable_ids: number[] }>(
          `/${id}`,
        );
        setUnavailable(detail.unavailable_ids || []);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, direction: number) {
    const list = [...form.airports];
    [list[index], list[index + direction]] = [
      list[index + direction],
      list[index],
    ];
    patch("airports", list);
  }
  const visible = items.filter(
    (t) =>
      (!status || t.status === status) &&
      (!q || `${t.name} ${t.path}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {editing ? (id ? "编辑专题" : "新建专题") : "专题管理"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            独立专题 · 人工推荐 · 搜索引擎入口
          </p>
        </div>
        {editing ? (
          <button
            className={buttonClass}
            onClick={() => {
              if (!dirty || window.confirm("有未保存的修改，确定返回吗？"))
                navigate("/admin/topics");
            }}
          >
            返回列表
          </button>
        ) : (
          <button
            className="min-h-10 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white"
            onClick={() => navigate("/admin/topics/new")}
          >
            新建专题
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-green-700">
          {notice}
        </p>
      )}
      {!editing ? (
        <>
          <div className="flex flex-wrap gap-3">
            <input
              aria-label="搜索专题"
              className={inputClass + " max-w-md"}
              placeholder="搜索名称或 URL"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              aria-label="发布状态筛选"
              className={inputClass + " max-w-40"}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">全部状态</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="divide-y divide-neutral-200">
            {visible.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <h2 className="font-semibold">{t.name}</h2>
                  <p className="break-all text-sm text-neutral-500">
                    {t.path} · {statusLabels[t.status]} · 顺序 {t.sort_order}
                  </p>
                </div>
                <button
                  className={buttonClass}
                  onClick={() => navigate(`/admin/topics/${t.id}`)}
                >
                  编辑
                </button>
              </div>
            ))}
            {!visible.length && (
              <p className="py-8 text-neutral-500">暂无专题</p>
            )}
          </div>
        </>
      ) : loading ? (
        <p>正在加载专题…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <span className="mr-auto text-sm">
              {statusLabels[form.status]} ·{" "}
              {dirty ? "有未保存的修改" : "已保存"}
            </span>
            <button
              disabled={busy || loading}
              className="min-h-10 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
              onClick={() => void save()}
            >
              {busy ? "保存中…" : "保存内容"}
            </button>
            {form.status !== "published" ? (
              <button
                disabled={busy}
                className={buttonClass}
                onClick={() => void save("published")}
              >
                发布
              </button>
            ) : (
              <button
                disabled={busy}
                className={buttonClass}
                onClick={() => void save("archived")}
              >
                下线
              </button>
            )}
            {id && (
              <a
                className={buttonClass}
                target="_blank"
                rel="noreferrer"
                href={`${apiBase}/api/v1/admin/topics/${id}/preview`}
              >
                预览已保存页面 ↗
              </a>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                "name",
                "h1",
                "path",
                "summary",
                "cover_image",
                "seo_title",
                "seo_description",
                "seo_keywords",
                "share_image",
              ] as const
            ).map((key) => (
              <label
                key={key}
                className={
                  key === "summary" || key === "seo_description"
                    ? "lg:col-span-2"
                    : ""
                }
              >
                <span className="mb-1 block text-sm font-medium">
                  {
                    {
                      name: "专题名称",
                      h1: "页面 H1",
                      path: "站内 URL",
                      summary: "摘要",
                      cover_image: "封面图片 URL",
                      seo_title: "SEO Title",
                      seo_description: "SEO Description",
                      seo_keywords: "SEO Keywords",
                      share_image: "分享图片 URL",
                    }[key]
                  }
                </span>
                {key === "summary" || key === "seo_description" ? (
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={form[key]}
                    onChange={(e) => patch(key, e.target.value)}
                  />
                ) : (
                  <input
                    className={inputClass}
                    value={form[key]}
                    onChange={(e) => patch(key, e.target.value)}
                  />
                )}
              </label>
            ))}
            <label>
              <span className="mb-1 block text-sm">页面模板</span>
              <select
                className={inputClass}
                value={form.template}
                onChange={(e) =>
                  patch("template", e.target.value as SeoTopicInput["template"])
                }
              >
                <option value="topic">普通专题</option>
                <option value="hub">综合入口</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm">展示顺序（较小优先）</span>
              <input
                type="number"
                className={inputClass}
                value={form.sort_order}
                onChange={(e) => patch("sort_order", Number(e.target.value))}
              />
            </label>
          </div>
          <section className="space-y-3">
            <h2 className="text-lg font-bold">推荐机场</h2>
            <p className="text-sm text-neutral-500">
              手动调整编辑推荐顺序；价格和评分从公开数据读取。
            </p>
            {unavailable.length > 0 && (
              <p
                role="status"
                className="rounded-lg bg-amber-50 p-3 text-amber-800"
              >
                以下机场当前不可公开，将不在公开页面展示：
                {unavailable.join("、")}
              </p>
            )}
            {form.airports.map((a, index) => (
              <div
                key={a.airport_id}
                className="rounded-xl border border-neutral-200 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <strong className="mr-auto">
                    {index + 1}.{" "}
                    {airports.find((item) => item.airport_id === a.airport_id)
                      ?.name || `机场 #${a.airport_id}（当前不可公开）`}
                  </strong>
                  <button
                    aria-label={`上移机场 ${a.airport_id}`}
                    className={buttonClass}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    上移
                  </button>
                  <button
                    aria-label={`下移机场 ${a.airport_id}`}
                    className={buttonClass}
                    disabled={index === form.airports.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    下移
                  </button>
                  <button
                    className={buttonClass}
                    onClick={() =>
                      patch(
                        "airports",
                        form.airports.filter((_, i) => i !== index),
                      )
                    }
                  >
                    移除
                  </button>
                </div>
                <textarea
                  aria-label={`${a.airport_id} 推荐理由`}
                  className={inputClass}
                  placeholder="本专题的推荐理由"
                  value={a.reason}
                  onChange={(e) =>
                    patch(
                      "airports",
                      form.airports.map((item, i) =>
                        i === index
                          ? { ...item, reason: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <input
              aria-label="搜索机场"
              className={inputClass}
              placeholder="搜索机场名称或 ID"
              value={airportQuery}
              onChange={(e) => setAirportQuery(e.target.value)}
            />
            <div className="max-h-60 overflow-y-auto rounded-lg border border-neutral-200">
              {airports
                .filter(
                  (a) =>
                    !form.airports.some(
                      (item) => item.airport_id === a.airport_id,
                    ) &&
                    `${a.name} ${a.airport_id}`
                      .toLowerCase()
                      .includes(airportQuery.toLowerCase()),
                )
                .map((a) => (
                  <button
                    key={a.airport_id}
                    className="flex min-h-10 w-full justify-between border-b border-neutral-100 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    onClick={() =>
                      patch("airports", [
                        ...form.airports,
                        { airport_id: a.airport_id, reason: "" },
                      ])
                    }
                  >
                    {a.name}
                    <span>添加 +</span>
                  </button>
                ))}
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold">专题正文</h2>
            <div className="flex flex-wrap gap-2">
              <button
                className={buttonClass}
                onClick={() => insert("\n## 小标题\n")}
              >
                标题
              </button>
              <button
                className={buttonClass}
                onClick={() => insert("[链接文字](https://example.com)")}
              >
                链接
              </button>
              <button
                type="button"
                className={`${buttonClass} inline-flex items-center gap-2`}
                disabled={imageUploading || busy}
                onClick={() => imageInputRef.current?.click()}
              >
                <ImageUp size={16} aria-hidden="true" />
                {imageUploading ? "上传中…" : "上传图片"}
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="hidden"
                disabled={imageUploading || busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadBodyImage(file);
                  event.target.value = "";
                }}
              />
              <button
                className={buttonClass}
                onClick={() =>
                  insert("\n| 项目 | 说明 |\n| --- | --- |\n| 内容 | 内容 |\n")
                }
              >
                表格
              </button>
            </div>
            <textarea
              ref={textRef}
              aria-label="Markdown 正文"
              className={`${inputClass} min-h-[680px] resize-y font-mono lg:min-h-[760px]`}
              value={form.content_markdown}
              onChange={(e) => patch("content_markdown", e.target.value)}
            />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold">相关专题</h2>
            <p className="text-sm text-neutral-500">
              按选择顺序展示，只有已发布专题会出现在公开页面。
            </p>
            {items
              .filter((t) => String(t.id) !== id)
              .map((t) => (
                <label
                  key={t.id}
                  className="flex min-h-10 items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.related_ids.includes(t.id)}
                    onChange={(e) =>
                      patch(
                        "related_ids",
                        e.target.checked
                          ? [...form.related_ids, t.id]
                          : form.related_ids.filter((n) => n !== t.id),
                      )
                    }
                  />
                  {t.name} · {statusLabels[t.status]}
                </label>
              ))}
          </section>
        </>
      )}
    </section>
  );
}
