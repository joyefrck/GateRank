import { Router } from 'express';
import { isToolDownloadPlatform } from '../../../shared/toolDownloads';
import type { ToolsDownloadService } from '../services/toolsDownloadService';
import { setPublicCacheHeaders } from '../utils/publicCache';

interface ToolsPublicDeps {
  toolsDownloadService: Pick<ToolsDownloadService, 'getDownloadPageView'>;
}

export function createToolsPublicRoutes(deps: ToolsPublicDeps): Router {
  const router = Router();

  router.get('/tools/downloads', async (req, res, next) => {
    try {
      const platform = isToolDownloadPlatform(req.query.platform) ? req.query.platform : null;
      const view = await deps.toolsDownloadService.getDownloadPageView(platform);
      setPublicCacheHeaders(res);
      res.json({
        platform: view.platform,
        platforms: view.platforms,
        total: view.total,
        items: view.items,
        hot_items: view.hotItems,
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
      res.json(view);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
