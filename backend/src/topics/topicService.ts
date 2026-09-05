import type { SeoTopic } from "../../../shared/seoTopics";
import type { FullRankingItem } from "../types/domain";
import type { PublicViewService } from "../services/publicViewService";
import { getDateInTimezone } from "../utils/time";
import type { TopicRepository } from "./topicRepository";
import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";

export function renderTopicMarkdown(markdown: string): string {
  const html = new Marked({ gfm: true, breaks: true }).parse(markdown, {
    async: false,
  }) as string;
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags.filter((tag) => tag !== "h1"),
      "img",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "loading"],
      code: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
      h1: "h2",
    },
  });
}
export interface TopicView {
  topic: SeoTopic;
  html: string;
  airports: Array<FullRankingItem & { reason: string }>;
  unavailable_ids: number[];
  related: SeoTopic[];
  directory: SeoTopic[];
  hub: SeoTopic | null;
}
export class TopicService {
  constructor(
    readonly repository: TopicRepository,
    private views: Pick<PublicViewService, "getFullRankingView">,
  ) {}
  async airports(): Promise<FullRankingItem[]> {
    const date = getDateInTimezone();
    const first = await this.views.getFullRankingView(date, 1, 100);
    const items = [...first.items];
    for (let page = 2; page <= first.total_pages; page++)
      items.push(
        ...(await this.views.getFullRankingView(date, page, 100)).items,
      );
    const prices = await this.repository.monthlyPrices(
      items.map((item) => item.airport_id),
    );
    // Apply the public eligibility contract again at this boundary, including fixtures/legacy payloads.
    return items
      .filter((item) => item.report_url)
      .map((item) => ({
        ...item,
        plan_price_month: prices.get(item.airport_id) || 0,
        score: item.score_hidden ? null : item.score,
      }));
  }
  async view(topic: SeoTopic): Promise<TopicView> {
    const [airports, published] = await Promise.all([
      topic.airports.length ? this.airports() : Promise.resolve([]),
      this.repository.list(true),
    ]);
    const byId = new Map(airports.map((item) => [item.airport_id, item]));
    return {
      topic,
      html: renderTopicMarkdown(topic.content_markdown),
      airports: topic.airports.flatMap((item) => {
        const data = byId.get(item.airport_id);
        return data ? [{ ...data, reason: item.reason }] : [];
      }),
      unavailable_ids: topic.airports
        .filter((item) => !byId.has(item.airport_id))
        .map((item) => item.airport_id),
      related: topic.related_ids.flatMap((id) => {
        const found = published.find((t) => t.id === id);
        return found ? [found] : [];
      }),
      directory:
        topic.template === "hub"
          ? published.filter((t) => t.id !== topic.id && t.template === "topic")
          : [],
      hub: published.find((t) => t.template === "hub") || null,
    };
  }
}
