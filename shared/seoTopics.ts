export type SeoTopicStatus = "draft" | "published" | "archived";
export interface SeoTopicInput {
  name: string;
  h1: string;
  path: string;
  summary: string;
  cover_image: string;
  content_markdown: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  share_image: string;
  template: "topic" | "hub";
  status: SeoTopicStatus;
  sort_order: number;
  airports: Array<{ airport_id: number; reason: string }>;
  related_ids: number[];
}
export interface SeoTopic extends SeoTopicInput {
  id: number;
  updated_at: string;
}
export const EMPTY_SEO_TOPIC: SeoTopicInput = {
  name: "",
  h1: "",
  path: "",
  summary: "",
  cover_image: "",
  content_markdown: "",
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
  share_image: "",
  template: "topic",
  status: "draft",
  sort_order: 0,
  airports: [],
  related_ids: [],
};
