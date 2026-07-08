import { Router } from 'express';
import {
  buildToolPublicLocalFileMarker,
  getToolDownloadFileExtension,
  isToolDownloadPlatform,
  type ToolDownloadItem,
  type ToolsDownloadPageView,
} from '../../../shared/toolDownloads';
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

  return router;
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
