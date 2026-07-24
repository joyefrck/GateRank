import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Globe2,
  Hash,
  Languages,
  Loader2,
  MapPin,
  Navigation,
  RotateCw,
  Search,
  Shield,
  Zap,
} from 'lucide-react';

import {
  IP_CHECK_TRANSLATIONS,
  type IpCheckErrorResponse,
  type IpCheckLanguage,
  type IpCheckResult,
  type IpCheckSuccessResponse,
} from '../../../shared/ipCheck';
import { buildAbsoluteUrl, PageFrame, usePageSeo } from '../../site/publicSite';
import { IpCheckMap } from './IpCheckMap';
import {
  resolveIpCheckErrorMessage,
  resolveVisibleQuery,
  shouldUseIpifyFallback,
} from './ipCheckState';

const IP_CHECK_FAQ = [
  {
    question: 'IP 检测会保存查询历史吗？',
    answer: 'GateRank 不将查询目标或结果写入数据库和业务日志；成功结果会在 API 进程内存中临时缓存最多 24 小时，以节省免费查询额度。',
  },
  {
    question: '为什么 IP 定位和实际位置不同？',
    answer: 'IP 地理位置来自网络注册、路由和运营商数据，通常只能定位到国家、地区或城市，不能替代 GPS。',
  },
  {
    question: '可以查询域名和 IPv6 吗？',
    answer: '可以。输入合法的公网 IPv4、IPv6 或域名即可查看对应网络信息。',
  },
] as const;

class IpCheckRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export function IPCheckPage() {
  const [language, setLanguage] = useState<IpCheckLanguage>('zh');
  const [query, setQuery] = useState('');
  const [lastQuery, setLastQuery] = useState<string | undefined>();
  const [result, setResult] = useState<IpCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState('');
  const [copied, setCopied] = useState('');
  const initializedRef = useRef(false);
  const translations = IP_CHECK_TRANSLATIONS[language];

  usePageSeo({
    title: 'IP 地理位置查询 | IP 地址、域名、ISP 与 ASN 检测',
    description: '免费查询当前出口 IP、IPv4、IPv6 或域名的国家地区、城市、经纬度、时区、ISP、组织与 ASN 信息。',
    keywords: 'IP检测,IP地址查询,IP归属地,域名查询,IPv6查询,ISP查询,ASN查询',
    canonicalPath: '/tools/ip-check',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebApplication',
          name: 'GateRank IP 地理位置查询',
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          url: buildAbsoluteUrl('/tools/ip-check'),
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '今日推荐', item: buildAbsoluteUrl('/') },
            { '@type': 'ListItem', position: 2, name: '翻墙工具下载', item: buildAbsoluteUrl('/download') },
            { '@type': 'ListItem', position: 3, name: 'IP 检测', item: buildAbsoluteUrl('/tools/ip-check') },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: IP_CHECK_FAQ.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        },
      ],
    },
  });

  const runLookup = useCallback(async (manualQuery: string | undefined) => {
    setLoading(true);
    setErrorCode('');
    setLastQuery(manualQuery);
    try {
      const response = await requestIpCheck(manualQuery);
      setResult(response.result);
      setQuery(resolveVisibleQuery(manualQuery, response.result.ip));
    } catch (error) {
      if (error instanceof IpCheckRequestError && shouldUseIpifyFallback(error.code, manualQuery)) {
        try {
          const detectedIp = await requestIpifyAddress();
          const response = await requestIpCheck(detectedIp);
          setResult(response.result);
          setQuery(response.result.ip);
          setLastQuery(undefined);
          return;
        } catch (fallbackError) {
          setErrorCode(fallbackError instanceof IpCheckRequestError ? fallbackError.code : 'NETWORK_ERROR');
          return;
        } finally {
          setLoading(false);
        }
      }
      setErrorCode(error instanceof IpCheckRequestError ? error.code : 'NETWORK_ERROR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void runLookup(undefined);
  }, [runLookup]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const normalized = query.trim();
    void runLookup(normalized || undefined);
  };

  const copyValue = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied((current) => current === value ? '' : current), 1600);
    } catch {
      setCopied('');
    }
  };

  const errorMessage = errorCode ? resolveIpCheckErrorMessage(errorCode, language) : '';

  return (
    <PageFrame active="tools">
      <main className="relative isolate min-h-[760px] overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 px-4 py-8 text-white md:py-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-[-12rem] top-24 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-10 right-[-12rem] h-96 w-96 rounded-full bg-purple-500/25 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl">
          <header className="relative text-center">
            <button
              type="button"
              onClick={() => setLanguage((current) => current === 'zh' ? 'en' : 'zh')}
              className="absolute right-0 top-0 inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-black text-slate-200 backdrop-blur transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-400/30"
              aria-label={language === 'zh' ? 'Switch to English' : '切换到中文'}
            >
              <Languages size={16} />
              {language === 'zh' ? 'EN' : '中文'}
            </button>
            <div className="mx-auto flex w-fit items-center gap-3 pt-12 md:pt-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
                <Globe2 size={24} />
              </span>
              <h1 className="bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-5xl">
                {translations.title}
              </h1>
            </div>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              {translations.description}
            </p>
          </header>

          <form onSubmit={submit} className="mx-auto mt-7 flex max-w-3xl flex-col gap-3 sm:flex-row" role="search">
            <label className="relative flex-1">
              <span className="sr-only">{translations.searchPlaceholder}</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={translations.searchPlaceholder}
                disabled={loading}
                className="h-14 w-full rounded-xl border border-white/15 bg-white/10 px-4 pr-12 text-lg font-semibold text-white outline-none backdrop-blur placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 disabled:opacity-70"
              />
              <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-14 min-w-36 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-7 text-sm font-black text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-0.5 hover:shadow-blue-500/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin motion-reduce:animate-none" size={19} /> : <Search size={19} />}
              {loading ? translations.searching : translations.searchButton}
            </button>
          </form>

          <section className="mt-8" aria-live="polite">
            {loading && !result ? <LoadingState /> : null}
            {errorMessage && !loading ? (
              <div className="mx-auto max-w-3xl rounded-xl border border-red-300/20 bg-red-500/10 p-7 text-center backdrop-blur">
                <AlertCircle className="mx-auto text-red-300" size={42} />
                <p className="mt-4 text-sm font-bold leading-7 text-red-100">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => void runLookup(lastQuery)}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-5 text-sm font-black transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300/20"
                >
                  <RotateCw size={16} />
                  {translations.retry}
                </button>
              </div>
            ) : null}
            {result ? (
              <div className={`grid gap-5 lg:grid-cols-5 ${loading ? 'opacity-60' : ''}`}>
                <section className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur lg:col-span-3" aria-label="地图与地理位置">
                  <IpCheckMap
                    latitude={result.latitude}
                    longitude={result.longitude}
                    city={result.city}
                    translations={translations}
                  />
                </section>
                <section className="space-y-3 lg:col-span-2" aria-label={translations.details}>
                  <InfoPanel
                    result={result}
                    copied={copied}
                    onCopy={copyValue}
                    translations={translations}
                  />
                </section>
              </div>
            ) : null}
          </section>

          <VpnBanner translations={translations} />

          <section className="mx-auto mt-8 max-w-5xl rounded-xl border border-white/10 bg-white/5 p-5 text-xs leading-6 text-slate-400 backdrop-blur">
            <p>{translations.dataSource}</p>
            <p className="mt-2">{translations.privacy}</p>
          </section>
        </div>
      </main>
    </PageFrame>
  );
}

function LoadingState() {
  return (
    <div className="grid animate-pulse gap-5 motion-reduce:animate-none lg:grid-cols-5">
      <div className="min-h-[380px] rounded-xl border border-white/10 bg-white/5 lg:col-span-3" />
      <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-24 rounded-xl border border-white/10 bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function InfoPanel({
  result,
  copied,
  onCopy,
  translations,
}: {
  result: IpCheckResult;
  copied: string;
  onCopy: (value: string) => void;
  translations: (typeof IP_CHECK_TRANSLATIONS)[IpCheckLanguage];
}) {
  const items = useMemo(() => [
    { icon: Globe2, label: translations.ipAddress, value: result.ip, tone: 'from-blue-500 to-cyan-500' },
    { icon: MapPin, label: translations.country, value: `${countryFlag(result.country_code)} ${result.country}`.trim(), copy: result.country, tone: 'from-purple-500 to-pink-500' },
    { icon: Navigation, label: translations.city, value: [result.city, result.region_name].filter(Boolean).join(', '), tone: 'from-emerald-500 to-green-500' },
    { icon: Hash, label: translations.postalCode, value: result.postal_code || translations.unknown, tone: 'from-orange-500 to-red-500' },
    { icon: Building2, label: translations.isp, value: result.isp || translations.unknown, tone: 'from-indigo-500 to-blue-500' },
    { icon: Clock3, label: translations.timezone, value: result.timezone || translations.unknown, tone: 'from-amber-500 to-orange-500' },
  ], [result, translations]);

  const details = [
    { label: translations.longitude, value: result.longitude.toFixed(4) },
    { label: translations.latitude, value: result.latitude.toFixed(4) },
    { label: translations.asn, value: result.asn || translations.unknown },
    { label: translations.organization, value: result.organization || translations.unknown },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <InfoCard
              icon={item.icon}
              label={item.label}
              value={item.value || translations.unknown}
              copyValue={item.copy || item.value}
              copied={copied}
              onCopy={onCopy}
              tone={item.tone}
              copyLabel={translations.copy}
            />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Hash className="text-blue-300" size={17} />
          {translations.details}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
          {details.map((item) => (
            <button
              type="button"
              key={item.label}
              onClick={() => onCopy(item.value)}
              className="group min-w-0 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/20"
              title={translations.copy}
            >
              <span className="block text-xs text-slate-400">{item.label}</span>
              <span className="mt-1 flex items-center gap-2">
                <span className="min-w-0 truncate font-mono text-sm text-white">{item.value}</span>
                {copied === item.value ? <Check className="shrink-0 text-emerald-300" size={13} /> : <Copy className="shrink-0 text-slate-500 transition group-hover:text-white" size={13} />}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  copyValue,
  copied,
  onCopy,
  tone,
  copyLabel,
}: {
  icon: typeof Globe2;
  label: string;
  value: string;
  copyValue: string;
  copied: string;
  onCopy: (value: string) => void;
  tone: string;
  copyLabel: string;
}) {
  return (
    <article className="group flex min-w-0 items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur transition hover:bg-white/10">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${tone}`}>
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="mt-1 truncate text-sm font-black text-white" title={value}>{value}</p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(copyValue)}
        className="shrink-0 rounded-md p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/20"
        aria-label={`${copyLabel}: ${label}`}
      >
        {copied === copyValue ? <Check className="text-emerald-300" size={15} /> : <Copy size={15} />}
      </button>
    </article>
  );
}

function VpnBanner({ translations }: { translations: (typeof IP_CHECK_TRANSLATIONS)[IpCheckLanguage] }) {
  return (
    <a
      href="https://www.elphantroute.com/"
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className="group mx-auto mt-8 flex max-w-5xl flex-col items-center justify-between gap-5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 p-6 text-center backdrop-blur transition hover:-translate-y-0.5 hover:border-white/25 hover:shadow-2xl hover:shadow-purple-500/15 md:flex-row md:p-8 md:text-left"
    >
      <span>
        <span className="flex items-center justify-center gap-2 text-xl font-black md:justify-start">
          <Shield className="text-blue-300" size={24} />
          {translations.vpnTitle}
        </span>
        <span className="mt-2 block text-sm leading-7 text-slate-300">{translations.vpnDescription}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-black shadow-lg shadow-blue-500/25">
        <Zap size={16} />
        {translations.vpnCta}
        <ExternalLink size={15} />
      </span>
    </a>
  );
}

async function requestIpCheck(query: string | undefined): Promise<IpCheckSuccessResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${getApiBase()}/api/v1/tools/ip-check`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query === undefined ? {} : { query }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = await safeJson(response) as IpCheckErrorResponse | null;
      throw new IpCheckRequestError(error?.code || 'IP_CHECK_UPSTREAM_ERROR');
    }
    return await response.json() as IpCheckSuccessResponse;
  } catch (error) {
    if (error instanceof IpCheckRequestError) throw error;
    if (controller.signal.aborted) throw new IpCheckRequestError('IP_CHECK_UPSTREAM_TIMEOUT');
    throw new IpCheckRequestError('NETWORK_ERROR');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function requestIpifyAddress(): Promise<string> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('https://api64.ipify.org?format=json', {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('ipify failed');
    const body = await response.json() as { ip?: unknown };
    if (typeof body.ip !== 'string' || !body.ip.trim()) throw new Error('ipify invalid');
    return body.ip.trim();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getApiBase(): string {
  const envBase = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL?.trim();
  return envBase ? envBase.replace(/\/+$/, '') : '';
}

function countryFlag(code: string): string {
  const normalized = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '';
  return String.fromCodePoint(...normalized.split('').map((character) => 127397 + character.charCodeAt(0)));
}
