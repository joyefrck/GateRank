import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler';
import type { Airport } from '../types/domain';
import { buildMarketingIdentity } from '../utils/marketing';
import { formatSqlDateTimeInTimezone, getDateInTimezone } from '../utils/time';

interface OutboundDeps {
  airportRepository: {
    getById(id: number): Promise<Airport | null>;
  };
  applicantBillingRepository: {
    processOutboundClick(input: {
      click_id: string;
      airport_id: number;
      placement: string;
      target_kind: 'website' | 'subscription_url';
      target_url: string;
      visitor_hash: string;
      session_hash: string;
      occurred_at: string;
      event_date: string;
    }): Promise<{
      status: string;
      billed_amount: number;
      airport_name: string;
      balance_after: number | null;
    }>;
  };
}

const OUTBOUND_TARGETS = ['website', 'subscription_url'] as const;
const OUTBOUND_PLACEMENTS = ['home_card', 'full_ranking_item', 'risk_monitor_item', 'report_header'] as const;

export function createOutboundRoutes(deps: OutboundDeps): Router {
  const router = Router();

  router.get('/outbound/airports/:airportId', async (req, res, next) => {
    try {
      const airportId = toPositiveInt(req.params.airportId);
      const targetKind = toOutboundTarget(req.query.target);
      const placement = toOutboundPlacement(req.query.placement);
      const airport = await deps.airportRepository.getById(airportId);
      if (!airport) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }

      const targetUrl = resolveTargetUrl(airport, targetKind);
      if (!targetUrl) {
        res.status(404).send(renderUnavailablePage('该机场暂未提供可跳转链接'));
        return;
      }

      const clickId = randomUUID();
      const occurredAt = new Date();
      const identity = buildMarketingIdentity(req, String(req.query.sid || req.requestId || clickId));
      const result = await deps.applicantBillingRepository.processOutboundClick({
        click_id: clickId,
        airport_id: airportId,
        placement,
        target_kind: targetKind,
        target_url: targetUrl,
        visitor_hash: identity.visitor_hash,
        session_hash: identity.session_hash,
        occurred_at: formatSqlDateTimeInTimezone(occurredAt, 'Asia/Shanghai'),
        event_date: getDateInTimezone('Asia/Shanghai', occurredAt),
      });

      if (result.status === 'insufficient_balance' || result.status === 'unlisted' || result.status === 'no_wallet') {
        res.status(402).send(renderUnavailablePage(`${airport.name} 当前暂不可访问`));
        return;
      }

      res.redirect(302, appendSourceParams(targetUrl, clickId));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function resolveTargetUrl(airport: Airport, targetKind: 'website' | 'subscription_url'): string | null {
  const raw = targetKind === 'subscription_url' ? airport.subscription_url : airport.website;
  const value = String(raw || '').trim();
  return normalizeOutboundUrl(value);
}

function appendSourceParams(targetUrl: string, clickId: string): string {
  const url = new URL(targetUrl);
  url.searchParams.set('utm_source', 'gaterank');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'paid_click');
  url.searchParams.set('gr_click_id', clickId);
  return url.toString();
}

function normalizeOutboundUrl(value: string): string | null {
  if (!value) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function renderUnavailablePage(message: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>机场暂不可访问 | GateRank</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{max-width:520px;padding:32px;border:1px solid #e2e8f0;background:#fff;border-radius:18px;box-shadow:0 18px 60px rgba(15,23,42,.08)}
      h1{margin:0 0 12px;font-size:22px}p{margin:0;color:#475569;line-height:1.7}
    </style>
  </head>
  <body><main><h1>${escapeHtml(message)}</h1><p>该机场链接当前未开放跳转，请稍后再试或返回 GateRank 查看其他机场。</p></main></body>
</html>`;
}

function toPositiveInt(value: unknown): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'airport id must be positive integer');
  }
  return num;
}

function toOutboundTarget(value: unknown): 'website' | 'subscription_url' {
  const text = String(value || 'website');
  if ((OUTBOUND_TARGETS as readonly string[]).includes(text)) {
    return text as 'website' | 'subscription_url';
  }
  throw new HttpError(400, 'BAD_REQUEST', 'target must be website or subscription_url');
}

function toOutboundPlacement(value: unknown): string {
  const text = String(value || '');
  if ((OUTBOUND_PLACEMENTS as readonly string[]).includes(text)) {
    return text;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'placement is invalid');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}
