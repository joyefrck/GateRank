import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Globe2,
  Loader2,
  Play,
  RotateCw,
  ShieldAlert,
} from 'lucide-react';

import {
  mergeStreamingEvidence,
  NETFLIX_MANUAL_TESTS,
  STREAMING_SERVICES,
  type StreamingCheckResponse,
  type StreamingMergedState,
  type StreamingReachability,
  type StreamingRegionAssessment,
  type StreamingServiceKey,
} from '../../../shared/streamingCheck';
import { withPublicBrandTitle } from '../../../shared/publicBrand';
import { getPublicToolDefinition, PUBLIC_TOOLS_INDEX_PATH } from '../../../shared/publicTools';
import { buildAbsoluteUrl, PageFrame, usePageSeo } from '../../site/publicSite';

type ReachabilityMap = Record<StreamingServiceKey, StreamingReachability>;

const INITIAL_REACHABILITY = Object.fromEntries(
  STREAMING_SERVICES.map((service) => [service.key, 'pending']),
) as ReachabilityMap;
const STREAMING_TOOL = getPublicToolDefinition('streaming_check');

const STREAMING_CHECK_FAQ = [
  {
    question: '为什么官方地区支持和基础资源探测可能不同？',
    answer: '官方地区支持来自出口国家与服务覆盖策略；基础资源探测可能被浏览器跨域策略或反机器人机制拦截，不能据此判定服务不可用。',
  },
  {
    question: 'Netflix 如何确认美区、日区或新加坡区？',
    answer: '自动结果显示当前出口地区推断；用户还可以打开对应地区的测试片源进行手动复核。',
  },
  {
    question: '检测会保存我的 IP 吗？',
    answer: '检测结果仅用于当前响应展示，不写入检测历史，也不会生成公开分享链接。',
  },
] as const;

export function StreamingCheckPage() {
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [reachability, setReachability] = useState<ReachabilityMap>(INITIAL_REACHABILITY);
  const [response, setResponse] = useState<StreamingCheckResponse | null>(null);
  const [apiError, setApiError] = useState('');

  usePageSeo({
    title: withPublicBrandTitle(STREAMING_TOOL.seo.title),
    description: STREAMING_TOOL.seo.description,
    keywords: STREAMING_TOOL.seo.keywords,
    canonicalPath: STREAMING_TOOL.href,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebApplication',
          name: 'GateRank 流媒体解锁检测',
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          url: buildAbsoluteUrl(STREAMING_TOOL.href),
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '今日推荐', item: buildAbsoluteUrl('/') },
            { '@type': 'ListItem', position: 2, name: '工具', item: buildAbsoluteUrl(PUBLIC_TOOLS_INDEX_PATH) },
            { '@type': 'ListItem', position: 3, name: '流媒体解锁检测', item: buildAbsoluteUrl(STREAMING_TOOL.href) },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: STREAMING_CHECK_FAQ.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        },
      ],
    },
  });

  const assessmentByKey = useMemo(() => new Map(
    (response?.services || []).map((item) => [item.key, item]),
  ), [response]);

  const runCheck = async () => {
    if (running) return;
    setRunning(true);
    setHasRun(true);
    setCompleted(0);
    setReachability(INITIAL_REACHABILITY);
    setResponse(null);
    setApiError('');

    const apiTask = requestStreamingCheck()
      .then(setResponse)
      .catch((error: unknown) => setApiError(getErrorMessage(error)));

    const probeTasks = STREAMING_SERVICES.map(async (service) => {
      const result = await probeService(service.probe_url);
      setReachability((current) => ({ ...current, [service.key]: result }));
      setCompleted((current) => current + 1);
    });

    await Promise.all([apiTask, ...probeTasks]);
    setRunning(false);
  };

  return (
    <PageFrame active="tools">
      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 pb-20 pt-8 text-neutral-950 md:pt-14">
        <section className="flex flex-col gap-7 border-b border-neutral-200 pb-8 md:flex-row md:items-end md:justify-between md:gap-12">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-600">Network capability check</div>
            <h1 className="mt-3 max-w-4xl text-4xl font-black leading-none tracking-[-0.045em] md:text-6xl lg:text-7xl">流媒体解锁检测</h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-neutral-500 md:text-base md:leading-8">
              先判断当前出口地区是否在官方覆盖范围，再以基础资源连通结果辅助验证。检测只在点击后开始。
            </p>
          </div>
          <button
            type="button"
            disabled={running}
            onClick={() => { void runCheck(); }}
            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-rose-600 px-6 text-sm font-black text-white shadow-[0_14px_30px_rgba(225,29,72,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-rose-700 hover:shadow-[0_18px_34px_rgba(225,29,72,0.26)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:shadow-none md:w-auto"
          >
            {running ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : hasRun ? <RotateCw size={16} /> : <Play size={16} />}
            {running ? `检测中 ${completed}/${STREAMING_SERVICES.length}` : hasRun ? '重新检测' : '开始检测'}
          </button>
        </section>

        <NetworkSummary response={response} running={running} hasRun={hasRun} apiError={apiError} />

        <section aria-label="检测结果" className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          {STREAMING_SERVICES.map((service, index) => {
            const assessment = assessmentByKey.get(service.key);
            const mergedState = getMergedState(reachability[service.key], assessment, response);
            return (
              <ServiceResult
                key={service.key}
                service={service}
                assessment={assessment}
                reachability={reachability[service.key]}
                mergedState={mergedState}
                running={running}
                hasRun={hasRun}
                animationDelay={index * 45}
                netflixRegion={service.key === 'netflix' ? response?.netflix.inferred_region : undefined}
              />
            );
          })}
        </section>

        {hasRun && !running ? <NetflixManualVerification /> : null}

        <section className="mt-10 max-w-3xl border-t border-neutral-200 pt-8">
          <div className="flex items-center gap-2 text-sm font-black text-neutral-900">
            <ShieldAlert size={17} />
            如何理解检测结果
          </div>
          <p className="mt-3 text-sm leading-7 text-neutral-500">
            “官方地区支持”来自出口国家与服务覆盖策略；基础资源探测失败可能由浏览器跨域策略或反机器人机制导致，不代表服务无法连接。检测仍不能证明账号登录、完整片库或播放一定成功，IP 与结果不会写入检测历史。
          </p>
        </section>
      </main>
    </PageFrame>
  );
}

function NetworkSummary({
  response,
  running,
  hasRun,
  apiError,
}: {
  response: StreamingCheckResponse | null;
  running: boolean;
  hasRun: boolean;
  apiError: string;
}) {
  const checkedAt = response?.checked_at ? formatCheckedAt(response.checked_at) : running ? '识别中' : hasRun ? '未获得检测时间' : '尚未检测';
  return (
    <section aria-label="当前网络" className="grid gap-4 border-b border-neutral-200 py-6 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-950 text-white">
          <Globe2 size={17} />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">当前出口网络</div>
          <div className="mt-1 break-all font-mono text-sm font-black text-neutral-900">
            {response ? response.network.ip : running ? '正在识别出口 IP…' : '点击检测后显示出口 IP 与地区'}
          </div>
          {apiError ? <p className="mt-1 text-xs font-bold text-rose-600">{apiError}</p> : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 text-left md:text-right">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-400">国家/地区</div>
          <div className="mt-1 font-black">{response ? `${response.network.country_name} · ${response.network.country_code}` : '-'}</div>
        </div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-400">检测时间</div>
          <div className="mt-1 whitespace-nowrap font-black">{checkedAt}</div>
        </div>
      </div>
    </section>
  );
}

function ServiceResult({
  service,
  assessment,
  reachability,
  mergedState,
  running,
  hasRun,
  animationDelay,
  netflixRegion,
}: {
  key?: StreamingServiceKey;
  service: (typeof STREAMING_SERVICES)[number];
  assessment?: StreamingRegionAssessment;
  reachability: StreamingReachability;
  mergedState: StreamingMergedState;
  running: boolean;
  hasRun: boolean;
  animationDelay: number;
  netflixRegion?: StreamingCheckResponse['netflix']['inferred_region'];
}) {
  const state = getStatePresentation(mergedState, reachability, running, hasRun);
  const isNetflix = service.key === 'netflix';
  const StateIcon = state.icon;
  return (
    <article
      className={`grid min-w-0 grid-cols-[46px_minmax(0,1fr)] gap-3 border-b border-neutral-200 py-5 transition duration-300 motion-reduce:transition-none ${isNetflix ? 'md:col-span-2' : ''} ${hasRun && reachability !== 'pending' ? 'translate-y-0 opacity-100' : ''}`}
      style={{ transitionDelay: `${animationDelay}ms` }}
    >
      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-[11px] font-black ${serviceMarkTone(service.key)}`}>
        {service.short_label}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-black tracking-tight">{service.label}</h2>
            <p className="mt-1 text-xs font-bold text-neutral-400">{reachabilityLabel(reachability, running, hasRun)}</p>
          </div>
          <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-black ${state.tone}`}>
            <StateIcon size={14} className={mergedState === 'pending' && running ? 'animate-pulse motion-reduce:animate-none' : ''} />
            {state.label}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {assessment ? <p className="min-w-0 flex-1 text-sm leading-6 text-neutral-500">{assessment.note}</p> : null}
          <a
            href={service.official_url}
            target="_blank"
            rel="nofollow noreferrer noopener"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-neutral-600 transition hover:text-rose-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
          >
            打开验证
            <ExternalLink size={13} />
          </a>
        </div>
        {isNetflix && netflixRegion ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
            <span className="rounded-md bg-neutral-100 px-2.5 py-1.5 text-neutral-700">地区推断：{netflixRegionLabel(netflixRegion)}</span>
            <span className="rounded-md bg-amber-50 px-2.5 py-1.5 text-amber-800">完整片库：无法自动确认</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function NetflixManualVerification() {
  return (
    <section className="mt-9 border-y border-neutral-200 py-7">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-600">Netflix manual verification</div>
          <h2 className="mt-2 text-2xl font-black tracking-tight">手动复核 Netflix 片库</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-neutral-500">打开测试片源并确认能否看到详情或播放；片库会变化，结果以 Netflix 当前页面为准。</p>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {NETFLIX_MANUAL_TESTS.map((item) => (
          <a
            key={item.key}
            href={item.href}
            target="_blank"
            rel="nofollow noreferrer noopener"
            className="group flex min-h-20 items-center justify-between gap-3 rounded-lg border border-neutral-200 px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
          >
            <span>
              <span className="block text-xs font-black text-rose-600">{item.label}</span>
              <span className="mt-1 block text-sm font-black text-neutral-900">{item.title}</span>
            </span>
            <ExternalLink size={15} className="shrink-0 text-neutral-400 transition group-hover:text-rose-600" />
          </a>
        ))}
      </div>
    </section>
  );
}

async function requestStreamingCheck(): Promise<StreamingCheckResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort('timeout'), 8000);
  try {
    const response = await fetch(`${getApiBase()}/api/v1/tools/streaming-check`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await safeJson(response) as { message?: string } | null;
      throw new Error(body?.message || `网络信息请求失败：${response.status}`);
    }
    return await response.json() as StreamingCheckResponse;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('网络信息识别超时，请重新检测');
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function probeService(url: string): Promise<StreamingReachability> {
  return await new Promise<StreamingReachability>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (result: StreamingReachability) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
      resolve(result);
    };
    const timeoutId = window.setTimeout(() => finish('timeout'), 8000);
    const probeUrl = new URL(url);
    probeUrl.searchParams.set('_gr_probe', String(Date.now()));
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => finish('reachable');
    image.onerror = () => finish('unreachable');
    image.src = probeUrl.toString();
  });
}

function getMergedState(
  reachability: StreamingReachability,
  assessment: StreamingRegionAssessment | undefined,
  response: StreamingCheckResponse | null,
): StreamingMergedState {
  return mergeStreamingEvidence(
    reachability,
    assessment?.region_support || 'unknown',
    Boolean(response && !['ZZ', 'XX', 'T1'].includes(response.network.country_code)),
  );
}

function getStatePresentation(
  state: StreamingMergedState,
  reachability: StreamingReachability,
  running: boolean,
  hasRun: boolean,
) {
  if (!hasRun) return { label: '待检测', tone: 'bg-neutral-100 text-neutral-500', icon: CircleHelp };
  if (state === 'pending' && running) return { label: '检测中', tone: 'bg-neutral-100 text-neutral-600', icon: Activity };
  if (state === 'region_supported') return { label: '官方地区支持', tone: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 };
  if (state === 'region_unsupported') return { label: '官方地区不支持', tone: 'bg-rose-50 text-rose-700', icon: ShieldAlert };
  if (state === 'reachable_only') return { label: '基础资源可达', tone: 'bg-sky-50 text-sky-700', icon: CheckCircle2 };
  return { label: '浏览器限制', tone: 'bg-amber-50 text-amber-800', icon: CircleHelp };
}

function reachabilityLabel(reachability: StreamingReachability, running: boolean, hasRun: boolean): string {
  if (!hasRun) return '等待用户开始检测';
  if (reachability === 'pending') return running ? '正在探测基础资源' : '未完成基础资源探测';
  if (reachability === 'reachable') return '基础资源可达';
  if (reachability === 'timeout') return '基础资源探测超时，地区结论不受影响';
  return '浏览器限制，未完成基础资源验证';
}

function netflixRegionLabel(region: StreamingCheckResponse['netflix']['inferred_region']): string {
  return ({ us: '美国', jp: '日本', sg: '新加坡', other: '其他地区', unknown: '未知' })[region];
}

function serviceMarkTone(key: StreamingServiceKey): string {
  if (key === 'netflix') return 'bg-red-600 text-white';
  if (key === 'chatgpt' || key === 'claude') return 'bg-neutral-950 text-white';
  if (key === 'tiktok') return 'bg-cyan-950 text-white';
  if (key === 'disney_plus') return 'bg-blue-700 text-white';
  return 'bg-violet-700 text-white';
}

function formatCheckedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '刚刚';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(parsed);
}

function getApiBase(): string {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE;
  return fromEnv?.trim() ? fromEnv.replace(/\/+$/, '') : '';
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '网络信息识别失败';
}
