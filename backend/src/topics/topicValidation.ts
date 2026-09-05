import { EMPTY_SEO_TOPIC, type SeoTopicInput } from "../../../shared/seoTopics";
import { HttpError } from "../middleware/errorHandler";

export function normalizeTopicPath(value: string): string {
  const path = value.trim().toLowerCase().replace(/\/+$/, "");
  if (
    path.length > 240 ||
    !/^\/[a-z0-9]+(?:[a-z0-9/-]*[a-z0-9])?$/.test(path) ||
    path.includes("//")
  ) {
    throw new HttpError(
      400,
      "TOPIC_PATH_INVALID",
      "URL 必须是以 / 开头的英文小写站内路径，只能包含字母、数字、短横线和目录分隔符",
    );
  }
  // Existing route namespaces own every descendant, including presently unknown slugs.
  const reserved =
    /^(?:\/(?:api|admin|portal|news|airports|reports|report|monthly-reports|deals|tools|download|data|assets|og|uploads|health|healthz|auth|login|logout|risk-monitor|risk-watch|methodology|ranking-transparency|apply|for-ai|publish-token-docs|robots|sitemap)(?:\/|$)|\/rankings(?:$|\/all(?:\/|$)|\/[^/]+\/))/;
  if (reserved.test(path))
    throw new HttpError(
      409,
      "TOPIC_PATH_RESERVED",
      "此 URL 属于系统页面或保留目录，请使用其他路径",
    );
  return path;
}
export function parseTopicInput(body: unknown): SeoTopicInput {
  const source = body as Record<string, unknown>;
  if (!source || typeof source !== "object")
    throw new HttpError(400, "BAD_REQUEST", "专题内容不能为空");
  const result = { ...EMPTY_SEO_TOPIC };
  for (const field of [
    "name",
    "h1",
    "summary",
    "cover_image",
    "content_markdown",
    "seo_title",
    "seo_description",
    "seo_keywords",
    "share_image",
  ] as const) {
    if (typeof source[field] !== "string")
      throw new HttpError(400, "BAD_REQUEST", `${field} 必须是文本`);
    const limit =
      field === "content_markdown" ? 200000 : field === "summary" ? 5000 : 2000;
    if ((source[field] as string).length > limit)
      throw new HttpError(400, "BAD_REQUEST", `${field} 内容过长`);
    result[field] = (source[field] as string).trim();
  }
  result.path = normalizeTopicPath(String(source.path || ""));
  if (!result.name || !result.h1)
    throw new HttpError(400, "BAD_REQUEST", "名称和 H1 不能为空");
  for (const field of ["cover_image", "share_image"] as const) {
    const url = result[field];
    if (url) {
      try {
        if (
          /\s|\\/.test(url) ||
          (!url.startsWith("/") && !/^https?:\/\//.test(url)) ||
          url.startsWith("//")
        )
          throw new Error();
        const parsed = new URL(url, "https://gaterank.invalid");
        if (
          !["http:", "https:"].includes(parsed.protocol) ||
          parsed.username ||
          parsed.password
        )
          throw new Error();
      } catch {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "图片需为有效 HTTP(S) 或站内地址",
        );
      }
    }
  }
  if (!["draft", "published", "archived"].includes(String(source.status)))
    throw new HttpError(400, "BAD_REQUEST", "无效发布状态");
  if (!["hub", "topic"].includes(String(source.template)))
    throw new HttpError(400, "BAD_REQUEST", "无效模板");
  result.status = source.status as SeoTopicInput["status"];
  result.template = source.template as SeoTopicInput["template"];
  result.sort_order = Number(source.sort_order);
  if (
    !Number.isSafeInteger(result.sort_order) ||
    Math.abs(result.sort_order) > 1000000
  )
    throw new HttpError(400, "BAD_REQUEST", "展示顺序必须为整数");
  if (
    !Array.isArray(source.airports) ||
    source.airports.length > 100 ||
    !Array.isArray(source.related_ids) ||
    source.related_ids.length > 100
  )
    throw new HttpError(400, "BAD_REQUEST", "机场及相关专题最多各 100 项");
  result.airports = source.airports.map((item) => {
    if (
      !item ||
      !Number.isSafeInteger(item.airport_id) ||
      item.airport_id <= 0 ||
      typeof item.reason !== "string" ||
      item.reason.length > 2000
    )
      throw new HttpError(400, "BAD_REQUEST", "机场或推荐理由无效");
    return { airport_id: item.airport_id, reason: item.reason.trim() };
  });
  result.related_ids = source.related_ids.map((id) => {
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new HttpError(400, "BAD_REQUEST", "相关专题 ID 无效");
    return id as number;
  });
  if (
    new Set(result.airports.map((a) => a.airport_id)).size !==
      result.airports.length ||
    new Set(result.related_ids).size !== result.related_ids.length
  )
    throw new HttpError(400, "BAD_REQUEST", "不能重复选择机场或专题");
  if (
    result.status === "published" &&
    (!result.content_markdown || !result.seo_title || !result.seo_description)
  )
    throw new HttpError(
      400,
      "BAD_REQUEST",
      "发布前请填写正文、SEO Title 和 Description",
    );
  return result;
}
