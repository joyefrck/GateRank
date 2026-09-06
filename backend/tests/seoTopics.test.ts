import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import sharp from "sharp";
import type { AddressInfo } from "node:net";
import { EMPTY_SEO_TOPIC, type SeoTopic } from "../../shared/seoTopics";
import {
  normalizeTopicPath,
  parseTopicInput,
} from "../src/topics/topicValidation";
import { TopicService, renderTopicMarkdown } from "../src/topics/topicService";
import { renderTopicPage } from "../src/topics/topicRenderer";
import {
  createTopicAdminRoutes,
  createTopicPublicRoutes,
  topicNavigationMiddleware,
} from "../src/topics/topicRoutes";
import { errorHandler } from "../src/middleware/errorHandler";
import { adminAuth } from "../src/middleware/adminAuth";
import { createNewsPublicRoutes } from "../src/routes/newsPublicRoutes";
import { TOPIC_SEEDS } from "../src/topics/topicSeeds";
import { insertSeoTopicImageMarkdown } from "../../shared/seoTopicMarkdown";
import { NewsCoverImageService } from "../src/services/newsCoverImageService";

const topic = (overrides: Partial<SeoTopic> = {}): SeoTopic => ({
  ...EMPTY_SEO_TOPIC,
  id: 1,
  name: "测试专题",
  h1: "测试专题 H1",
  path: "/test-topic",
  status: "published",
  content_markdown: "## 指南\n\n有效正文",
  seo_title: "独立 SEO 标题",
  seo_description: "独立描述",
  updated_at: "2026-09-05T00:00:00.000Z",
  ...overrides,
});
function fixture() {
  const topics = [
    topic(),
    topic({ id: 2, path: "/hub", template: "hub" }),
    topic({ id: 3, path: "/draft", status: "draft" }),
  ];
  const repo = {
    list: async (published = false) =>
      topics.filter((t) => !published || t.status === "published"),
    get: async (id: number) => topics.find((t) => t.id === id) || null,
    resolve: async (path: string) =>
      topics.find((t) => t.path === path) ||
      (path === "/old-topic" || path === "/older-topic" ? topics[0] : null),
    monthlyPrices: async () =>
      new Map([
        [1, 10],
        [2, 20],
      ]),
    save: async (input: SeoTopic, id?: number) => {
      const saved = topic({ ...input, id: id || 4 });
      const i = topics.findIndex((t) => t.id === id);
      if (i >= 0) topics[i] = saved;
      else topics.push(saved);
      return saved;
    },
  };
  const service = new TopicService(
    repo as never,
    {
      getFullRankingView: async () => ({
        items: [
          {
            airport_id: 1,
            name: "可见机场",
            score: 99,
            score_hidden: true,
            report_url: "/airports/visible",
            plan_price_month: 1,
          },
          {
            airport_id: 2,
            name: "无公开报告",
            score: 90,
            report_url: null,
            plan_price_month: 1,
          },
        ],
        total_pages: 1,
      }),
    } as never,
  );
  return { topics, service, repo };
}
async function serve(
  app: express.Express,
  run: (base: string) => Promise<void>,
) {
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((r) => server.once("listening", r));
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

test("topic validation normalizes paths and rejects system namespaces and unsafe input", () => {
  assert.equal(
    normalizeTopicPath("/Rankings/Clash-Airports/"),
    "/rankings/clash-airports",
  );
  for (const path of [
    "/",
    "/api/v1/admin",
    "/news/custom",
    "/rankings/client/clash",
    "/rankings/all",
    "/adminx/../admin",
    "//evil.test",
    "/foo?x=1",
    "/foo#bar",
    "/foo%2fbar",
    "/assets/test",
    "/tools/new",
    "/airport-recommendations.js",
  ])
    assert.throws(() => normalizeTopicPath(path));
  assert.throws(() =>
    parseTopicInput({ ...topic(), cover_image: "javascript:alert(1)" }),
  );
  assert.throws(() => parseTopicInput({ ...topic(), status: "bad" }));
  assert.throws(() =>
    parseTopicInput({
      ...topic(),
      airports: [
        { airport_id: 1, reason: "" },
        { airport_id: 1, reason: "" },
      ],
    }),
  );
  assert.throws(() => parseTopicInput({ ...topic(), content_markdown: "" }));
  assert.equal(parseTopicInput(topic()).path, "/test-topic");
});
test("markdown strips executable HTML while preserving headings, images and tables", () => {
  const html = renderTopicMarkdown(
    '# Body heading\n\n<script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">bad</a>\n\n| A | B |\n|---|---|\n| 1 | 2 |',
  );
  assert.doesNotMatch(html, /<script|onerror|javascript:|<h1/);
  assert.match(html, /<h2/);
  assert.match(html, /<table/);
});
test("topic image markdown is inserted at the cursor with safe spacing and alt text", () => {
  const source = "第一段\n## 下一段";
  const result = insertSeoTopicImageMarkdown({
    markdown: source,
    start: 4,
    end: 4,
    url: "/uploads/news/topic.png",
    alt: "示例]图片\\",
  });
  assert.equal(
    result.markdown,
    "第一段\n\n![示例图片](/uploads/news/topic.png)\n\n## 下一段",
  );
  assert.equal(
    result.cursor,
    "第一段\n\n![示例图片](/uploads/news/topic.png)\n\n".length,
  );
});

test("public view preserves manual order, removes unavailable airports and masks hidden scores", async () => {
  const { service } = fixture();
  const view = await service.view(
    topic({
      airports: [
        { airport_id: 2, reason: "不可公开" },
        { airport_id: 1, reason: "真实推荐" },
      ],
      related_ids: [3, 2],
    }),
  );
  assert.deepEqual(
    view.airports.map((a) => a.airport_id),
    [1],
  );
  assert.equal(view.airports[0].score, null);
  assert.equal(view.airports[0].plan_price_month, 10);
  assert.deepEqual(view.unavailable_ids, [2]);
  assert.deepEqual(
    view.related.map((t) => t.id),
    [2],
  );
  const html = renderTopicPage(view, "https://example.test");
  assert.match(html, /<title>独立 SEO 标题<\/title>/);
  assert.match(
    html,
    /rel="canonical" href="https:\/\/example.test\/test-topic"/,
  );
  assert.match(html, /有效正文/);
  assert.match(html, /\/airports\/visible/);
  assert.doesNotMatch(html, /无公开报告|不可公开|评分 99|\/draft/);
  assert.match(html, /评分暂不可见/);
  assert.match(html, /ItemList/);
  assert.match(
    html,
    /\.topic-body img\{display:block;width:min\(100%,840px\);height:auto;margin:24px auto/,
  );
  assert.doesNotMatch(html, /src=".*index.*js/);
});
test("public routing supports exact lookup, direct historical redirects, draft protection and no-store", async () => {
  const { service, topics } = fixture();
  const app = express();
  app.use(createTopicPublicRoutes(service));
  app.use((_q, r) => r.status(404).send("missing"));
  app.use(errorHandler);
  await serve(app, async (base) => {
    assert.equal((await fetch(base + "/missing")).status, 404);
    assert.equal((await fetch(base + "/draft")).status, 404);
    for (const path of ["/old-topic", "/older-topic", "/TEST-TOPIC/"]) {
      const r = await fetch(base + path, { redirect: "manual" });
      assert.equal(r.status, 301);
      assert.equal(r.headers.get("location"), "/test-topic");
    }
    const r = await fetch(base + "/test-topic");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.match(await r.text(), /有效正文/);
    topics[0].status = "archived";
    assert.equal(
      (await fetch(base + "/old-topic", { redirect: "manual" })).status,
      404,
    );
    const nav = (await (
      await fetch(base + "/api/v1/topics/navigation")
    ).json()) as { hub: { path: string } };
    assert.equal(nav.hub.path, "/hub");
  });
});
test("admin authentication, saved preview and mutation invalidation are enforced", async () => {
  const { service } = fixture();
  let invalidations = 0;
  const audit: string[] = [];
  const before = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = "topic-test-key";
  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1/admin",
    adminAuth,
    createTopicAdminRoutes(
      service,
      {
        log: async (action) => {
          audit.push(action);
        },
      },
      () => {
        invalidations++;
      },
    ),
  );
  app.use(errorHandler);
  try {
    await serve(app, async (base) => {
      assert.equal((await fetch(base + "/api/v1/admin/topics")).status, 401);
      assert.equal(
        (await fetch(base + "/api/v1/admin/topics/3/preview")).status,
        401,
      );
      const headers = {
        "x-api-key": "topic-test-key",
        "Content-Type": "application/json",
      };
      const preview = await fetch(base + "/api/v1/admin/topics/3/preview", {
        headers,
      });
      assert.equal(preview.status, 200);
      assert.match(preview.headers.get("x-robots-tag")!, /noindex/);
      assert.equal(preview.headers.get("cache-control"), "no-store");
      const saved = await fetch(base + "/api/v1/admin/topics/1", {
        method: "PUT",
        headers,
        body: JSON.stringify(topic({ status: "archived" })),
      });
      assert.equal(saved.status, 200);
      assert.equal(invalidations, 1);
      assert.deepEqual(audit, ["update_seo_topic"]);
      assert.equal(
        (await fetch(base + "/api/v1/admin/topics/not-a-number", { headers }))
          .status,
        400,
      );
    });
  } finally {
    if (before === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = before;
  }
});
test("topic body image upload accepts real images, rejects other files and records an audit", async () => {
  const { service } = fixture();
  const uploadRoot = mkdtempSync(path.join(tmpdir(), "gaterank-topic-upload-"));
  const audits: Array<{ action: string; payload: unknown }> = [];
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;
  const imageService = new NewsCoverImageService();
  const app = express();
  app.use(
    "/api/v1/admin",
    (
      createTopicAdminRoutes as unknown as (
        ...args: unknown[]
      ) => express.Router
    )(
      service,
      {
        log: async (
          action: string,
          _actor: string,
          _requestId: string,
          payload: unknown,
        ) => {
          audits.push({ action, payload });
        },
      },
      () => undefined,
      {
        handleUploadedImage: (file: Express.Multer.File) =>
          imageService.compressUploadedBodyImage(file.path),
      },
    ),
  );
  app.use(errorHandler);
  try {
    await serve(app, async (base) => {
      const image = new FormData();
      const source = await sharp({
        create: {
          width: 2400,
          height: 1600,
          channels: 3,
          background: { r: 48, g: 72, b: 96 },
        },
      })
        .png()
        .toBuffer();
      image.set("file", new Blob([source], { type: "image/png" }), "topic.png");
      const uploaded = await fetch(`${base}/api/v1/admin/topics/upload-image`, {
        method: "POST",
        body: image,
      });
      assert.equal(uploaded.status, 201);
      const uploadedUrl = ((await uploaded.json()) as { url: string }).url;
      assert.match(uploadedUrl, /^\/uploads\/news\/topic-body-.+\.webp$/);
      const outputPath = path.join(
        uploadRoot,
        uploadedUrl.slice("/uploads/".length),
      );
      assert.equal(existsSync(outputPath), true);
      const metadata = await sharp(outputPath).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, 1200);
      assert.equal(metadata.height, 800);
      assert.equal(audits[0]?.action, "upload_seo_topic_image");

      const invalid = new FormData();
      invalid.set(
        "file",
        new Blob(["plain text"], { type: "text/plain" }),
        "bad.txt",
      );
      assert.equal(
        (
          await fetch(`${base}/api/v1/admin/topics/upload-image`, {
            method: "POST",
            body: invalid,
          })
        ).status,
        400,
      );
    });
  } finally {
    delete process.env.NEWS_UPLOAD_ROOT_DIR;
    rmSync(uploadRoot, { recursive: true, force: true });
  }
});
test("sitemap and shared navigation only expose published topics and update on unpublish", async () => {
  const { service, repo, topics } = fixture();
  const app = express();
  app.use(topicNavigationMiddleware(service));
  app.get("/shell", (_q, r) =>
    r
      .type("html")
      .send(
        "<!doctype html><nav><!--topic-nav--><!--topic-mobile-nav--></nav><main><!--topic-ranking--></main><footer><!--topic-footer--></footer>",
      ),
  );
  app.use(
    createNewsPublicRoutes({
      topicRepository: repo as never,
      newsPublicService: {
        getSitemapItems: async () => [],
        getSitemapTaxonomy: async () => ({ categories: [], topics: [] }),
      } as never,
    }),
  );
  await serve(app, async (base) => {
    const sitemap = await fetch(base + "/sitemap.xml");
    assert.equal(sitemap.headers.get("cache-control"), "no-store");
    const xml = await sitemap.text();
    assert.match(xml, /\/test-topic<\/loc>/);
    assert.doesNotMatch(xml, /\/draft<\/loc>/);
    assert.match(xml, /2026-09-05T00:00:00.000Z/);
    const shell = await (await fetch(base + "/shell")).text();
    assert.doesNotMatch(shell, /data-topic-nav|public-top-nav-mobile-link/);
    assert.match(
      shell,
      /<main><p><a href="\/hub">机场推荐与选购指南 →<\/a><\/p><\/main>/,
    );
    assert.match(
      shell,
      /<footer><a href="\/hub">机场推荐<\/a><\/footer>/,
    );
    topics[1].status = "archived";
    assert.doesNotMatch(
      await (await fetch(base + "/shell")).text(),
      /href="\/hub"/,
    );
    assert.doesNotMatch(
      await (await fetch(base + "/sitemap.xml")).text(),
      /\/hub<\/loc>/,
    );
  });
});
test("five initial drafts retain requested titles and contain distinct complete guides", () => {
  assert.equal(TOPIC_SEEDS.length, 5);
  assert.equal(new Set(TOPIC_SEEDS.map((s) => s.input.path)).size, 5);
  for (const seed of TOPIC_SEEDS) {
    assert.equal(seed.input.status, "draft");
    assert.ok(seed.input.content_markdown.length > 500);
    assert.equal(parseTopicInput(seed.input).seo_title, seed.input.seo_title);
  }
  assert.equal(
    TOPIC_SEEDS[0].input.seo_title,
    "Clash 机场推荐 2026：支持 Clash Verge / Mihomo 的机场排行 | GateRank",
  );
});
