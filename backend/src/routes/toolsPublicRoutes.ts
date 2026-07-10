import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import {
  buildToolPublicLocalFileMarker,
  getToolDownloadFileExtension,
  isToolDownloadPlatform,
  type ToolDownloadItem,
  type ToolsDownloadPageView,
} from '../../../shared/toolDownloads';
import type { ToolsDownloadService } from '../services/toolsDownloadService';
import { setPublicCacheHeaders } from '../utils/publicCache';
import { sendError } from '../utils/http';
import { resolveVisitorIp, resolveVisitorNetwork } from '../utils/visitorNetwork';
import {
  buildStreamingRegionAssessments,
  inferNetflixRegion,
  STREAMING_POLICY_CHECKED_AT,
  type StreamingCheckResponse,
} from '../../../shared/streamingCheck';

interface ToolsPublicDeps {
  toolsDownloadService: Pick<ToolsDownloadService, 'getDownloadPageView'>;
}

export function createToolsPublicRoutes(deps: ToolsPublicDeps): Router {
  const router = Router();
  const streamingCheckRateLimit = createStreamingCheckRateLimit();

  router.get('/tools/downloads', async (req, res, next) => {
    try {
      const platform = isToolDownloadPlatform(req.query.platform) ? req.query.platform : null;
      const view = await deps.toolsDownloadService.getDownloadPageView(platform);
      setPublicCacheHeaders(res);
      const publicView = sanitizeToolsDownloadPageView(view);
      res.json({
        platform: publicView.platform,
        platforms: publicView.platforms,
        total: publicView.total,
        items: publicView.items,
        hot_items: publicView.hotItems,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/tools/download-page', async (req, res, next) => {
    try {
      const platform = isToolDownloadPlatform(req.query.platform) ? req.query.platform : null;
      const view = await deps.toolsDownloadService.getDownloadPageView(platform);
      setPublicCacheHeaders(res);
      res.json(sanitizeToolsDownloadPageView(view));
    } catch (error) {
      next(error);
    }
  });

  router.post('/tools/streaming-check', streamingCheckRateLimit, (req, res) => {
    const network = resolveVisitorNetwork(req);
    const response: StreamingCheckResponse = {
      checked_at: new Date().toISOString(),
      policy_checked_at: STREAMING_POLICY_CHECKED_AT,
      network,
      services: buildStreamingRegionAssessments(network.country_code),
      netflix: {
        inferred_region: inferNetflixRegion(network.country_code),
        catalog_scope: 'unconfirmed',
      },
    };
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    res.json(response);
  });

  return router;
}

function createStreamingCheckRateLimit() {
  return rateLimit({
    windowMs: Math.max(1000, Number(process.env.STREAMING_CHECK_RATE_WINDOW_MS || 60_000)),
    limit: Math.max(1, Number(process.env.STREAMING_CHECK_RATE_MAX || 10)),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(resolveVisitorIp(req)),
    handler: (req, res) => {
      sendError(
        res,
        429,
        'STREAMING_CHECK_RATE_LIMITED',
        '检测请求过于频繁，请稍后再试',
        req.requestId || 'unknown',
      );
    },
  });
}

function sanitizeToolsDownloadPageView(view: ToolsDownloadPageView): ToolsDownloadPageView {
  const sanitizeItem = (item: ToolDownloadItem): ToolDownloadItem => ({
    ...item,
    file_extension: item.file_extension || getToolDownloadFileExtension(item.local_file_url),
    local_file_url: buildToolPublicLocalFileMarker(item),
  });
  return {
    ...view,
    items: view.items.map(sanitizeItem),
    hotItems: view.hotItems.map(sanitizeItem),
  };
}
