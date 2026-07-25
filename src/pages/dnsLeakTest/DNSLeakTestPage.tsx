import { useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleHelp,
  Copy,
  Globe2,
  Loader2,
  LockKeyhole,
  Network,
  Play,
  RotateCw,
  Route,
  Server,
  ShieldCheck,
} from 'lucide-react';
import type {
  DnsLeakTestResultResponse,
  DnsLeakTestStartResponse,
} from '../../../shared/dnsLeakTest';
import { buildAbsoluteUrl, PageFrame, usePageSeo } from '../../site/publicSite';
import {
  countryConsistencyLabel,
  dnsLeakVerdictLabel,
  dnssecSignalLabel,
  formatDnsLeakTestCopy,
  resolveDnsLeakErrorMessage,
} from './dnsLeakTestState';

const DNS_LEAK_FAQ = [
  {
    question: 'DNS 泄漏检测如何识别解析器？',
    answer: 'GateRank 让浏览器解析本轮专属的一次性域名，并由独立权威 DNS 探针记录实际发起查询的递归解析器。',
  },
  {
    question: '解析器和出口运营商不同就一定泄漏吗？',
    answer: '不一定。Google、Cloudflare 等公共 DNS 本来就可能与代理出口运营商不同，因此 GateRank 主要比较国家，并把结果表达为风险而非绝对结论。',
  },
  {
    question: '网页能判断 DoH 或 DoT 吗？',
    answer: '普通网页无法可靠读取浏览器或系统当前使用的 DNS 传输协议，因此 DoH 与 DoT 只展示检测能力边界，不输出虚假的是或否。',
  },
] as const;

class DnsLeakRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export function DNSLeakTestPage() {
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [triggeredProbes, setTriggeredProbes] = useState(0);
  const [result, setResult] = useState<DnsLeakTestResultResponse | null>(null);
  const [errorCode, setErrorCode] = useState('');
  const [copied, setCopied] = useState(false);
  const runIdRef = useRef(0);

  usePageSeo({
    title: 'DNS Leak Test | DNS 泄漏、解析器与 DNSSEC 检测',
    description: '通过独立权威 DNS 探针检测当前网络实际使用的递归 DNS 解析器，并比较出口地区、运营商与 DNSSEC 能力信号。',
    keywords: 'DNS Leak Test,DNS泄漏检测,DNS服务器检测,DNSSEC检测,代理DNS泄漏,VPN DNS检测',
    canonicalPath: '/tools/dns-leak-test',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebApplication',
          name: 'GateRank DNS Leak Test',
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          url: buildAbsoluteUrl('/tools/dns-leak-test'),
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '今日推荐', item: buildAbsoluteUrl('/') },
            { '@type': 'ListItem', position: 2, name: '翻墙工具下载', item: buildAbsoluteUrl('/download') },
            { '@type': 'ListItem', position: 3, name: 'DNS 泄漏检测', item: buildAbsoluteUrl('/tools/dns-leak-test') },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: DNS_LEAK_FAQ.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        },
      ],
    },
  });

  const runCheck = async () => {
    if (running) return;
    const runId = ++runIdRef.current;
    setRunning(true);
    setHasRun(true);
    setTriggeredProbes(0);
    setResult(null);
    setErrorCode('');
    setCopied(false);

    try {
      const started = await requestDnsLeakStart();
      const images: HTMLImageElement[] = [];
      const probeTask = triggerDnsProbes(started, images, (count) => {
        if (runIdRef.current === runId) setTriggeredProbes(count);
      });

      let latest: DnsLeakTestResultResponse | null = null;
      do {
        if (runIdRef.current !== runId) return;
        latest = await requestDnsLeakResult(started.session_id);
        setResult(latest);
        if (latest.status !== 'running') break;
        await delay(500);
      } while (Date.now() < new Date(started.expires_at).getTime());

      await probeTask;
      images.splice(0, images.length);
      if (latest?.status === 'running') {
        throw new DnsLeakRequestError('DNS_LEAK_TEST_TIMEOUT');
      }
    } catch (error) {
      if (runIdRef.current !== runId) return;
      setErrorCode(error instanceof DnsLeakRequestError ? error.code : 'DNS_LEAK_TEST_NETWORK_ERROR');
    } finally {
      if (runIdRef.current === runId) setRunning(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(formatDnsLeakTestCopy(result));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    } catch {
      setCopied(false);
    }
  };

  const errorMessage = errorCode ? resolveDnsLeakErrorMessage(errorCode) : '';

  return (
    <PageFrame active="tools">
      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 pb-20 pt-8 text-neutral-950 md:pt-14">
        <section className="grid gap-8 border-b border-neutral-200 pb-9 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-600">Resolver path inspection</div>
            <h1 className="mt-3 text-5xl font-black leading-[0.92] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              DNS Leak Test
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-neutral-500 md:text-base md:leading-8">
              触发 10 次一次性域名解析，识别实际递归 DNS，并把解析器地区与当前 HTTP 出口进行风险比较。
            </p>
          </div>
          <div className="lg:justify-self-end">
            <div className="mb-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center text-center text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400" aria-hidden="true">
              <span>出口</span><Route size={14} className="mx-2 text-rose-500" />
              <span>解析器</span><Route size={14} className="mx-2 text-rose-500" />
              <span>探针</span>
            </div>
            <button
              type="button"
              disabled={running}
              onClick={() => { void runCheck(); }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-6 text-sm font-black text-white shadow-[0_14px_30px_rgba(225,29,72,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-rose-700 hover:shadow-[0_18px_34px_rgba(225,29,72,0.26)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:shadow-none"
            >
              {running ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : hasRun ? <RotateCw size={16} /> : <Play size={16} />}
              {running ? `检测中 ${Math.max(1, triggeredProbes)}/10` : hasRun ? '重新检测' : '开始检测'}
            </button>
          </div>
        </section>

        <section className="grid gap-5 border-b border-neutral-200 py-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white">
              <Globe2 size={21} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-neutral-400">当前出口网络</p>
              <p className="mt-1 truncate font-mono text-sm font-black text-neutral-900">
                {result?.network.ip || (running ? '正在识别出口 IP…' : '点击开始后显示')}
              </p>
              {result ? (
                <p className="mt-1 truncate text-xs text-neutral-500">
                  {[result.network.country || result.network.country_code, result.network.organization || result.network.isp, result.network.asn].filter(Boolean).join(' · ') || '地理与网络信息未知'}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Activity size={16} className={running ? 'animate-pulse text-rose-600 motion-reduce:animate-none' : 'text-neutral-400'} />
            <span className="font-black text-neutral-800">
              {running
                ? `权威探针已观察 ${result?.observed_probe_count || 0}/10`
                : result
                  ? `检测完成 · ${result.resolvers.length} 个解析器`
                  : '尚未检测'}
            </span>
          </div>
        </section>

        {errorMessage ? (
          <div className="mt-6 flex items-start gap-3 border-l-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-800" role="alert">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <section className="mt-8" aria-label="DNS 解析器检测结果">
          <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-600">Observed resolvers</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight">DNS 解析器证据</h2>
            </div>
            {result ? (
              <button
                type="button"
                onClick={() => { void copyResult(); }}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 text-xs font-black text-neutral-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? '已复制' : '复制结果'}
              </button>
            ) : null}
          </div>

          {result?.resolvers.length ? (
            <div className="divide-y divide-neutral-200">
              {result.resolvers.map((resolver, index) => (
                <article
                  key={resolver.ip}
                  className="grid min-w-0 animate-[dns-resolver-in_.3s_ease-out_both] gap-4 py-5 motion-reduce:animate-none md:grid-cols-[48px_minmax(0,1fr)_minmax(180px,.7fr)_auto] md:items-center"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                    <Server size={19} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-black text-neutral-950">{resolver.ip}</p>
                    <p className="mt-1 truncate text-xs text-neutral-500">{resolver.country || resolver.country_code || '未知地区'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-neutral-800">{resolver.organization || resolver.isp || '未知运营商'}</p>
                    <p className="mt-1 truncate text-xs text-neutral-500">{resolver.asn || '未知 ASN'}</p>
                  </div>
                  <div className="text-xs font-black text-neutral-500">
                    {resolver.observation_count} 次观察 · {resolver.query_types.join(', ')}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-36 items-center justify-center border-b border-neutral-200 text-center text-sm leading-7 text-neutral-400">
              {running ? '正在等待递归 DNS 查询到达权威探针…' : result ? '本轮未发现解析器，结果无法判定。' : '开始检测后，这里会列出实际向权威探针发起查询的解析器。'}
            </div>
          )}
        </section>

        <section className="mt-9 grid gap-x-10 lg:grid-cols-2" aria-label="DNS 泄漏分析">
          <AnalysisRow
            icon={result?.verdict === 'no_obvious_leak' ? CheckCircle2 : result?.verdict === 'possible_leak' ? AlertTriangle : CircleHelp}
            label="泄漏风险"
            value={result ? dnsLeakVerdictLabel(result.verdict) : '待检测'}
            tone={result?.verdict === 'no_obvious_leak' ? 'text-emerald-700' : result?.verdict === 'possible_leak' ? 'text-rose-700' : 'text-neutral-500'}
          />
          <AnalysisRow
            icon={Network}
            label="DNS 与出口地区"
            value={result ? countryConsistencyLabel(result.country_consistency) : '待检测'}
            tone={result?.country_consistency === 'matched' ? 'text-emerald-700' : result?.country_consistency === 'mismatched' ? 'text-rose-700' : 'text-neutral-500'}
          />
          <AnalysisRow
            icon={ShieldCheck}
            label="DNSSEC"
            value={result ? dnssecSignalLabel(result.dnssec_signal) : '待检测'}
            tone={result?.dnssec_signal === 'observed' ? 'text-emerald-700' : 'text-neutral-500'}
          />
          <AnalysisRow icon={LockKeyhole} label="DoH" value="网页无法可靠判断" tone="text-neutral-500" />
          <AnalysisRow icon={LockKeyhole} label="DoT" value="网页无法可靠判断" tone="text-neutral-500" />
        </section>

        <section className="mt-10 max-w-3xl border-t border-neutral-200 pt-8">
          <h2 className="text-lg font-black">如何理解结果</h2>
          <p className="mt-3 text-sm leading-7 text-neutral-500">
            “未发现明显异常”只表示本轮已定位解析器与 HTTP 出口国家一致。公共 DNS 的运营商可能与出口不同，这本身不等于泄漏；DoH、DoT 以及 VPN 是否正确接管 DNS 仍需结合客户端设置判断。
          </p>
          <p className="mt-3 text-sm leading-7 text-neutral-500">
            测试会生成短期一次性域名，当前解析器与 GateRank 独立权威探针会观察这些查询。会话关联最多保留 2 分钟，不写入数据库；解析器的 IP 地理元数据可能在 API 内存中缓存最多 24 小时以节省查询额度。
          </p>
        </section>
      </main>
    </PageFrame>
  );
}

function AnalysisRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Network;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-200 py-5">
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-neutral-400" />
        <span className="text-sm font-black text-neutral-800">{label}</span>
      </div>
      <strong className={`text-right text-sm ${tone}`}>{value}</strong>
    </div>
  );
}

async function requestDnsLeakStart(): Promise<DnsLeakTestStartResponse> {
  return await requestJson('/api/v1/tools/dns-leak-test/start', {});
}

async function requestDnsLeakResult(sessionId: string): Promise<DnsLeakTestResultResponse> {
  return await requestJson('/api/v1/tools/dns-leak-test/result', { session_id: sessionId });
}

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${getApiBase()}${path}`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = await safeJson(response) as { code?: string } | null;
      throw new DnsLeakRequestError(error?.code || 'DNS_LEAK_TEST_UPSTREAM_ERROR');
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof DnsLeakRequestError) throw error;
    if (controller.signal.aborted) throw new DnsLeakRequestError('DNS_LEAK_TEST_TIMEOUT');
    throw new DnsLeakRequestError('DNS_LEAK_TEST_NETWORK_ERROR');
  } finally {
    window.clearTimeout(timeout);
  }
}

async function triggerDnsProbes(
  started: DnsLeakTestStartResponse,
  images: HTMLImageElement[],
  onProgress: (count: number) => void,
): Promise<void> {
  for (const [index, hostname] of started.probe_hosts.entries()) {
    const image = new Image();
    images.push(image);
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.src = `https://${hostname}/.well-known/gaterank-dns-probe.gif?probe=${index}`;
    onProgress(index + 1);
    if (index < started.probe_hosts.length - 1) await delay(260);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getApiBase(): string {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE;
  return fromEnv?.trim() ? fromEnv.replace(/\/+$/, '') : '';
}
