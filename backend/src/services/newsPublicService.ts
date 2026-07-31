import type {
  NewsArticle,
  NewsArticleListItem,
  NewsCategorySummary,
  NewsTopicSummary,
} from '../types/domain';
import { NewsContentService } from './newsContentService';
import type { NewsRepository } from '../repositories/newsRepository';

export interface PublicNewsCardView {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  published_at: string | null;
  updated_at: string;
  view_count: number;
  reading_minutes: number;
  category: NewsCategorySummary | null;
  topics: NewsTopicSummary[];
  is_featured: boolean;
  is_recommended: boolean;
  recommend_weight: number;
}

export interface PublicNewsListView {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  query: string;
  category: NewsCategorySummary | null;
  topic: NewsTopicSummary | null;
  categories: NewsCategorySummary[];
  topics: NewsTopicSummary[];
  featured: PublicNewsCardView | null;
  items: PublicNewsCardView[];
  recommended: PublicNewsCardView[];
  risk_watch: PublicNewsCardView[];
  guides: PublicNewsCardView[];
}

export interface PublicNewsTopicPageView {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  query: string;
  topic: NewsTopicSummary;
  categories: NewsCategorySummary[];
  topics: NewsTopicSummary[];
  pinned: PublicNewsCardView[];
  items: PublicNewsCardView[];
  recommended: PublicNewsCardView[];
}

export interface PublicNewsArticleView extends PublicNewsCardView {
  content_html: string;
  headings: Array<{ id: string; level: number; text: string }>;
  previous: PublicNewsCardView | null;
  next: PublicNewsCardView | null;
}

function takeUniqueCards(
  candidates: PublicNewsCardView[],
  usedIds: Set<number>,
  limit: number,
): PublicNewsCardView[] {
  const selected: PublicNewsCardView[] = [];
  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }
    if (usedIds.has(candidate.id)) {
      continue;
    }
    usedIds.add(candidate.id);
    selected.push(candidate);
  }
  return selected;
}

export class NewsPublicService {
  constructor(
    private readonly newsRepository: NewsRepository,
    private readonly newsContentService: NewsContentService,
  ) {}

  async getListView(
    page = 1,
    pageSize = 12,
    filters: { category_slug?: string; topic_slug?: string; q?: string } = {},
  ): Promise<PublicNewsListView> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(24, Math.max(1, pageSize));
    const keyword = String(filters.q || '').trim();
    const [categories, topics, category, topic, explicitFeaturedArticle, recommendedItems, riskItems, guideItems] = await Promise.all([
      this.newsRepository.listCategories(),
      this.newsRepository.listTopics(),
      filters.category_slug ? this.newsRepository.getCategoryBySlug(filters.category_slug) : Promise.resolve(null),
      filters.topic_slug ? this.newsRepository.getTopicBySlug(filters.topic_slug) : Promise.resolve(null),
      this.newsRepository.getFeaturedPublished({
        category_slug: filters.category_slug,
        topic_slug: filters.topic_slug,
        keyword,
      }),
      this.newsRepository.listRecommendedPublished(18),
      this.newsRepository.listLatestByCategory('risk-warning', 9),
      this.newsRepository.listLatestByCategory('tutorials', 9),
    ]);
    const fallbackFeaturedArticle = explicitFeaturedArticle
      ? null
      : (await this.newsRepository.listPublishedDetailed({
          page: 1,
          pageSize: 1,
          category_slug: filters.category_slug,
          topic_slug: filters.topic_slug,
          keyword,
        })).items[0] || null;
    const resolvedFeaturedArticle = explicitFeaturedArticle || fallbackFeaturedArticle;
    const result = await this.newsRepository.listPublishedDetailed({
      page: safePage,
      pageSize: safePageSize,
      category_slug: filters.category_slug,
      topic_slug: filters.topic_slug,
      keyword,
      exclude_ids: resolvedFeaturedArticle ? [resolvedFeaturedArticle.id] : [],
    });
    const usedIds = new Set<number>();
    const resolvedFeatured = resolvedFeaturedArticle ? this.toCardView(resolvedFeaturedArticle) : null;
    if (resolvedFeatured) {
      usedIds.add(resolvedFeatured.id);
    }
    const items = takeUniqueCards(result.items.map((article) => this.toCardView(article)), usedIds, safePageSize);
    const recommended = takeUniqueCards(recommendedItems.map((item) => this.toCardView(item)), usedIds, 6);
    const riskWatch = takeUniqueCards(riskItems.map((item) => this.toCardView(item)), usedIds, 3);
    const guides = takeUniqueCards(guideItems.map((item) => this.toCardView(item)), usedIds, 3);
    const total = result.total + (resolvedFeatured ? 1 : 0);

    return {
      page: safePage,
      page_size: safePageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / safePageSize)),
      query: keyword,
      category,
      topic,
      categories,
      topics,
      featured: safePage === 1 ? resolvedFeatured : null,
      items,
      recommended,
      risk_watch: riskWatch,
      guides,
    };
  }

  async getTopicPageView(
    slug: string,
    page = 1,
    pageSize = 12,
    filters: { q?: string } = {},
  ): Promise<PublicNewsTopicPageView | null> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(24, Math.max(1, pageSize));
    const keyword = String(filters.q || '').trim();
    const [categories, topics, topic, recommendedItems] = await Promise.all([
      this.newsRepository.listCategories(),
      this.newsRepository.listTopics(),
      this.newsRepository.getTopicBySlug(slug),
      this.newsRepository.listRecommendedPublished(18),
    ]);
    if (!topic) {
      return null;
    }
    const allPinnedArticles = !keyword
      ? await this.newsRepository.listPublishedPinnedByTopic(topic.id)
      : [];
    const pinnedIds = allPinnedArticles.map((article) => article.id);
    const result = await this.newsRepository.listPublishedDetailed({
      page: safePage,
      pageSize: safePageSize,
      topic_slug: topic.slug,
      keyword,
      exclude_ids: pinnedIds,
    });

    const usedIds = new Set(pinnedIds);
    const pinned = safePage === 1
      ? allPinnedArticles.map((article) => this.toCardView(article))
      : [];
    const items = takeUniqueCards(result.items.map((article) => this.toCardView(article)), usedIds, safePageSize);
    const recommended = takeUniqueCards(recommendedItems.map((item) => this.toCardView(item)), usedIds, 6);
    const total = result.total + allPinnedArticles.length;

    return {
      page: safePage,
      page_size: safePageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / safePageSize)),
      query: keyword,
      topic,
      categories,
      topics,
      pinned,
      items,
      recommended,
    };
  }

  async getArticleViewBySlug(slug: string, options: { countView?: boolean } = {}): Promise<PublicNewsArticleView | null> {
    const article = await this.newsRepository.getPublishedBySlug(slug);
    if (!article) {
      return null;
    }
    const counted = options.countView ? await this.newsRepository.incrementViewCount(article.id) : false;
    const view = await this.buildArticleView(article);
    return counted ? { ...view, view_count: view.view_count + 1 } : view;
  }

  async getPreviewArticleView(articleId: number): Promise<PublicNewsArticleView | null> {
    const article = await this.newsRepository.getById(articleId);
    if (!article) {
      return null;
    }
    return this.buildArticleView(article);
  }

  async getSitemapItems(): Promise<NewsArticleListItem[]> {
    return this.newsRepository.listPublishedForSitemap(1000);
  }

  async getSitemapTaxonomy(): Promise<{
    categories: NewsCategorySummary[];
    topics: NewsTopicSummary[];
  }> {
    const [categories, topics] = await Promise.all([
      this.newsRepository.listCategories(),
      this.newsRepository.listTopics(),
    ]);
    return { categories, topics };
  }

  private async buildArticleView(article: NewsArticle): Promise<PublicNewsArticleView> {
    const rendered = this.newsContentService.render(article.content_markdown);
    const { previous, next } = article.status === 'published'
      ? await this.newsRepository.findAdjacentPublished(article)
      : { previous: null, next: null };

    return {
      ...this.toCardView(article),
      content_html: article.content_html || rendered.html,
      headings: rendered.headings.filter((heading) => heading.level <= 3),
      previous: previous ? this.toCardView(previous) : null,
      next: next ? this.toCardView(next) : null,
    };
  }

  private toCardView(article: NewsArticle | (NewsArticleListItem & { content_markdown?: string })): PublicNewsCardView {
    const markdown = 'content_markdown' in article && article.content_markdown ? article.content_markdown : article.excerpt;
    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      cover_image_url: article.cover_image_url,
      published_at: article.published_at,
      updated_at: article.updated_at,
      view_count: article.view_count,
      reading_minutes: this.newsContentService.render(markdown).reading_minutes,
      category: article.category,
      topics: article.topics,
      is_featured: article.is_featured,
      is_recommended: article.is_recommended,
      recommend_weight: article.recommend_weight,
    };
  }
}
