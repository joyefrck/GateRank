import {
  PUBLIC_TOP_NAV_STYLES,
  renderPublicTopNav,
} from "../../../shared/publicTopNav";
import type { TopicView } from "./topicService";
export const topicEscape = (value: unknown): string =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function renderTopicPage(
  view: TopicView,
  origin: string,
  preview = false,
): string {
  const { topic: t } = view;
  const e = topicEscape;
  const canonical = origin + t.path;
  const image =
    t.share_image || t.cover_image || "/og/home-2026-airport-ranking.png";
  const imageUrl = new URL(image, origin).href;
  const links = (items: TopicView["related"]) =>
    items
      .map(
        (item) =>
          `<li><a href="${e(item.path)}">${e(item.h1)}</a><p>${e(item.summary)}</p></li>`,
      )
      .join("");
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: t.h1,
      description: t.summary,
      url: canonical,
      dateModified: t.updated_at,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "首页", item: origin + "/" },
        ...(view.hub && view.hub.id !== t.id
          ? [{ name: "机场推荐", item: origin + view.hub.path }]
          : []),
        { name: t.h1, item: canonical },
      ].map((item, i) => ({ "@type": "ListItem", position: i + 1, ...item })),
    },
    ...(view.airports.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "编辑推荐顺序",
            itemListElement: view.airports.map((item, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: item.name,
              url: new URL(item.report_url!, origin).href,
            })),
          },
        ]
      : []),
  ];
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(t.seo_title || t.name)}</title>
<meta name="description" content="${e(t.seo_description || t.summary)}"><meta name="keywords" content="${e(t.seo_keywords)}"><meta name="robots" content="${preview ? "noindex,nofollow" : "index,follow,max-image-preview:large"}"><link rel="canonical" href="${e(canonical)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="GateRank"><meta property="og:title" content="${e(t.seo_title || t.name)}"><meta property="og:description" content="${e(t.seo_description || t.summary)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:image" content="${e(imageUrl)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${e(imageUrl)}">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script><style>${PUBLIC_TOP_NAV_STYLES}
*{box-sizing:border-box}body{margin:0;background:#fafafa;color:#171717;font-family:Inter,ui-sans-serif,system-ui,sans-serif}a{color:inherit;text-underline-offset:4px}a:focus-visible{outline:2px solid #4f46e5;outline-offset:4px}main{max-width:1080px;margin:auto;padding:44px 24px}h1{font-size:clamp(28px,4vw,44px);line-height:1.2;letter-spacing:-1px;margin:22px 0}h2{font-size:26px;margin:36px 0 18px}h3{font-size:20px}p{line-height:1.85;color:#525252}.lead{font-size:18px;max-width:800px}.crumb{font-size:14px;color:#737373}.cover{width:100%;max-height:360px;object-fit:cover;border-radius:20px;margin-top:20px}.recommendations{padding:0;list-style:none}.airport{padding:24px 0;border-bottom:1px solid #e5e5e5}.airport-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.airport h3{margin:0}.metrics{display:flex;gap:18px;flex-wrap:wrap;font-size:14px;color:#525252}.report{display:inline-flex;min-height:40px;align-items:center;padding:8px 16px;border-radius:10px;background:#171717;color:white;text-decoration:none}.directory{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.directory li{padding:24px;background:#fff;border:1px solid #e5e5e5;border-radius:20px}.directory a{font-size:20px;font-weight:700;display:inline-block;min-height:40px}.topic-body{background:white;border:1px solid #e5e5e5;border-radius:20px;padding:32px;margin-top:32px;overflow-wrap:anywhere}.topic-body img{display:block;width:min(100%,840px);height:auto;margin:24px auto;border-radius:14px}.topic-body table{display:block;overflow:auto;border-collapse:collapse}.topic-body td,.topic-body th{padding:10px;border:1px solid #ddd}.topic-body pre{overflow:auto;background:#f5f5f5;padding:16px}.topic-body li{line-height:1.9}.topic-footer{padding:32px 24px;text-align:center;border-top:1px solid #e5e5e5}.topic-footer a{display:inline-block;padding:12px}.preview{padding:12px;background:#fffbeb;color:#92400e;text-align:center}.empty{padding:24px;border:1px dashed #d4d4d4;border-radius:16px}@media(max-width:640px){main{padding:24px 16px}.directory{grid-template-columns:1fr}.topic-body{padding:20px}.airport{padding:20px 0}}</style></head><body>
${renderPublicTopNav(null)}${preview ? '<div class="preview">管理员预览 · 尚未公开的内容仅在此处可见</div>' : ""}<main>
<nav class="crumb" aria-label="面包屑"><a href="/">首页</a>${view.hub && view.hub.id !== t.id ? ` / <a href="${e(view.hub.path)}">机场推荐</a>` : ""} / ${e(t.name)}</nav>
<header><h1>${e(t.h1)}</h1><p class="lead">${e(t.summary)}</p>${t.cover_image ? `<img class="cover" src="${e(t.cover_image)}" alt="${e(t.h1)}">` : ""}</header>
${t.template === "topic" || view.airports.length ? `<section aria-label="编辑推荐"><h2>推荐机场</h2><p>按编辑推荐顺序展示；价格、评分和支持能力以当前公开数据为准。</p>${view.airports.length ? `<ol class="recommendations">${view.airports.map((a, i) => `<li class="airport"><div class="airport-head"><h3>${i + 1}. ${e(a.name)}</h3><a class="report" href="${e(a.report_url)}">查看测评 →</a></div><p>${e(a.reason)}</p><div class="metrics"><span>${a.plan_price_month > 0 ? `月付参考 ¥${e(a.plan_price_month)}` : "月付价格待确认"}</span><span>${a.score_hidden || a.score == null ? "评分暂不可见" : `评分 ${e(a.score)}`}</span></div><p>${e([...(a.capabilities?.clients || []), ...(a.capabilities?.streaming || [])].map((c) => c.label).join(" · "))}</p></li>`).join("")}</ol>` : '<p class="empty">推荐名单正在整理，可先阅读下方选购指南。</p>'}</section>` : ""}
${t.template === "hub" ? `<section><h2>按需求选择专题</h2>${view.directory.length ? `<ul class="directory">${links(view.directory)}</ul>` : "<p>更多专题正在整理中。</p>"}</section>` : ""}
<article class="topic-body">${view.html}</article>${view.related.length ? `<section><h2>相关专题</h2><ul class="directory">${links(view.related)}</ul></section>` : ""}
${preview && view.unavailable_ids.length ? `<p class="preview">以下机场当前不可公开，已从推荐列表排除：${view.unavailable_ids.join(", ")}</p>` : ""}</main><footer class="topic-footer"><strong>GateRank</strong><nav><a href="/">首页</a><a href="/rankings/all">机场排行</a>${view.hub ? `<a href="${e(view.hub.path)}">机场推荐</a>` : ""}<a href="/methodology">测评方法</a><a href="/risk-monitor">跑路监测</a></nav></footer></body></html>`;
}
