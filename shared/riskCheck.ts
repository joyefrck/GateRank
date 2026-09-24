export type WebsiteStatus = 'accessible' | 'challenge' | 'restricted' | 'tls_only'
  | 'service_error' | 'unreachable' | 'config_error' | 'internal_error';

export const WEBSITE_STATUS_LABELS: Record<WebsiteStatus, string> = {
  accessible: '页面可访问', challenge: 'Cloudflare 验证，源站页面未确认',
  restricted: '访问受限，页面内容未确认', tls_only: 'TLS 可达，网页响应未确认',
  service_error: '网页服务异常', unreachable: '当前检测点无法访问',
  config_error: '官网配置错误，未采用此次结果', internal_error: '检测执行异常，未采用此次结果',
};

export interface WebsiteAttempt {
  stage: 'dns' | 'http' | 'tls';
  url: string;
  round: number;
  http_status: number | null;
  error_code: string | null;
}

export interface WebsiteProbeResult {
  domain_ok: boolean | null;
  ssl_days_left: number | null;
  status: WebsiteStatus;
  checked_at: string;
  probe_location: string;
  target_url: string | null;
  final_url: string | null;
  ssl_target_url: string | null;
  tls_authorized: boolean | null;
  http_status: number | null;
  error_code: string | null;
  root_fallback: boolean;
  retried: boolean;
  duration_ms: number;
  attempts: WebsiteAttempt[];
}

export interface RiskCheckRun extends WebsiteProbeResult {
  id: number;
  date: string;
  applied_to_metrics: boolean;
}

export interface RiskCheckHistory {
  latest: RiskCheckRun | null;
  last_applied: RiskCheckRun | null;
}
