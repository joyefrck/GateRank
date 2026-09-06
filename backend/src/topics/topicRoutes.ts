import { Router } from "express";
import type { RequestHandler } from "express";
import type { AuditRepository } from "../repositories/auditRepository";
import { HttpError } from "../middleware/errorHandler";
import { getSiteOrigin } from "../utils/siteUrl";
import { parseTopicInput, normalizeTopicPath } from "./topicValidation";
import { renderTopicMarkdown, type TopicService } from "./topicService";
import { renderTopicPage, topicEscape } from "./topicRenderer";
import { createNewsUploadMiddleware } from "../utils/newsUpload";

interface TopicImageUploadHandler {
  handleUploadedImage(
    file: Pick<Express.Multer.File, "path" | "filename">,
    mode: string | undefined,
  ): Promise<{ url: string }>;
}

const topicImageUpload = createNewsUploadMiddleware();

export function createTopicAdminRoutes(
  service: TopicService,
  audit: Pick<AuditRepository, "log">,
  invalidate: () => void,
  imageUploadHandler?: TopicImageUploadHandler,
): Router {
  const router = Router();
  router.param("id", (req, _res, next, value) => {
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
      next(new HttpError(400, "BAD_REQUEST", "无效专题 ID"));
      return;
    }
    next();
  });
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get("/topics", async (req, res, next) => {
    try {
      const q = String(req.query.q || "").toLowerCase();
      const status = String(req.query.status || "");
      const items = (await service.repository.list()).filter(
        (t) =>
          (!status || t.status === status) &&
          (!q || `${t.name} ${t.path}`.toLowerCase().includes(q)),
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  });
  router.get("/topics/airports", async (req, res, next) => {
    try {
      const q = String(req.query.q || "").toLowerCase();
      res.json({
        items: (await service.airports()).filter(
          (a) => !q || `${a.name} ${a.airport_id}`.toLowerCase().includes(q),
        ),
      });
    } catch (e) {
      next(e);
    }
  });
  router.post(
    "/topics/upload-image",
    topicImageUpload.single("file"),
    async (req, res, next) => {
      try {
        if (!req.file) {
          throw new HttpError(400, "BAD_REQUEST", "缺少图片文件");
        }
        if (!imageUploadHandler) {
          throw new HttpError(
            503,
            "TOPIC_IMAGE_UPLOAD_UNAVAILABLE",
            "专题图片上传暂不可用",
          );
        }
        const result = await imageUploadHandler.handleUploadedImage(
          req.file,
          "body",
        );
        await audit.log(
          "upload_seo_topic_image",
          "admin",
          req.requestId || "unknown",
          {
            filename: result.url.split("/").pop() || req.file.filename,
            size: req.file.size,
          },
        );
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );
  router.post("/topics/render", (req, res, next) => {
    try {
      const markdown = req.body?.content_markdown;
      if (typeof markdown !== "string" || markdown.length > 200000)
        throw new HttpError(400, "BAD_REQUEST", "正文无效或过长");
      res.json({ html: renderTopicMarkdown(markdown) });
    } catch (e) {
      next(e);
    }
  });
  router.get("/topics/:id/preview", async (req, res, next) => {
    try {
      const t = await service.repository.get(Number(req.params.id));
      if (!t) throw new HttpError(404, "TOPIC_NOT_FOUND", "专题不存在");
      res
        .set("X-Robots-Tag", "noindex, nofollow")
        .type("html")
        .send(renderTopicPage(await service.view(t), getSiteOrigin(req), true));
    } catch (e) {
      next(e);
    }
  });
  router.get("/topics/:id", async (req, res, next) => {
    try {
      const t = await service.repository.get(Number(req.params.id));
      if (!t) throw new HttpError(404, "TOPIC_NOT_FOUND", "专题不存在");
      const view = await service.view(t);
      res.json({ ...t, unavailable_ids: view.unavailable_ids });
    } catch (e) {
      next(e);
    }
  });
  const save: RequestHandler = async (req, res, next) => {
    try {
      const topic = await service.repository.save(
        parseTopicInput(req.body),
        req.params.id ? Number(req.params.id) : undefined,
      );
      invalidate();
      await audit.log(
        req.params.id ? "update_seo_topic" : "create_seo_topic",
        "admin",
        req.requestId || "unknown",
        { id: topic.id, path: topic.path, status: topic.status },
      );
      res.status(req.params.id ? 200 : 201).json(topic);
    } catch (e) {
      next(e);
    }
  };
  router.post("/topics", save);
  router.put("/topics/:id", save);
  return router;
}
export function createTopicPublicRoutes(service: TopicService): Router {
  const router = Router();
  router.get("/api/v1/topics/navigation", async (_req, res, next) => {
    try {
      const hub = (await service.repository.list(true)).find(
        (t) => t.template === "hub",
      );
      res
        .set("Cache-Control", "no-store")
        .json({ hub: hub ? { path: hub.path, name: "机场推荐" } : null });
    } catch (e) {
      next(e);
    }
  });
  router.get("*", async (req, res, next) => {
    try {
      let path: string;
      try {
        path = normalizeTopicPath(req.path);
      } catch {
        next();
        return;
      }
      const topic = await service.repository.resolve(path);
      if (!topic) {
        next();
        return;
      }
      res.set("Cache-Control", "no-store");
      if (topic.status !== "published") {
        res
          .status(404)
          .type("html")
          .send(
            '<!doctype html><html lang="zh-CN"><meta name="robots" content="noindex"><title>专题不存在 | GateRank</title><h1>专题不存在</h1><a href="/">返回首页</a></html>',
          );
        return;
      }
      if (req.path !== topic.path) {
        res.redirect(301, topic.path);
        return;
      }
      res
        .type("html")
        .send(renderTopicPage(await service.view(topic), getSiteOrigin(req)));
    } catch (e) {
      next(e);
    }
  });
  return router;
}
// The shared navigation carries inert markers. Resolve them per request so a draft hub never leaks.
export function topicNavigationMiddleware(
  service: TopicService,
): RequestHandler {
  return async (req, res, next) => {
    if (
      req.method !== "GET" ||
      /\.(?:js|css|png|svg|webp|ico)$/.test(req.path) ||
      /^\/(?:api|admin|portal)(?:\/|$)/.test(req.path)
    ) {
      next();
      return;
    }
    try {
      const hub = (await service.repository.list(true)).find(
        (t) => t.template === "hub",
      );
      const send = res.send.bind(res);
      res.send = ((body: unknown) => {
        if (typeof body === "string" && /<!doctype html>/i.test(body)) {
          const href = hub ? topicEscape(hub.path) : "";
          body = body
            .replaceAll("<!--topic-nav-->", "")
            .replaceAll("<!--topic-mobile-nav-->", "")
            .replaceAll(
              "<!--topic-ranking-->",
              hub ? `<p><a href="${href}">机场推荐与选购指南 →</a></p>` : "",
            )
            .replaceAll(
              "<!--topic-footer-->",
              hub ? `<a href="${href}">机场推荐</a>` : "",
            );
          res.set("Cache-Control", "no-store");
        }
        return send(body);
      }) as typeof res.send;
      next();
    } catch (error) {
      next(error);
    }
  };
}
