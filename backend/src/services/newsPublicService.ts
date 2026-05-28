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

export interface PublicNewsArticleView extends PublicNewsCardView {
  content_html: string;
  headings: Array<{ id: string; level: number; text: string }>;
  previous: PublicNewsCardView | null;
  next: PublicNewsCardView | null;
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
    const [categories, topics, category, topic, result, featuredArticle, recommendedItems, riskItems, guideItems] = await Promise.all([
      this.newsRepository.listCategories(),
      this.newsRepository.listTopics(),
      filters.category_slug ? this.newsRepository.getCategoryBySlug(filters.category_slug) : Promise.resolve(null),
      filters.topic_slug ? this.newsRepository.getTopicBySlug(filters.topic_slug) : Promise.resolve(null),
      this.newsRepository.listPublishedDetailed({
        page: safePage,
        pageSize: safePageSize,
        category_slug: filters.category_slug,
        topic_slug: filters.topic_slug,
        keyword,
      }),
      safePage === 1
        ? this.newsRepository.getFeaturedPublished({
            category_slug: filters.category_slug,
            topic_slug: filters.topic_slug,
            keyword,
          })
        : Promise.resolve(null),
      this.newsRepository.listRecommendedPublished(6),
      this.newsRepository.listLatestByCategory('risk-warning', 3),
      this.newsRepository.listLatestByCategory('tutorials', 3),
    ]);

    const cards = result.items.map((article) => this.toCardView(article));
    const featured = safePage === 1
      ? (featuredArticle || result.items[0] ? this.toCardView(featuredArticle || result.items[0]) : null)
      : null;
    const items = featured ? cards.filter((card) => card.id !== featured.id) : cards;
    const recommended = recommendedItems.length > 0
      ? recommendedItems.map((item) => this.toCardView(item))
      : cards.slice(0, 6);

    return {
      page: safePage,
      page_size: safePageSize,
      total: result.total,
      total_pages: Math.max(1, Math.ceil(result.total / safePageSize)),
      query: keyword,
      category,
      topic,
      categories,
      topics,
      featured,
      items,
      recommended,
      risk_watch: riskItems.map((item) => this.toCardView(item)),
      guides: guideItems.map((item) => this.toCardView(item)),
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
