import type { AirportAdCampaignRepository } from '../repositories/airportAdCampaignRepository';
import { calculateObservationDays } from '../../../shared/observationDays';
import { getDateInTimezone } from '../utils/time';
import type { DownloadAdView } from '../../../shared/airportAds';
import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import {
  buildToolPublicLocalFileMarker,
  getToolDownloadFileExtension,
  isToolDownloadPlatform,
  type ToolDownloadItem,
  type ToolsDownloadPageView,
} from '../../../shared/toolDownloads';
import type { IpCheckRequest, IpCheckSuccessResponse } from '../../../shared/ipCheck';
import type { DnsLeakTestResultRequest } from '../../../shared/dnsLeakTest';
import {
  DnsLeakTestServiceError,
  type DnsLeakTestService,
} from '../services/dnsLeakTestService';
import { IpCheckServiceError, type IpCheckService } from '../services/ipGeolocationService';
import type { ToolsDownloadService } from '../services/toolsDownloadService';
import { normalizeIpCheckTarget } from '../utils/ipCheckTarget';
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
  airportAdCampaignRepository?: Pick<AirportAdCampaignRepository, 'listActiveHomeDeals'>;
  toolsDownloadService: Pick<ToolsDownloadService, 'getDownloadPageView'>;
  ipCheckService?: IpCheckService;
  dnsLeakTestService?: DnsLeakTestService;
}

export function createToolsPublicRoutes(deps: ToolsPublicDeps): Router {
  const router = Router();
  const streamingCheckRateLimit = createStreamingCheckRateLimit();
  const ipCheckRateLimit = createIpCheckRateLimit();
  const dnsLeakStartRateLimit = createDnsLeakStartRateLimit();
  const dnsLeakResultRateLimit = createDnsLeakResultRateLimit();

  router.get('/tools/download-ads', async (_req, res, next) => {
    try {
      const now = new Date();
      const deals = await deps.airportAdCampaignRepository?.listActiveHomeDeals(now) || [];
      const items: DownloadAdView[] = deals.filter((deal) => deal.home_slot != null).map((deal) => ({
        campaign_id: deal.campaign_id,
        airport_id: deal.airport_id,
        home_slot: deal.home_slot!,
        name: deal.airport_name,
        website: deal.website,
        discount_title: deal.discount_title,
        tracking_days: calculateObservationDays(deal.airport_created_at, getDateInTimezone('Asia/Shanghai', now)) ?? 0,
      }));
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

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

  router.post('/tools/ip-check', ipCheckRateLimit, async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    const requestId = req.requestId || 'unknown';
    const body = (req.body || {}) as IpCheckRequest;
    let query: string;

    try {
      if (body.query === undefined) {
        const visitorIp = resolveVisitorIp(req);
        if (!visitorIp || visitorIp === 'unknown') {
          sendError(res, 422, 'IP_CHECK_CLIENT_IP_REQUIRED', '无法识别当前出口 IP', requestId);
          return;
        }
        query = normalizeIpCheckTarget(visitorIp);
      } else {
        query = normalizeIpCheckTarget(body.query);
      }
    } catch {
      if (body.query === undefined) {
        sendError(res, 422, 'IP_CHECK_CLIENT_IP_REQUIRED', '无法识别当前出口 IP', requestId);
        return;
      }
      sendError(res, 400, 'IP_CHECK_INVALID_QUERY', '请输入有效的公网 IP 地址或域名', requestId);
      return;
    }

    if (!deps.ipCheckService) {
      sendError(res, 503, 'IP_CHECK_NOT_CONFIGURED', 'IP 查询服务尚未配置', requestId);
      return;
    }

    try {
      const result = await deps.ipCheckService.lookup(query);
      const response: IpCheckSuccessResponse = {
        checked_at: new Date().toISOString(),
        result,
      };
      res.json(response);
    } catch (error) {
      if (error instanceof IpCheckServiceError) {
        sendError(res, error.status, error.code, ipCheckErrorMessage(error.code), requestId);
        return;
      }
      sendError(res, 502, 'IP_CHECK_UPSTREAM_ERROR', 'IP 查询服务暂时不可用', requestId);
    }
  });

  router.post('/tools/dns-leak-test/start', dnsLeakStartRateLimit, async (req, res) => {
    setPrivateNoStoreHeaders(res);
    if (!deps.dnsLeakTestService) {
      sendError(res, 503, 'DNS_LEAK_TEST_NOT_CONFIGURED', 'DNS 泄漏检测尚未配置', req.requestId || 'unknown');
      return;
    }
    try {
      res.json(await deps.dnsLeakTestService.createSession(resolveVisitorIp(req)));
    } catch (error) {
      sendDnsLeakServiceError(res, req.requestId || 'unknown', error);
    }
  });

  router.post('/tools/dns-leak-test/result', dnsLeakResultRateLimit, async (req, res) => {
    setPrivateNoStoreHeaders(res);
    if (!deps.dnsLeakTestService) {
      sendError(res, 503, 'DNS_LEAK_TEST_NOT_CONFIGURED', 'DNS 泄漏检测尚未配置', req.requestId || 'unknown');
      return;
    }
    const body = (req.body || {}) as DnsLeakTestResultRequest;
    try {
      res.json(await deps.dnsLeakTestService.getResult(
        String(body.session_id || ''),
        resolveVisitorIp(req),
      ));
    } catch (error) {
      sendDnsLeakServiceError(res, req.requestId || 'unknown', error);
    }
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

function createIpCheckRateLimit() {
  return rateLimit({
    windowMs: Math.max(1000, Number(process.env.IP_CHECK_RATE_WINDOW_MS || 60_000)),
    limit: Math.max(1, Number(process.env.IP_CHECK_RATE_MAX || 10)),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(resolveVisitorIp(req)),
    handler: (req, res) => {
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Pragma', 'no-cache');
      sendError(
        res,
        429,
        'IP_CHECK_RATE_LIMITED',
        '查询请求过于频繁，请稍后再试',
        req.requestId || 'unknown',
      );
    },
  });
}

function createDnsLeakStartRateLimit() {
  return rateLimit({
    windowMs: Math.max(1000, Number(process.env.DNS_LEAK_TEST_RATE_WINDOW_MS || 60_000)),
    limit: Math.max(1, Number(process.env.DNS_LEAK_TEST_RATE_MAX || 5)),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(resolveVisitorIp(req)),
    handler: (req, res) => {
      setPrivateNoStoreHeaders(res);
      sendError(
        res,
        429,
        'DNS_LEAK_TEST_RATE_LIMITED',
        '检测请求过于频繁，请稍后再试',
        req.requestId || 'unknown',
      );
    },
  });
}

function createDnsLeakResultRateLimit() {
  return rateLimit({
    windowMs: 60_000,
    limit: Math.max(10, Number(process.env.DNS_LEAK_TEST_RESULT_RATE_MAX || 60)),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(resolveVisitorIp(req)),
    handler: (req, res) => {
      setPrivateNoStoreHeaders(res);
      sendError(
        res,
        429,
        'DNS_LEAK_TEST_RATE_LIMITED',
        '结果查询过于频繁，请稍后再试',
        req.requestId || 'unknown',
      );
    },
  });
}

function ipCheckErrorMessage(code: IpCheckServiceError['code']): string {
  if (code === 'IP_CHECK_LOOKUP_FAILED') return '无法解析该 IP 地址或域名';
  if (code === 'IP_CHECK_NOT_CONFIGURED') return 'IP 查询服务尚未配置';
  if (code === 'IP_CHECK_UPSTREAM_TIMEOUT') return 'IP 查询服务响应超时';
  return 'IP 查询服务暂时不可用';
}

function sendDnsLeakServiceError(
  res: Parameters<typeof sendError>[0],
  requestId: string,
  error: unknown,
): void {
  if (error instanceof DnsLeakTestServiceError) {
    sendError(
      res,
      error.status,
      error.code,
      error.code === 'DNS_LEAK_TEST_CLIENT_IP_REQUIRED'
        ? '无法识别当前出口 IP'
        : error.code === 'DNS_LEAK_TEST_SESSION_NOT_FOUND'
          ? 'DNS 检测会话不存在或已过期'
          : 'DNS 泄漏检测尚未配置',
      requestId,
    );
    return;
  }
  sendError(res, 500, 'DNS_LEAK_TEST_INTERNAL_ERROR', 'DNS 泄漏检测暂时不可用', requestId);
}

function setPrivateNoStoreHeaders(res: Parameters<typeof sendError>[0]): void {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
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
