import type { NewsArticle, NewsArticleListItem } from '../types/domain';
import { NewsContentService } from './newsContentService';
import type { NewsRepository } from '../repositories/newsRepository';

export interface PublicNewsCardView {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  published_at: string | null;
  reading_minutes: number;
}

export interface PublicNewsListView {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  featured: PublicNewsCardView | null;
  items: PublicNewsCardView[];
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

  async getListView(page = 1, pageSize = 12): Promise<PublicNewsListView> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(24, Math.max(1, pageSize));
    const result = await this.newsRepository.listPublishedDetailed({
      page: safePage,
      pageSize: safePageSize,
    });

    const cards = result.items.map((article) => this.toCardView(article));
    const featured = safePage === 1 ? cards[0] || null : null;
    const items = safePage === 1 ? cards.slice(1) : cards;

    return {
      page: safePage,
      page_size: safePageSize,
      total: result.total,
      total_pages: Math.max(1, Math.ceil(result.total / safePageSize)),
      featured,
      items,
    };
  }

  async getArticleViewBySlug(slug: string): Promise<PublicNewsArticleView | null> {
    const article = await this.newsRepository.getPublishedBySlug(slug);
    if (!article) {
      return null;
    }
    return this.buildArticleView(article);
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
      reading_minutes: this.newsContentService.render(markdown).reading_minutes,
    };
  }
}
