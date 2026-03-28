import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Database,
  Activity,
  Bell,
  RefreshCw,
  LogOut,
  Plus,
  Search,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
} from 'lucide-react';

type AirportStatus = 'normal' | 'risk' | 'down';
type AirportApplicationReviewStatus = 'pending' | 'reviewed' | 'rejected';
type ProbeSampleType = 'latency' | 'download' | 'availability';
type ProbeScope = 'stability' | 'performance';
type ManualJobKind = 'full' | 'stability' | 'performance' | 'risk' | 'time_decay';
type ManualJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

interface Airport {
  id: number;
  name: string;
  website: string;
  websites?: string[];
  status: AirportStatus;
  plan_price_month: number;
  has_trial: boolean;
  subscription_url?: string | null;
  applicant_email?: string | null;
  applicant_telegram?: string | null;
  founded_on?: string | null;
  airport_intro?: string | null;
  test_account?: string | null;
  test_password?: string | null;
  tags: string[];
  created_at: string;
  total_score?: number | null;
  price_score?: number | null;
  score_data_days?: number | null;
}

interface AirportFormState {
  id?: number;
  name: string;
  websites: string[];
  status: AirportStatus;
  plan_price_month: string;
  has_trial: boolean;
  subscription_url: string;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
  tags: string[];
}

interface AirportDashboardView {
  date: string;
  base: Airport;
  stability: {
    uptime_percent_30d: number | null;
    uptime_percent_today: number | null;
    latency_samples_ms: number[];
    latency_mean_ms: number | null;
    latency_std_ms: number | null;
    latency_cv: number | null;
    effective_latency_cv: number | null;
    download_samples_mbps: number[];
    stable_days_streak: number | null;
    is_stable_day: boolean | null;
    s: number | null;
    uptime_score: number | null;
    stability_score: number | null;
    streak_score: number | null;
    stability_rule_version: string | null;
  };
  performance: {
    median_latency_ms: number | null;
    median_download_mbps: number | null;
    packet_loss_percent: number | null;
    p: number | null;
    latency_score: number | null;
    speed_score: number | null;
    loss_score: number | null;
    data_source_mode: string | null;
    cache_source_date: string | null;
    collect_status: string | null;
    last_sampled_at: string | null;
    last_source: string | null;
    subscription_format: string | null;
    parsed_nodes_count: number | null;
    supported_nodes_count: number | null;
    selected_nodes: Array<{ name: string; region?: string | null; type?: string | null }>;
    tested_nodes: Array<{
      name: string;
      region?: string | null;
      type?: string | null;
      status?: string | null;
      error_code?: string | null;
      connect_latency_samples_ms?: number[];
      connect_latency_median_ms?: number | null;
      proxy_http_latency_samples_ms?: number[];
      proxy_http_latency_median_ms?: number | null;
      download_mbps?: number | null;
    }>;
    tested_nodes_count: number | null;
    error_code: string | null;
    error_message: string | null;
    latency_measurement: string | null;
    latency_probe_target: string | null;
    proxy_http_test_url: string | null;
    proxy_http_median_latency_ms: number | null;
    speed_measurement: string | null;
    speed_test_connections: number | null;
  };
  risk: {
    domain_ok: boolean | null;
    ssl_days_left: number | null;
    recent_complaints_count: number | null;
    history_incidents: number | null;
    domain_penalty: number | null;
    ssl_penalty: number | null;
    complaint_penalty: number | null;
    history_penalty: number | null;
    total_penalty: number | null;
    risk_penalty: number | null;
    r: number | null;
    risk_level: string | null;
  };
  time_decay: {
    date: string;
    recent_score_cache: number | null;
    historical_score_cache: number | null;
    score?: number | null;
    recent_score?: number | null;
    historical_score?: number | null;
    final_score?: number | null;
  };
}

interface AirportApplication {
  id: number;
  name: string;
  website: string;
  websites: string[];
  status: AirportStatus;
  plan_price_month: number;
  has_trial: boolean;
  subscription_url?: string | null;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
  approved_airport_id?: number | null;
  review_status: AirportApplicationReviewStatus;
  review_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface ProbeSample {
  id: number;
  airport_id: number;
  sampled_at: string;
  sample_type: ProbeSampleType;
  probe_scope: ProbeScope;
  latency_ms: number | null;
  download_mbps: number | null;
  availability: boolean | null;
  source: string;
}

type DashboardTab = 'base' | 'stability' | 'performance' | 'risk' | 'time_decay';

interface ManualJobRecord {
  id: number;
  airport_id: number;
  date: string;
  kind: ManualJobKind;
  status: ManualJobStatus;
  message: string | null;
  created_by: string;
  request_id: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TelegramSettingsView {
  enabled: boolean;
  delivery_mode: 'telegram_chat' | 'webhook';
  telegram_chat: {
    has_bot_token: boolean;
    bot_token_masked: string | null;
    chat_id: string;
    api_base: string;
    timeout_ms: number;
  };
  webhook: {
    has_bearer_token: boolean;
    bearer_token_masked: string | null;
    url: string;
    timeout_ms: number;
  };
  updated_at: string | null;
  updated_by: string | null;
}

interface TelegramSettingsFormState {
  enabled: boolean;
  delivery_mode: 'telegram_chat' | 'webhook';
  telegram_chat: {
    bot_token: string;
    chat_id: string;
    api_base: string;
    timeout_ms: string;
  };
  webhook: {
    url: string;
    bearer_token: string;
    timeout_ms: string;
  };
}

const TOKEN_KEY = 'gaterank_admin_token';

function getApiBase(): string {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.replace(/\/+$/, '');
  }
  return '';
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    if (window.location.pathname !== '/admin/login') {
      window.history.pushState({}, '', '/admin/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    throw new Error('登录已过期，请重新登录');
  }

  if (!response.ok) {
    const data = (await safeJson(response)) as { message?: string };
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }

  return safeJson(response);
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function AdminApp() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (path === '/admin') {
      window.history.replaceState({}, '', '/admin/airports');
      setPath('/admin/airports');
    }
  }, [path]);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setPath(to);
  };

  if (path === '/admin/login') {
    return <LoginPage onLoggedIn={() => navigate('/admin/airports')} />;
  }

  const hasToken = Boolean(localStorage.getItem(TOKEN_KEY));
  if (!hasToken) {
    return <LoginPage onLoggedIn={() => navigate('/admin/airports')} />;
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="bg-white border-b border-neutral-200 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 font-bold tracking-tight">
          <span className="w-8 h-8 rounded bg-neutral-900 text-white flex items-center justify-center"><Shield size={16} /></span>
          GateRank Admin
        </div>
        <div className="flex items-center gap-2">
          <a
            className="text-sm px-3 py-1.5 rounded border border-neutral-300 bg-white"
            href="/"
            target="_blank"
            rel="noreferrer"
          >
            前台首页
          </a>
          <button
            className="text-sm px-3 py-1.5 rounded bg-neutral-900 text-white"
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              navigate('/admin/login');
            }}
          >
            <span className="inline-flex items-center gap-2"><LogOut size={14} />退出</span>
          </button>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-6">
        <aside className="bg-white rounded-xl border border-neutral-200 p-3 h-fit">
          <NavItem icon={<Database size={14} />} active={path.startsWith('/admin/airports')} onClick={() => navigate('/admin/airports')} label="机场管理" />
          <NavItem icon={<Shield size={14} />} active={path.startsWith('/admin/applications')} onClick={() => navigate('/admin/applications')} label="入驻申请" />
          <NavItem icon={<Bell size={14} />} active={path.startsWith('/admin/settings')} onClick={() => navigate('/admin/settings')} label="系统设置" />
          <NavItem icon={<Activity size={14} />} active={path.startsWith('/admin/ops/recompute')} onClick={() => navigate('/admin/ops/recompute')} label="作业工具" />
        </aside>

        <main className="bg-white rounded-xl border border-neutral-200 p-6">
          {path === '/admin/airports' && <AirportsPage onOpenAirport={(id) => navigate(`/admin/airports/${id}/data`)} />}
          {path === '/admin/applications' && <ApplicationsPage onOpenAirports={() => navigate('/admin/airports')} />}
          {path === '/admin/settings' && <SystemSettingsPage />}
          {path.match(/^\/admin\/airports\/\d+\/data$/) && (
            <AirportDataPage airportId={Number(path.split('/')[3])} onBack={() => navigate('/admin/airports')} />
          )}
          {path === '/admin/ops/recompute' && <OpsRecomputePage />}
        </main>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${active ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'}`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = (await apiFetch('/api/v1/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })) as { token: string };
      localStorage.setItem(TOKEN_KEY, result.token);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-bold">管理后台登录</h1>
        <p className="text-sm text-neutral-500">输入管理员密码获取后台访问令牌</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="管理员密码"
          required
        />
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <button disabled={loading} className="w-full bg-neutral-900 text-white rounded px-3 py-2">
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  );
}

function SystemSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState<TelegramSettingsView | null>(null);
  const [clearBotToken, setClearBotToken] = useState(false);
  const [clearWebhookBearerToken, setClearWebhookBearerToken] = useState(false);
  const [form, setForm] = useState<TelegramSettingsFormState>({
    enabled: false,
    delivery_mode: 'telegram_chat',
    telegram_chat: {
      bot_token: '',
      chat_id: '',
      api_base: 'https://api.telegram.org',
      timeout_ms: '5000',
    },
    webhook: {
      url: '',
      bearer_token: '',
      timeout_ms: '5000',
    },
  });

  const applyView = (view: TelegramSettingsView) => {
    setSettings(view);
    setForm({
      enabled: view.enabled,
      delivery_mode: view.delivery_mode,
      telegram_chat: {
        bot_token: '',
        chat_id: view.telegram_chat.chat_id || '',
        api_base: view.telegram_chat.api_base || 'https://api.telegram.org',
        timeout_ms: String(view.telegram_chat.timeout_ms || 5000),
      },
      webhook: {
        url: view.webhook.url || '',
        bearer_token: '',
        timeout_ms: String(view.webhook.timeout_ms || 5000),
      },
    });
    setClearBotToken(false);
    setClearWebhookBearerToken(false);
  };

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = (await apiFetch('/api/v1/admin/system-settings/telegram')) as TelegramSettingsView;
      applyView(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      enabled: form.enabled,
      delivery_mode: form.delivery_mode,
      telegram_chat: {
        chat_id: form.telegram_chat.chat_id.trim(),
        api_base: form.telegram_chat.api_base.trim() || 'https://api.telegram.org',
        timeout_ms: Number(form.telegram_chat.timeout_ms || 5000),
      },
      webhook: {
        url: form.webhook.url.trim(),
        timeout_ms: Number(form.webhook.timeout_ms || 5000),
      },
    };

    if (clearBotToken) {
      (payload.telegram_chat as Record<string, unknown>).bot_token = '';
    } else if (form.telegram_chat.bot_token.trim()) {
      (payload.telegram_chat as Record<string, unknown>).bot_token = form.telegram_chat.bot_token.trim();
    }

    if (clearWebhookBearerToken) {
      (payload.webhook as Record<string, unknown>).bearer_token = '';
    } else if (form.webhook.bearer_token.trim()) {
      (payload.webhook as Record<string, unknown>).bearer_token = form.webhook.bearer_token.trim();
    }

    return payload;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = (await apiFetch('/api/v1/admin/system-settings/telegram', {
        method: 'PATCH',
        body: JSON.stringify(buildPayload()),
      })) as TelegramSettingsView;
      applyView(data);
      setSuccess('申请通知配置已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch('/api/v1/admin/system-settings/telegram/test', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      });
      setSuccess(form.delivery_mode === 'telegram_chat' ? 'Telegram 测试消息已发送' : 'Webhook 测试请求已发送');
    } catch (err) {
      setError(err instanceof Error ? err.message : '测试发送失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">系统设置</h2>
          <p className="mt-1 text-sm text-neutral-500">申请通知支持 Telegram 直发和 Webhook 转发，保存后立即生效。</p>
        </div>
        <button className="px-3 py-2 rounded border text-sm" onClick={() => void fetchSettings()} disabled={loading}>
          刷新
        </button>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">申请通知</div>
          <p className="mt-1 text-sm text-neutral-500">用于接收新的机场入驻申请提醒。测试不会持久化当前输入的密钥变更。</p>
        </div>

        {loading && <div className="text-sm text-neutral-500">加载中...</div>}

        {!loading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ReadField label="当前发送模式" value={form.delivery_mode === 'telegram_chat' ? 'Telegram 直发' : 'Webhook 转发'} />
              <ReadField label="最近更新人" value={valueOrDash(settings?.updated_by)} />
              <ReadField label="最近更新时间" value={formatDateTimeInBeijing(settings?.updated_at)} />
              <ReadField label="Telegram Token" value={settings?.telegram_chat.has_bot_token ? `已配置 (${settings?.telegram_chat.bot_token_masked || '-'})` : '未配置'} />
              <ReadField label="Telegram Chat ID" value={valueOrDash(settings?.telegram_chat.chat_id)} />
              <ReadField label="Webhook Bearer" value={settings?.webhook.has_bearer_token ? `已配置 (${settings?.webhook.bearer_token_masked || '-'})` : '未配置'} />
              <ReadField label="Webhook URL" value={valueOrDash(settings?.webhook.url)} />
            </div>

            <div className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4">
              <div className="text-sm font-medium text-neutral-900">启用开关</div>
              <p className="mt-1 text-sm text-neutral-500">关闭后不会自动推送新申请通知，但仍可手动发送测试消息。</p>
              <label className="mt-4 inline-flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                启用申请通知
              </label>
            </div>

            <div className="rounded-2xl border border-neutral-300 bg-white px-4 py-4 space-y-3">
              <div className="text-sm font-medium text-neutral-900">发送模式</div>
              <p className="text-sm text-neutral-500">Telegram 直发适合用户、群组、频道；如果目标是另一个 bot，请改用 Webhook 转发。</p>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    name="delivery_mode"
                    checked={form.delivery_mode === 'telegram_chat'}
                    onChange={() => setForm({ ...form, delivery_mode: 'telegram_chat' })}
                  />
                  Telegram 直发
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    name="delivery_mode"
                    checked={form.delivery_mode === 'webhook'}
                    onChange={() => setForm({ ...form, delivery_mode: 'webhook' })}
                  />
                  Webhook 转发
                </label>
              </div>
            </div>

            {form.delivery_mode === 'telegram_chat' && (
              <>
                <div className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4">
                  <div className="text-sm font-medium text-neutral-900">Telegram 直发说明</div>
                  <p className="mt-1 text-sm text-neutral-500">适合直接发给用户、群组、频道。如果目标是另一个 bot，这种方式不可用，请切换到 Webhook 转发。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Bot Token"
                    hint={settings?.telegram_chat.has_bot_token ? '已配置，留空则不修改；如需删除，请勾选下方“清空已保存 Token”。' : '未配置时请直接输入新的 Bot Token。'}
                  >
                    <div className="space-y-2">
                      <input
                        className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                        type="password"
                        placeholder={settings?.telegram_chat.has_bot_token ? '已配置，留空则不修改' : '输入新的 Bot Token'}
                        value={form.telegram_chat.bot_token}
                        onChange={(e) => {
                          setClearBotToken(false);
                          setForm({
                            ...form,
                            telegram_chat: { ...form.telegram_chat, bot_token: e.target.value },
                          });
                        }}
                      />
                      {settings?.telegram_chat.has_bot_token && (
                        <div className="text-xs text-neutral-500">当前已保存：{settings.telegram_chat.bot_token_masked}</div>
                      )}
                    </div>
                  </FormField>

                  <FormField label="Chat ID" hint="例如群组 chat id 通常是 -100 开头。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      placeholder="-1001234567890"
                      value={form.telegram_chat.chat_id}
                      onChange={(e) => setForm({
                        ...form,
                        telegram_chat: { ...form.telegram_chat, chat_id: e.target.value },
                      })}
                    />
                  </FormField>

                  <FormField label="API Base" hint="默认使用官方 Telegram API 地址。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      placeholder="https://api.telegram.org"
                      value={form.telegram_chat.api_base}
                      onChange={(e) => setForm({
                        ...form,
                        telegram_chat: { ...form.telegram_chat, api_base: e.target.value },
                      })}
                    />
                  </FormField>

                  <FormField label="超时(ms)" hint="请求 Telegram API 的超时控制。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      type="number"
                      min="1"
                      step="1"
                      value={form.telegram_chat.timeout_ms}
                      onChange={(e) => setForm({
                        ...form,
                        telegram_chat: { ...form.telegram_chat, timeout_ms: e.target.value },
                      })}
                    />
                  </FormField>
                </div>

                {settings?.telegram_chat.has_bot_token && (
                  <label className="inline-flex items-center gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300"
                      checked={clearBotToken}
                      onChange={(e) => {
                        setClearBotToken(e.target.checked);
                        if (e.target.checked) {
                          setForm({
                            ...form,
                            telegram_chat: { ...form.telegram_chat, bot_token: '' },
                          });
                        }
                      }}
                    />
                    清空已保存 Bot Token
                  </label>
                )}
              </>
            )}

            {form.delivery_mode === 'webhook' && (
              <>
                <div className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4">
                  <div className="text-sm font-medium text-neutral-900">Webhook 转发说明</div>
                  <p className="mt-1 text-sm text-neutral-500">如果你的 bot 需要接收事件，请让 GateRank 调用你控制的 Webhook，再由你的 bot 自己处理这条请求。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Webhook URL" hint="GateRank 会向这个地址 POST 申请通知事件。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      placeholder="https://example.com/webhooks/gaterank"
                      value={form.webhook.url}
                      onChange={(e) => setForm({
                        ...form,
                        webhook: { ...form.webhook, url: e.target.value },
                      })}
                    />
                  </FormField>

                  <FormField
                    label="Bearer Token"
                    hint={settings?.webhook.has_bearer_token ? '已配置，留空则不修改；如需删除，请勾选下方“清空已保存 Bearer Token”。' : '用于 Authorization: Bearer ... 鉴权。'}
                  >
                    <div className="space-y-2">
                      <input
                        className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                        type="password"
                        placeholder={settings?.webhook.has_bearer_token ? '已配置，留空则不修改' : '输入新的 Bearer Token'}
                        value={form.webhook.bearer_token}
                        onChange={(e) => {
                          setClearWebhookBearerToken(false);
                          setForm({
                            ...form,
                            webhook: { ...form.webhook, bearer_token: e.target.value },
                          });
                        }}
                      />
                      {settings?.webhook.has_bearer_token && (
                        <div className="text-xs text-neutral-500">当前已保存：{settings.webhook.bearer_token_masked}</div>
                      )}
                    </div>
                  </FormField>

                  <FormField label="超时(ms)" hint="请求 Webhook 的超时控制。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      type="number"
                      min="1"
                      step="1"
                      value={form.webhook.timeout_ms}
                      onChange={(e) => setForm({
                        ...form,
                        webhook: { ...form.webhook, timeout_ms: e.target.value },
                      })}
                    />
                  </FormField>
                </div>

                {settings?.webhook.has_bearer_token && (
                  <label className="inline-flex items-center gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300"
                      checked={clearWebhookBearerToken}
                      onChange={(e) => {
                        setClearWebhookBearerToken(e.target.checked);
                        if (e.target.checked) {
                          setForm({
                            ...form,
                            webhook: { ...form.webhook, bearer_token: '' },
                          });
                        }
                      }}
                    />
                    清空已保存 Bearer Token
                  </label>
                )}
              </>
            )}

            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

            <div className="flex items-center justify-end gap-3">
              <button className="px-4 py-2.5 rounded-2xl border border-neutral-300 text-sm font-medium disabled:opacity-50" disabled={testing} onClick={() => void sendTest()}>
                {testing ? '发送中...' : form.delivery_mode === 'telegram_chat' ? '发送 Telegram 测试消息' : '发送 Webhook 测试请求'}
              </button>
              <button className="px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-medium disabled:opacity-50" disabled={saving} onClick={() => void save()}>
                {saving ? '保存中...' : '保存配置'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function AirportsPage({ onOpenAirport }: { onOpenAirport: (id: number) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Airport[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'' | AirportStatus>('');
  const [editing, setEditing] = useState<AirportFormState | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (keyword) query.set('keyword', keyword);
      if (status) query.set('status', status);
      const data = (await apiFetch(`/api/v1/admin/airports?${query.toString()}`)) as { items: Airport[] };
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchList();
  }, []);

  const saveAirport = async () => {
    if (!editing) return;
    const websites = normalizeUrlList(editing.websites);
    if (!editing.name.trim()) {
      setFormError('请填写机场名称');
      return;
    }
    if (websites.length === 0) {
      setFormError('至少填写一个官网链接');
      return;
    }

    const body = {
      name: editing.name.trim(),
      website: websites[0],
      websites,
      status: editing.status,
      plan_price_month: Number(editing.plan_price_month || 0),
      has_trial: Boolean(editing.has_trial),
      subscription_url: editing.subscription_url.trim() || null,
      applicant_email: editing.applicant_email.trim() || null,
      applicant_telegram: editing.applicant_telegram.trim() || null,
      founded_on: editing.founded_on || null,
      airport_intro: editing.airport_intro.trim() || null,
      test_account: editing.test_account.trim() || null,
      test_password: editing.test_password || null,
      tags: editing.tags || [],
    };

    setSaving(true);
    setFormError('');
    try {
      if (!editing.id) {
        await apiFetch('/api/v1/admin/airports', { method: 'POST', body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/v1/admin/airports/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }

      setEditing(null);
      await fetchList();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold">机场管理</h2>
        <button
          className="px-3 py-2 rounded bg-neutral-900 text-white text-sm"
          onClick={() => {
            setFormError('');
            setEditing(createAirportForm());
          }}
        >
          <span className="inline-flex items-center gap-2"><Plus size={14} />新增机场</span>
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-neutral-400" />
          <input
            className="border rounded pl-7 pr-3 py-2 text-sm"
            placeholder="搜索名称 / 官网 / 备用网址"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <select className="border rounded px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as '' | AirportStatus)}>
          <option value="">全部状态</option>
          <option value="normal">正常</option>
          <option value="risk">风险</option>
          <option value="down">跑路</option>
        </select>
        <button className="px-3 py-2 text-sm rounded border" onClick={() => void fetchList()}>查询</button>
      </div>

      {error && <div className="text-sm text-rose-600">{error}</div>}
      {loading ? <div className="text-sm text-neutral-500">加载中...</div> : (
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-[1180px] table-fixed text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="w-[14%] text-left px-4 py-3">名称</th>
                <th className="w-[24%] text-left px-4 py-3">网站</th>
                <th className="w-[8%] text-left px-4 py-3">状态</th>
                <th className="w-[7%] text-left px-4 py-3">月价</th>
                <th className="w-[7%] text-left px-4 py-3">试用</th>
                <th className="w-[28%] text-left px-4 py-3">订阅链接</th>
                <th className="sticky right-0 z-20 w-[12%] text-left px-4 py-3 bg-neutral-50 border-l border-neutral-200 shadow-[-8px_0_16px_-12px_rgba(0,0,0,0.18)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-neutral-100 align-middle">
                  <td className="px-4 py-3">
                    <div className="font-medium whitespace-nowrap">{it.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="block truncate text-neutral-700" title={formatWebsiteList(it.websites, it.website)}>
                        {it.website}
                      </span>
                      {(it.websites?.length || 0) > 1 && (
                        <span className="text-xs text-neutral-500">另有 {it.websites!.length - 1} 个备用网址</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatAirportStatus(it.status)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{it.plan_price_month}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{it.has_trial ? '是' : '否'}</td>
                  <td className="px-4 py-3">
                    {it.subscription_url ? (
                      <span className="block truncate text-neutral-700" title={it.subscription_url}>
                        {it.subscription_url}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="sticky right-0 z-10 px-4 py-3 bg-white border-l border-neutral-200 shadow-[-8px_0_16px_-12px_rgba(0,0,0,0.14)]">
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <button className="underline" onClick={() => {
                        setFormError('');
                        setEditing(toAirportForm(it));
                      }}>编辑</button>
                      <button className="underline" onClick={() => onOpenAirport(it.id)}>数据台</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[88vh] rounded-[28px] border border-neutral-200 bg-white shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col">
            <div className="border-b border-neutral-200 px-6 py-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight">{editing.id ? '编辑机场' : '新增机场'}</h3>
                <p className="text-sm text-neutral-500">字段标题、分组和辅助说明已拆清楚。第一条官网会作为主域名用于列表展示与搜索。</p>
              </div>
              <button
                type="button"
                className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
                onClick={() => setEditing(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6 overscroll-contain">
              <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">基础信息</div>
                  <p className="mt-1 text-sm text-neutral-500">先把识别信息填完整，再补上价格、状态与是否支持试用。</p>
                </div>

                <FormField label="机场名称" hint="用于管理列表、数据台标题与榜单识别。">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="例如：大象网络"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </FormField>

                <FormField label="月付价格" hint="用于性价比计算，单位按元处理。">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="例如：10"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.plan_price_month}
                    onChange={(e) => setEditing({ ...editing, plan_price_month: e.target.value })}
                  />
                </FormField>

                <FormField label="运行状态" hint="控制榜单与管理列表的状态展示。">
                  <select
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value as AirportStatus })}
                  >
                    <option value="normal">正常</option>
                    <option value="risk">风险</option>
                    <option value="down">跑路</option>
                  </select>
                </FormField>

                <div className="rounded-2xl border border-neutral-300 bg-white px-4 py-4">
                  <div className="text-sm font-medium text-neutral-900">试用支持</div>
                  <p className="mt-1 text-sm text-neutral-500">用于新手友好类标签判断，也方便运营快速筛选。</p>
                  <label className="mt-4 inline-flex items-center gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300"
                      checked={editing.has_trial}
                      onChange={(e) => setEditing({ ...editing, has_trial: e.target.checked })}
                    />
                    支持试用
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">联系与审核信息</div>
                  <p className="mt-1 text-sm text-neutral-500">这些字段与入驻申请保持一致，正式机场创建后也可在这里维护。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="联系邮箱" hint="用于运营联系或回查申请记录。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      placeholder="contact@example.com"
                      type="email"
                      value={editing.applicant_email}
                      onChange={(e) => setEditing({ ...editing, applicant_email: e.target.value })}
                    />
                  </FormField>

                  <FormField label="Telegram" hint="用于快速联系机场运营方。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      placeholder="@telegram"
                      value={editing.applicant_telegram}
                      onChange={(e) => setEditing({ ...editing, applicant_telegram: e.target.value })}
                    />
                  </FormField>

                  <FormField label="成立日期" hint="可选，沿用入驻申请的成立时间。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      type="date"
                      value={editing.founded_on}
                      onChange={(e) => setEditing({ ...editing, founded_on: e.target.value })}
                    />
                  </FormField>

                  <FormField label="测试账号" hint="审核或排障时可用的账号。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      placeholder="测试账号"
                      value={editing.test_account}
                      onChange={(e) => setEditing({ ...editing, test_account: e.target.value })}
                    />
                  </FormField>

                  <FormField label="测试密码" hint="为空则表示不更新或暂未提供。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      type="text"
                      placeholder="测试密码"
                      value={editing.test_password}
                      onChange={(e) => setEditing({ ...editing, test_password: e.target.value })}
                    />
                  </FormField>
                </div>

                <FormField label="机场基本介绍" hint="用于保存服务定位、节点特色或补充说明。">
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="介绍机场特色、节点地区、适用人群等。"
                    value={editing.airport_intro}
                    onChange={(e) => setEditing({ ...editing, airport_intro: e.target.value })}
                  />
                </FormField>
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">官网配置</div>
                  <p className="mt-1 text-sm text-neutral-500">支持多个域名，方便录入主站与备用网址。第一条会自动作为主官网。</p>
                </div>

                <div className="space-y-4">
                  {editing.websites.map((website, index) => (
                    <div key={`website-${index}`}>
                      <FormField
                        label={index === 0 ? '主官网链接' : `备用网址 ${index}`}
                        hint={index === 0 ? '建议填写当前主站地址。' : '备用网址会一并保存，方便应对域名切换。'}
                      >
                        <div className="space-y-3">
                          <input
                            className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                            placeholder="https://example.com"
                            value={website}
                            onChange={(e) => setEditing({
                              ...editing,
                              websites: updateListItem(editing.websites, index, e.target.value),
                            })}
                          />
                          <button
                            type="button"
                            className="rounded-2xl border border-neutral-300 px-3 py-3 text-sm text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={editing.websites.length === 1}
                            onClick={() => setEditing({
                              ...editing,
                              websites: removeListItem(editing.websites, index),
                            })}
                          >
                            <span className="inline-flex items-center gap-2"><Trash2 size={14} />删除</span>
                          </button>
                        </div>
                      </FormField>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="w-full rounded-2xl border border-dashed border-neutral-400 px-4 py-3 text-sm font-medium text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                  onClick={() => setEditing({ ...editing, websites: [...editing.websites, ''] })}
                >
                  <span className="inline-flex items-center gap-2"><Plus size={14} />继续添加官网链接</span>
                </button>

                <FormField label="订阅链接" hint="可选。如果和官网不同，单独录入更方便运营排查。">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="https://example.com/subscribe"
                    value={editing.subscription_url}
                    onChange={(e) => setEditing({ ...editing, subscription_url: e.target.value })}
                  />
                </FormField>
              </section>

              {formError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>}
            </div>

            <div className="border-t border-neutral-200 px-6 py-5 flex items-center justify-end gap-3 bg-white">
              <button className="px-4 py-2.5 rounded-2xl border border-neutral-300 text-sm font-medium" onClick={() => setEditing(null)}>
                取消
              </button>
              <button
                className="px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-medium disabled:opacity-50"
                disabled={saving}
                onClick={() => void saveAirport()}
              >
                {saving ? '保存中...' : '保存机场'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationsPage({ onOpenAirports }: { onOpenAirports: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<AirportApplication[]>([]);
  const [keyword, setKeyword] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'' | AirportApplicationReviewStatus>('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<AirportApplication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [reviewAction, setReviewAction] = useState<'reviewed' | 'rejected'>('reviewed');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (keyword) query.set('keyword', keyword);
      if (reviewStatus) query.set('review_status', reviewStatus);
      const data = (await apiFetch(`/api/v1/admin/airport-applications?${query.toString()}`)) as {
        items: AirportApplication[];
      };
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetailError('');
    setSelected(null);
    setReviewNote('');
    setReviewAction('reviewed');
    try {
      const data = (await apiFetch(`/api/v1/admin/airport-applications/${id}`)) as AirportApplication;
      setSelected(data);
      setReviewAction(data.review_status === 'rejected' ? 'rejected' : 'reviewed');
      setReviewNote(data.review_note || '');
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : '详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const submitReview = async () => {
    if (!selectedId || !selected) return;
    if (selected.review_status !== 'pending') {
      setDetailError('该申请已处理，不能再次修改');
      return;
    }
    setReviewSaving(true);
    setDetailError('');
    try {
      const data = (await apiFetch(`/api/v1/admin/airport-applications/${selectedId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          review_status: reviewAction,
          review_note: reviewNote.trim() || null,
        }),
      })) as AirportApplication;
      setSelected(data);
      await fetchList();
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : '审核失败');
    } finally {
      setReviewSaving(false);
    }
  };

  useEffect(() => {
    void fetchList();
  }, []);

  const isReviewLocked = selected?.review_status !== 'pending';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">入驻申请</h2>
          <p className="mt-1 text-sm text-neutral-500">公开申请会先进入待审核列表，确认资料后再人工处理。</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-neutral-400" />
          <input
            className="border rounded pl-7 pr-3 py-2 text-sm"
            placeholder="搜索机场 / 邮箱 / Telegram / 官网"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <select
          className="border rounded px-3 py-2 text-sm"
          value={reviewStatus}
          onChange={(e) => setReviewStatus(e.target.value as '' | AirportApplicationReviewStatus)}
        >
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="reviewed">已审核</option>
          <option value="rejected">已驳回</option>
        </select>
        <button className="px-3 py-2 text-sm rounded border" onClick={() => void fetchList()}>查询</button>
      </div>

      {error && <div className="text-sm text-rose-600">{error}</div>}
      {loading ? (
        <div className="text-sm text-neutral-500">加载中...</div>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-[1120px] table-fixed text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="w-[18%] text-left px-4 py-3">机场名称</th>
                <th className="w-[18%] text-left px-4 py-3">邮箱</th>
                <th className="w-[14%] text-left px-4 py-3">Telegram</th>
                <th className="w-[12%] text-left px-4 py-3">成立日期</th>
                <th className="w-[16%] text-left px-4 py-3">提交时间</th>
                <th className="w-[10%] text-left px-4 py-3">审核状态</th>
                <th className="w-[12%] text-left px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-neutral-100 align-middle">
                  <td className="px-4 py-3">
                    <div className="font-medium whitespace-nowrap">{item.name}</div>
                    <div className="mt-1 text-xs text-neutral-500 truncate" title={item.website}>{item.website}</div>
                  </td>
                  <td className="px-4 py-3 truncate" title={item.applicant_email}>{item.applicant_email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.applicant_telegram}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.founded_on}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.created_at}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatApplicationReviewStatus(item.review_status)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button className="underline" onClick={() => void openDetail(item.id)}>查看详情</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-neutral-500">
                    当前没有匹配的申请记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-[28px] border border-neutral-200 bg-white shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col">
            <div className="border-b border-neutral-200 px-6 py-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight">申请详情</h3>
                <p className="text-sm text-neutral-500">查看申请资料并执行审核或驳回。</p>
              </div>
              <button
                type="button"
                className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
                onClick={() => {
                  setSelectedId(null);
                  setSelected(null);
                  setDetailError('');
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6 overscroll-contain">
              {detailLoading && <div className="text-sm text-neutral-500">详情加载中...</div>}
              {detailError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{detailError}</div>}

              {selected && (
                <>
                  <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">基础信息</div>
                      <p className="mt-1 text-sm text-neutral-500">公开申请中提交的机场字段。</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ReadField label="机场名称" value={selected.name} />
                      <ReadField label="运行状态" value={`${formatAirportStatus(selected.status)} / ${formatApplicationReviewStatus(selected.review_status)}`} />
                      <ReadField label="月付价格" value={selected.plan_price_month} />
                      <ReadField label="试用支持" value={selected.has_trial ? '是' : '否'} />
                      <ReadField label="订阅链接" value={valueOrDash(selected.subscription_url)} />
                      <ReadField label="成立日期" value={selected.founded_on} />
                    </div>
                    <ReadField label="官网列表" value={formatWebsiteList(selected.websites, selected.website)} />
                  </section>

                  <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">申请与测试信息</div>
                      <p className="mt-1 text-sm text-neutral-500">仅详情页展示测试账号与密码。</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ReadField label="联系邮箱" value={selected.applicant_email} />
                      <ReadField label="Telegram" value={selected.applicant_telegram} />
                      <ReadField label="测试账号" value={selected.test_account} />
                      <ReadField label="测试密码" value={selected.test_password} />
                    </div>
                    <ReadField label="机场基本介绍" value={selected.airport_intro} />
                  </section>

                  <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">审核处理</div>
                      <p className="mt-1 text-sm text-neutral-500">审核会记录操作人、时间和可选备注。</p>
                    </div>
                    {isReviewLocked && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        该申请已处理，审核结果不能再次修改。
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="审核动作" hint="只支持标记为已审核或已驳回。">
                        <select
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                          value={reviewAction}
                          disabled={isReviewLocked}
                          onChange={(e) => setReviewAction(e.target.value as 'reviewed' | 'rejected')}
                        >
                          <option value="reviewed">已审核</option>
                          <option value="rejected">已驳回</option>
                        </select>
                      </FormField>
                      <FormField label="当前审核信息" hint="后台返回的最新审核状态。">
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6">
                          <div>状态：{formatApplicationReviewStatus(selected.review_status)}</div>
                          <div>处理人：{valueOrDash(selected.reviewed_by)}</div>
                          <div>处理时间：{valueOrDash(selected.reviewed_at)}</div>
                          <div>正式机场 ID：{valueOrDash(selected.approved_airport_id)}</div>
                        </div>
                      </FormField>
                    </div>
                    {selected.approved_airport_id && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <div className="text-sm text-emerald-800">
                          已生成正式机场 #{selected.approved_airport_id}，可前往机场管理继续维护资料。
                        </div>
                        <button
                          type="button"
                          className="rounded-2xl border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-900"
                          onClick={onOpenAirports}
                        >
                          前往机场管理
                        </button>
                      </div>
                    )}
                    <FormField label="审核备注" hint="可选，适合记录核验结果或补充说明。">
                      <textarea
                        className="min-h-28 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                        value={reviewNote}
                        disabled={isReviewLocked}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="可选备注"
                      />
                    </FormField>
                  </section>
                </>
              )}
            </div>

            <div className="border-t border-neutral-200 px-6 py-5 flex items-center justify-end gap-3 bg-white">
              <button
                className="px-4 py-2.5 rounded-2xl border border-neutral-300 text-sm font-medium"
                onClick={() => {
                  setSelectedId(null);
                  setSelected(null);
                  setDetailError('');
                }}
              >
                关闭
              </button>
              <button
                className="px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-medium disabled:opacity-50"
                disabled={reviewSaving || !selected || isReviewLocked}
                onClick={() => void submitReview()}
              >
                {reviewSaving ? '提交中...' : isReviewLocked ? '已处理' : '保存审核结果'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AirportDataPage({ airportId, onBack }: { airportId: number; onBack: () => void }) {
  const [date, setDate] = useState(today());
  const [dashboard, setDashboard] = useState<AirportDashboardView | null>(null);
  const [recentStabilitySamples, setRecentStabilitySamples] = useState<ProbeSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<DashboardTab>('base');
  const [message, setMessage] = useState('');
  const [samplesError, setSamplesError] = useState('');
  const [job, setJob] = useState<ManualJobRecord | null>(null);
  const [jobMessage, setJobMessage] = useState('');
  const [jobTone, setJobTone] = useState<'neutral' | 'success' | 'error'>('neutral');

  const load = async () => {
    setLoading(true);
    setError('');
    setSamplesError('');
    try {
      const data = (await apiFetch(
        `/api/v1/admin/airports/${airportId}/dashboard?date=${date}`,
      )) as AirportDashboardView;
      setDashboard(data);
      await loadSamplesOnly();
    } catch (err) {
      setDashboard(null);
      setError(err instanceof Error ? err.message : '加载失败');
      setRecentStabilitySamples([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSamplesOnly = async () => {
    try {
      const samples = (await apiFetch(
        `/api/v1/admin/airports/${airportId}/probe-samples?latest=1&limit=20&scope=stability`,
      )) as { items: ProbeSample[] };
      setRecentStabilitySamples(
        (samples.items || []).filter((item) => item.sample_type === 'availability' || item.sample_type === 'latency'),
      );
      setSamplesError('');
    } catch (err) {
      setRecentStabilitySamples([]);
      setSamplesError(err instanceof Error ? err.message : '采样加载失败');
    } finally {
      // no-op
    }
  };

  useEffect(() => {
    setJob(null);
    setJobMessage('');
    setJobTone('neutral');
    void load();
  }, [airportId, date]);

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const nextJob = (await apiFetch(`/api/v1/admin/manual-jobs/${job.id}`)) as ManualJobRecord;
          setJob(nextJob);
          if (nextJob.status === 'queued') {
            setJobTone('neutral');
            setJobMessage(nextJob.message || '任务已创建，等待执行');
            return;
          }
          if (nextJob.status === 'running') {
            setJobTone('neutral');
            setJobMessage(nextJob.message || '任务执行中...');
            return;
          }
          if (nextJob.status === 'succeeded') {
            setJobTone('success');
            setJobMessage(nextJob.message || '任务执行完成');
            await load();
            return;
          }
          setJobTone('error');
          setJobMessage(nextJob.message || '任务执行失败');
        } catch (err) {
          setJobTone('error');
          setJobMessage(err instanceof Error ? err.message : '任务状态查询失败');
        }
      })();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [job, airportId, date]);

  const createManualJob = async (kind: ManualJobKind) => {
    try {
      setMessage('');
      const nextJob = (await apiFetch(`/api/v1/admin/airports/${airportId}/manual-jobs`, {
        method: 'POST',
        body: JSON.stringify({ kind, date }),
      })) as ManualJobRecord;
      setJob(nextJob);
      setJobTone('neutral');
      setJobMessage(nextJob.message || '任务已创建，等待执行');
    } catch (err) {
      setJobTone('error');
      setJobMessage(err instanceof Error ? err.message : '执行失败');
    }
  };

  const moveDate = (offsetDays: number) => {
    setDate((current) => shiftDate(current, offsetDays));
  };

  const tabs = useMemo(() => [
    { key: 'base', label: '基础信息' },
    { key: 'stability', label: '稳定性数据（S）' },
    { key: 'performance', label: '性能数据（P）' },
    { key: 'risk', label: '风险数据（R）' },
    { key: 'time_decay', label: '时间维度（衰减）' },
  ] as const, []);

  const hasStabilityData = useMemo(() => {
    if (!dashboard) return false;
    const d = dashboard.stability;
    if ((d.latency_samples_ms || []).length > 0) return true;
    return [
      d.uptime_percent_today,
      d.uptime_percent_30d,
      d.latency_mean_ms,
      d.latency_std_ms,
      d.latency_cv,
      d.stable_days_streak,
      d.is_stable_day,
      d.s,
      d.uptime_score,
      d.stability_score,
      d.streak_score,
    ]
      .some((v) => v !== null && v !== undefined);
  }, [dashboard]);

  const hasPerformanceData = useMemo(() => {
    if (!dashboard) return false;
    const d = dashboard.performance;
    if (d.collect_status || d.error_code || d.error_message) return true;
    return [
      d.median_latency_ms,
      d.median_download_mbps,
      d.packet_loss_percent,
      d.p,
      d.latency_score,
      d.speed_score,
      d.loss_score,
    ].some((v) => v !== null && v !== undefined);
  }, [dashboard]);

  const hasRiskData = useMemo(() => {
    if (!dashboard) return false;
    const d = dashboard.risk;
    return [
      d.domain_ok,
      d.ssl_days_left,
      d.recent_complaints_count,
      d.history_incidents,
      d.domain_penalty,
      d.ssl_penalty,
      d.complaint_penalty,
      d.history_penalty,
      d.total_penalty,
      d.risk_penalty,
      d.r,
      d.risk_level,
    ]
      .some((v) => v !== null && v !== undefined);
  }, [dashboard]);

  const hasTimeDecayData = useMemo(() => {
    if (!dashboard) return false;
    const d = dashboard.time_decay;
    return [d.date, d.recent_score_cache, d.historical_score_cache, d.score, d.recent_score, d.historical_score, d.final_score]
      .some((v) => v !== null && v !== undefined);
  }, [dashboard]);

  const isTodayDate = date === today();
  const jobPending = job?.status === 'queued' || job?.status === 'running';
  const jobToneClass = jobTone === 'error'
    ? 'border border-rose-200 bg-rose-50 text-rose-700'
    : jobTone === 'success'
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border border-sky-200 bg-sky-50 text-sky-700';
  const currentTabAction = useMemo(() => {
    if (tab === 'base') {
      return {
        title: '手动重跑',
        description: isTodayDate
          ? '会顺序执行稳定性采集、性能采集、风险体检，再聚合并重算当前机场当日数据。'
          : '当前为历史日期，仅基于已有样本重新聚合并重算当前机场当日数据。',
        buttonLabel: '重跑当前机场当日全链路',
        kind: 'full' as const,
      };
    }
    if (tab === 'stability') {
      return {
        title: '稳定性手动执行',
        description: isTodayDate
          ? '立即重新采集稳定性样本，并在完成后聚合与重算当前机场。'
          : '当前为历史日期，不触发实时采集，仅重算已有稳定性相关数据。',
        buttonLabel: isTodayDate ? '重新采集并重算稳定性' : '重算已有稳定性数据',
        kind: 'stability' as const,
      };
    }
    if (tab === 'performance') {
      return {
        title: '性能手动执行',
        description: isTodayDate
          ? '立即重新拉取订阅并执行性能采样，随后聚合与重算当前机场。'
          : '当前为历史日期，不触发实时采集，仅重算已有性能相关数据。',
        buttonLabel: isTodayDate ? '重新采集并重算性能' : '重算已有性能数据',
        kind: 'performance' as const,
      };
    }
    if (tab === 'risk') {
      return {
        title: '风险手动执行',
        description: isTodayDate
          ? '立即重新检查官网可用性与 SSL 剩余天数，并重算当前机场风险分。'
          : '当前为历史日期，不触发实时体检，仅重算已有风险相关数据。',
        buttonLabel: isTodayDate ? '重新体检并重算风险' : '重算已有风险数据',
        kind: 'risk' as const,
      };
    }
    return {
      title: '时间维度手动执行',
      description: '仅重算当前机场在所选日期下的衰减分与榜单位置，不触发任何采集。',
      buttonLabel: '重算当前机场衰减分',
      kind: 'time_decay' as const,
    };
  }, [tab, isTodayDate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <button className="px-3 py-1.5 rounded border text-sm inline-flex items-center gap-2" onClick={onBack}>
            <ArrowLeft size={14} />
            返回列表
          </button>
          <h2 className="text-lg font-bold">机场数据工作台 {dashboard?.base ? `- ${dashboard.base.name}` : `#${airportId}`}</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            className="px-3 py-1.5 rounded border text-sm inline-flex items-center gap-2 bg-white"
            href={`/reports/${airportId}?date=${date}`}
            target="_blank"
            rel="noreferrer"
          >
            用户端预览
          </a>
          <button
            type="button"
            className="px-2 py-1.5 rounded border text-sm inline-flex items-center gap-1"
            onClick={() => moveDate(-1)}
          >
            <ChevronLeft size={14} />
            前一天
          </button>
          <input type="date" className="border rounded px-2 py-1.5 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          <button
            type="button"
            className="px-2 py-1.5 rounded border text-sm inline-flex items-center gap-1"
            onClick={() => moveDate(1)}
          >
            后一天
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {message && <div className="text-sm text-emerald-700">{message}</div>}
      {jobMessage && <div className={`rounded-2xl px-4 py-3 text-sm ${jobToneClass}`}>{jobMessage}</div>}
      {loading && <div className="text-sm text-neutral-500">加载中...</div>}
      {!isTodayDate && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          当前为历史日期。稳定性、性能和风险页的手动按钮会退化为仅重算已有数据，不会触发实时采集。
        </div>
      )}

      <div className="flex gap-2 border-b pb-2">
        {tabs.map((t) => (
          <button key={t.key} className={`px-3 py-1.5 rounded text-sm ${tab === t.key ? 'bg-neutral-900 text-white' : 'bg-neutral-100'}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <ManualJobActionCard
        title={currentTabAction.title}
        description={currentTabAction.description}
        buttonLabel={currentTabAction.buttonLabel}
        disabled={jobPending}
        onRun={() => void createManualJob(currentTabAction.kind)}
      />

      {tab === 'base' && dashboard?.base && (
        <div className="space-y-4">
          <div className="rounded border border-neutral-200 bg-white p-4">
            <div className="text-sm font-semibold text-neutral-900">总分公式</div>
            <div className="mt-2 text-xs text-neutral-500 whitespace-pre-wrap">
              {'w = exp(-0.1 * days_diff)\n'}
              {'S = 时间衰减加权后的稳定性分\n'}
              {'P = 时间衰减加权后的性能分\n'}
              {'R = 时间衰减加权后的风险分\n'}
              {'C = clamp(100 - 月价, 0, 100)\n'}
              {'有效数据天数 = min(S序列天数, P序列天数)\n'}
              {'冷启动系数 = min(有效数据天数 / 7, 1)\n'}
              {'总分 = (0.4*S + 0.3*P + 0.2*R + 0.1*C) * 冷启动系数'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <ReadField label="名称" value={dashboard.base.name} />
            <ReadField label="官网" value={formatWebsiteList(dashboard.base.websites, dashboard.base.website)} />
            <ReadField label="状态" value={dashboard.base.status} />
            <ReadField label="月价" value={dashboard.base.plan_price_month} />
            <ReadField label="总分" value={valueOrDash(dashboard.base.total_score)} />
            <ReadField label="价格评分 (C)" value={valueOrDash(dashboard.base.price_score)} />
            <ReadField label="试用" value={dashboard.base.has_trial ? '是' : '否'} />
            <ReadField label="有效数据天数" value={valueOrDash(dashboard.base.score_data_days)} />
            <ReadField label="订阅链接" value={dashboard.base.subscription_url || '-'} />
            <ReadField label="标签" value={(dashboard.base.tags || []).join(', ') || '-'} />
          </div>
        </div>
      )}

      {tab === 'stability' && (
        hasStabilityData && dashboard ? (
          <div className="space-y-4">
            <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-semibold text-neutral-900">稳定性判定</div>
              <div className="mt-1 text-xs text-neutral-500 whitespace-pre-wrap">
                {'稳定日规则：`uptime >= 99%` 且 `effective_latency_cv <= 0.20`，并且当日存在有效延迟样本。\n'}
                {'原始 `latency_cv` 仅用于诊断；实际判定会对 5 个及以上样本去掉 1 个最大值和 1 个最小值，并对低延迟均值使用 10ms 地板。'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <ReadField label="今日可用率 (uptime_percent_today)" value={valueOrDash(dashboard.stability.uptime_percent_today)} />
              <ReadField label="30天可用率 (uptime_percent_30d)" value={valueOrDash(dashboard.stability.uptime_percent_30d)} />
              <ReadField label="延迟均值ms (latency_mean_ms)" value={valueOrDash(dashboard.stability.latency_mean_ms)} />
              <ReadField label="延迟标准差ms (latency_std_ms)" value={valueOrDash(dashboard.stability.latency_std_ms)} />
              <ReadField label="延迟CV-原始 (latency_cv)" value={valueOrDash(dashboard.stability.latency_cv)} />
              <ReadField label="延迟CV-判定 (effective_latency_cv)" value={valueOrDash(dashboard.stability.effective_latency_cv)} />
              <ReadField label="是否稳定日 (is_stable_day)" value={dashboard.stability.is_stable_day === null ? '-' : dashboard.stability.is_stable_day ? '是' : '否'} />
              <ReadField label="连续稳定天数 (stable_days_streak)" value={valueOrDash(dashboard.stability.stable_days_streak)} />
              <ReadField label="延迟采样ms (latency_samples_ms)" value={valueOrDash((dashboard.stability.latency_samples_ms || []).join(', ') || '-')} />
              <ReadField label="规则版本 (stability_rule_version)" value={dashboard.stability.stability_rule_version || '-'} />
            </div>

            <div className="rounded border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">评分公式</div>
              <div className="mt-2 text-xs text-neutral-500 whitespace-pre-wrap">
                {'UptimeScore = clamp((Uptime% - 95) * 20, 0, 100)\n'}
                {'StabilityScore = clamp(100 - effective_latency_cv * 100, 0, 100)\n'}
                {'StreakScore = min(stable_days_streak / 30 * 100, 100)\n'}
                {'S = 0.5 * UptimeScore + 0.3 * StabilityScore + 0.2 * StreakScore'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <ReadField label="可用率评分 (uptime_score)" value={valueOrDash(dashboard.stability.uptime_score)} />
              <ReadField label="稳定评分 (stability_score)" value={valueOrDash(dashboard.stability.stability_score)} />
              <ReadField label="连稳评分 (streak_score)" value={valueOrDash(dashboard.stability.streak_score)} />
              <ReadField label="稳定性总分 (S)" value={valueOrDash(dashboard.stability.s)} />
            </div>

            <div className="rounded border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">最近 20 次稳定性采样时间线</div>
                  <div className="mt-1 text-xs text-neutral-500">展示最近的 availability / latency 样本，便于核对 cron 上报与日内波动。</div>
                </div>
                <button
                  type="button"
                  className="rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700"
                  onClick={() => void loadSamplesOnly()}
                >
                  刷新采样
                </button>
              </div>
              {samplesError && <div className="mt-3 text-xs text-rose-600">{samplesError}</div>}
              {recentStabilitySamples.length === 0 ? (
                <div className="mt-3 text-sm text-neutral-500">暂无采样记录</div>
              ) : (
                <div className="mt-4 space-y-2">
                  {recentStabilitySamples.map((sample) => (
                    <div key={sample.id} className="flex items-center justify-between gap-4 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-900">{formatProbeSampleLabel(sample)}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {formatSampleTime(sample.sampled_at)}
                          {' · '}
                          {sample.source || '-'}
                        </div>
                      </div>
                      <div className="shrink-0 font-mono text-xs text-neutral-700">
                        {formatProbeSampleValue(sample)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : <div className="text-sm text-neutral-500">当日暂无数据</div>
      )}

      {tab === 'performance' && (
        hasPerformanceData && dashboard ? (
          <div className="space-y-4">
            <div className="rounded border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">评分公式</div>
              <div className="mt-2 text-xs text-neutral-500 whitespace-pre-wrap">
                {'median_latency_ms 使用“节点建连延迟”，不是代理后访问第三方网页的完整耗时。\n'}
                {'median_download_mbps 使用多连接并发下载测速，比单连接更接近 Speedtest。\n'}
                {'LatencyScore = clamp((600 - median_latency_ms) / (600 - 60) * 100, 0, 100)\n'}
                {'SpeedScore = clamp((median_download_mbps - 10) / (300 - 10) * 100, 0, 100)\n'}
                {'LossScore = clamp((5 - packet_loss_percent) / (5 - 0) * 100, 0, 100)\n'}
                {'P = 0.4 * LatencyScore + 0.4 * SpeedScore + 0.2 * LossScore'}
              </div>
            </div>

            <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-semibold text-neutral-900">最近一次性能采集</div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <ReadField label="采集状态" value={valueOrDash(dashboard.performance.collect_status)} />
              <ReadField label="数据来源" value={valueOrDash(dashboard.performance.data_source_mode)} />
              <ReadField label="缓存来源日期" value={valueOrDash(dashboard.performance.cache_source_date)} />
              <ReadField label="最近采集时间" value={formatDateTimeInBeijing(dashboard.performance.last_sampled_at)} />
              <ReadField label="来源" value={valueOrDash(dashboard.performance.last_source)} />
              <ReadField label="订阅格式" value={valueOrDash(dashboard.performance.subscription_format)} />
              <ReadField label="延迟口径" value={valueOrDash(dashboard.performance.latency_measurement)} />
              <ReadField label="延迟探测目标" value={valueOrDash(dashboard.performance.latency_probe_target)} />
              <ReadField label="测速口径" value={valueOrDash(dashboard.performance.speed_measurement)} />
              <ReadField label="测速并发连接数" value={valueOrDash(dashboard.performance.speed_test_connections)} />
                <ReadField label="解析节点数" value={valueOrDash(dashboard.performance.parsed_nodes_count)} />
                <ReadField label="可用节点数" value={valueOrDash(dashboard.performance.supported_nodes_count)} />
                <ReadField label="实测节点数" value={valueOrDash(dashboard.performance.tested_nodes_count)} />
                <ReadField
                  label="已选节点"
                  value={valueOrDash(
                    (dashboard.performance.selected_nodes || []).map((node) => node.name).join(', ') || '-',
                  )}
                />
                <ReadField label="错误码" value={valueOrDash(dashboard.performance.error_code)} />
                <ReadField label="错误摘要" value={valueOrDash(dashboard.performance.error_message)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <ReadField label="节点建连延迟中位数 (median_latency_ms)" value={valueOrDash(dashboard.performance.median_latency_ms)} />
              <ReadField label="代理HTTP延迟中位数（诊断）" value={valueOrDash(dashboard.performance.proxy_http_median_latency_ms)} />
              <ReadField label="代理HTTP探测URL（诊断）" value={valueOrDash(dashboard.performance.proxy_http_test_url)} />
              <ReadField label="下载中位数 (median_download_mbps)" value={valueOrDash(dashboard.performance.median_download_mbps)} />
              <ReadField label="丢包率 (packet_loss_percent)" value={valueOrDash(dashboard.performance.packet_loss_percent)} />
              <ReadField label="性能总分 (P)" value={valueOrDash(dashboard.performance.p)} />
              <ReadField label="延迟评分 (latency_score)" value={valueOrDash(dashboard.performance.latency_score)} />
              <ReadField label="下载评分 (speed_score)" value={valueOrDash(dashboard.performance.speed_score)} />
              <ReadField label="丢包评分 (loss_score)" value={valueOrDash(dashboard.performance.loss_score)} />
            </div>

            {(dashboard.performance.tested_nodes || []).length > 0 ? (
              <div className="rounded border border-neutral-200 bg-white p-4">
                <div className="text-sm font-semibold text-neutral-900">节点明细</div>
                <div className="mt-4 space-y-3">
                  {dashboard.performance.tested_nodes.map((node) => (
                    <div key={node.name} className="rounded border border-neutral-200 bg-neutral-50 p-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <ReadField label="节点" value={valueOrDash(node.name)} />
                        <ReadField label="区域" value={valueOrDash(node.region)} />
                        <ReadField label="类型" value={valueOrDash(node.type)} />
                        <ReadField label="状态" value={valueOrDash(node.status)} />
                        <ReadField label="建连延迟中位数" value={valueOrDash(node.connect_latency_median_ms)} />
                        <ReadField label="下载速度" value={valueOrDash(node.download_mbps)} />
                        <ReadField label="代理HTTP延迟中位数" value={valueOrDash(node.proxy_http_latency_median_ms)} />
                        <ReadField label="错误码" value={valueOrDash(node.error_code)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

          </div>
        ) : <div className="text-sm text-neutral-500">当日暂无数据</div>
      )}

      {tab === 'risk' && (
        hasRiskData && dashboard ? (
          <div className="space-y-4">
            <div className="rounded border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">评分公式</div>
              <div className="mt-2 text-xs text-neutral-500 whitespace-pre-wrap">
                {'DomainPenalty = domain_ok ? 0 : 30\n'}
                {'SslPenalty = ssl_days_left 为 null 时记 5；< 0 记 30；< 7 记 20；< 15 记 10；< 30 记 5；其余记 0\n'}
                {'ComplaintPenalty = min(recent_complaints_count * 3, 15)\n'}
                {'HistoryPenalty = min(history_incidents * 10, 30)\n'}
                {'RiskPenalty = DomainPenalty + SslPenalty + ComplaintPenalty + HistoryPenalty\n'}
                {'R = clamp(100 - RiskPenalty, 0, 100)'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <ReadField label="域名是否正常 (domain_ok)" value={valueOrDash(dashboard.risk.domain_ok)} />
              <ReadField label="SSL剩余天数 (ssl_days_left)" value={valueOrDash(dashboard.risk.ssl_days_left)} />
              <ReadField label="投诉数量 (recent_complaints_count)" value={valueOrDash(dashboard.risk.recent_complaints_count)} />
              <ReadField label="历史异常 (history_incidents)" value={valueOrDash(dashboard.risk.history_incidents)} />
              <ReadField label="域名惩罚 (domain_penalty)" value={valueOrDash(dashboard.risk.domain_penalty)} />
              <ReadField label="SSL惩罚 (ssl_penalty)" value={valueOrDash(dashboard.risk.ssl_penalty)} />
              <ReadField label="投诉惩罚 (complaint_penalty)" value={valueOrDash(dashboard.risk.complaint_penalty)} />
              <ReadField label="历史惩罚 (history_penalty)" value={valueOrDash(dashboard.risk.history_penalty)} />
              <ReadField label="总惩罚 (total_penalty)" value={valueOrDash(dashboard.risk.total_penalty)} />
              <ReadField label="风险惩罚 (risk_penalty)" value={valueOrDash(dashboard.risk.risk_penalty)} />
              <ReadField label="风险评分 (R)" value={valueOrDash(dashboard.risk.r)} />
              <ReadField label="风险等级 (risk_level)" value={valueOrDash(dashboard.risk.risk_level)} />
            </div>

          </div>
        ) : <div className="text-sm text-neutral-500">当日暂无数据</div>
      )}

      {tab === 'time_decay' && (
        hasTimeDecayData && dashboard ? (
          <div className="space-y-4">
            <div className="rounded border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">评分公式</div>
              <div className="mt-2 text-xs text-neutral-500 whitespace-pre-wrap">
                {'w = exp(-lambda * days_diff)\n'}
                {'lambda = 0.1\n'}
                {'HistoricalScore = Σ(score_i * w_i) / Σ(w_i)，仅统计当前日期之前的每日 score\n'}
                {'FinalScore = Σ(score_i * w_i) / Σ(w_i)，统计历史序列 + 当日 score\n'}
                {'days_diff = 当前日期 - 样本日期（按天）'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <ReadField label="日期 (date)" value={valueOrDash(dashboard.time_decay.date || dashboard.date)} />
              <ReadField label="原始综合分 (score)" value={valueOrDash(dashboard.time_decay.score)} />
              <ReadField label="近期评分缓存 (recent_score_cache)" value={valueOrDash(dashboard.time_decay.recent_score_cache)} />
              <ReadField label="历史评分缓存 (historical_score_cache)" value={valueOrDash(dashboard.time_decay.historical_score_cache)} />
              <ReadField label="近期评分 (recent_score)" value={valueOrDash(dashboard.time_decay.recent_score)} />
              <ReadField label="历史衰减评分 (historical_score)" value={valueOrDash(dashboard.time_decay.historical_score)} />
              <ReadField label="最终衰减评分 (final_score)" value={valueOrDash(dashboard.time_decay.final_score)} />
            </div>

          </div>
        ) : <div className="text-sm text-neutral-500">当日暂无数据</div>
      )}
    </div>
  );
}

function ManualJobActionCard({
  title,
  description,
  buttonLabel,
  disabled,
  onRun,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  disabled: boolean;
  onRun: () => void;
}) {
  return (
    <div className="rounded border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-neutral-900">{title}</div>
          <div className="text-xs leading-6 text-neutral-500">{description}</div>
        </div>
        <button
          type="button"
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={disabled}
          onClick={onRun}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="border rounded p-3 bg-neutral-50">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="font-mono text-sm mt-1 whitespace-pre-wrap break-all">{value}</div>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium text-neutral-900">{label}</div>
        {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function valueOrDash(value: string | number | boolean | null | undefined): string | number {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return value;
}

function OpsRecomputePage() {
  const [date, setDate] = useState(today());
  const [output, setOutput] = useState('');

  const run = async () => {
    setOutput('处理中...');
    try {
      const agg = await apiFetch(`/api/v1/admin/jobs/aggregate?date=${date}`, { method: 'POST' });
      const rec = await apiFetch(`/api/v1/admin/scores/recompute?date=${date}`, { method: 'POST' });
      setOutput(JSON.stringify({ aggregate: agg, recompute: rec }, null, 2));
    } catch (err) {
      setOutput(err instanceof Error ? err.message : '执行失败');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">作业工具</h2>
      <div className="flex items-center gap-2">
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="px-3 py-1.5 rounded bg-neutral-900 text-white text-sm" onClick={() => void run()}>执行聚合 + 重算</button>
      </div>
      <pre className="text-xs bg-neutral-50 border rounded p-3 overflow-auto">{output}</pre>
    </div>
  );
}

function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDate(dateString: string, offsetDays: number): string {
  if (!dateString) return dateString;
  const [year, month, day] = dateString.split('-').map((part) => Number(part));
  if (!year || !month || !day) return dateString;
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

function createAirportForm(): AirportFormState {
  return {
    name: '',
    websites: [''],
    status: 'normal',
    plan_price_month: '',
    has_trial: false,
    subscription_url: '',
    applicant_email: '',
    applicant_telegram: '',
    founded_on: '',
    airport_intro: '',
    test_account: '',
    test_password: '',
    tags: [],
  };
}

function toAirportForm(airport: Airport): AirportFormState {
  return {
    id: airport.id,
    name: airport.name,
    websites: normalizeUrlList(airport.websites?.length ? airport.websites : [airport.website]),
    status: airport.status,
    plan_price_month: String(airport.plan_price_month ?? ''),
    has_trial: airport.has_trial,
    subscription_url: airport.subscription_url || '',
    applicant_email: airport.applicant_email || '',
    applicant_telegram: airport.applicant_telegram || '',
    founded_on: airport.founded_on || '',
    airport_intro: airport.airport_intro || '',
    test_account: airport.test_account || '',
    test_password: airport.test_password || '',
    tags: airport.tags || [],
  };
}

function normalizeUrlList(values: string[]): string[] {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return unique;
}

function updateListItem(values: string[], index: number, nextValue: string): string[] {
  return values.map((value, currentIndex) => (currentIndex === index ? nextValue : value));
}

function removeListItem(values: string[], index: number): string[] {
  const nextValues = values.filter((_, currentIndex) => currentIndex !== index);
  return nextValues.length > 0 ? nextValues : [''];
}

function formatWebsiteList(websites?: string[], primaryWebsite?: string): string {
  const all = normalizeUrlList([...(websites || []), primaryWebsite || '']);
  return all.length > 0 ? all.join('\n') : '-';
}

function formatAirportStatus(status: AirportStatus): string {
  if (status === 'normal') {
    return '正常';
  }
  if (status === 'risk') {
    return '风险';
  }
  return '跑路';
}

function formatApplicationReviewStatus(status: AirportApplicationReviewStatus): string {
  if (status === 'pending') {
    return '待审核';
  }
  if (status === 'reviewed') {
    return '已审核';
  }
  return '已驳回';
}

function formatProbeSampleLabel(sample: ProbeSample): string {
  if (sample.sample_type === 'availability') {
    return '官网可用性';
  }
  if (sample.sample_type === 'latency') {
    return 'TCP 延迟';
  }
  return '下载测速';
}

function formatProbeSampleValue(sample: ProbeSample): string {
  if (sample.sample_type === 'availability') {
    return sample.availability ? '可用' : '不可用';
  }
  if (sample.sample_type === 'latency') {
    return sample.latency_ms === null ? '-' : `${sample.latency_ms} ms`;
  }
  return sample.download_mbps === null ? '-' : `${sample.download_mbps} Mbps`;
}

function formatSampleTime(value: string): string {
  return formatDateTimeInBeijing(value);
}

function formatDateTimeInBeijing(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }
  const trimmed = value.trim();
  const sqlDateTimeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  const dateOnlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  const normalizedValue = sqlDateTimeMatch
    ? `${sqlDateTimeMatch[1]}T${sqlDateTimeMatch[2]}+08:00`
    : dateOnlyMatch
      ? `${dateOnlyMatch[1]}T00:00:00+08:00`
      : trimmed;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Shanghai',
  });
}
