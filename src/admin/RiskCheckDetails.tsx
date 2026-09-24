import React from 'react';
import { WEBSITE_STATUS_LABELS, type RiskCheckHistory } from '../../shared/riskCheck';

function time(value?: string): string {
  if (!value) return '无记录';
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
export function RiskCheckDetails({ checks, date }: { checks?: RiskCheckHistory; date: string }) {
  const run = checks?.latest;
  return (
    <section aria-label="最近官网检测" className="mb-4 rounded border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-neutral-900">最近官网检测</h3>
      {!run ? <p className="mt-2 text-xs text-neutral-500">尚无详细检测记录。下一次风险体检后生成；已有评分不变。</p> : <>
        <p className={`mt-2 text-sm font-medium ${run.domain_ok === false ? 'text-rose-700' : run.status === 'accessible' ? 'text-emerald-700' : 'text-amber-700'}`}>
          {WEBSITE_STATUS_LABELS[run.status]}
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="检测时间（北京时间）" value={time(run.checked_at)} />
          <Field label="检测位置" value={run.probe_location} />
          <Field label="检测地址" value={run.target_url || '地址无效'} />
          <Field label="最终地址" value={run.final_url || '未取得'} />
          <Field label="HTTP 状态" value={run.http_status ?? '无响应'} />
          <Field label="TLS 证书剩余天数" value={run.ssl_days_left ?? '未知'} />
          <Field label="证书检测地址" value={run.ssl_target_url || '未检测 HTTPS'} />
          <Field label="证书校验" value={run.tls_authorized === null ? '未确认' : run.tls_authorized ? '通过' : '未通过'} />
          <Field label="复核 / 根路径回退" value={`${run.retried ? '已复核一次' : '未复核'} / ${run.root_fallback ? '使用根路径结果' : '未使用'}`} />
          <Field label="耗时 / 错误码" value={`${(run.duration_ms / 1000).toFixed(2)} 秒 / ${run.error_code || '无'}`} />
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          {run.applied_to_metrics ? `此次结果已写入 ${run.date} 的风险指标；评分以重算结果为准。` : '此次结果未写入风险指标，已有指标保持原值。'}
          {run.date !== date ? ` 所选 ${date} 尚无检测记录，当前展示 ${run.date} 的最近记录。` : ''}
          {' 最近采用的检测时间：'}{time(checks?.last_applied?.checked_at)}。
        </p>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">Cloudflare 验证或 TLS 可达不能证明源站页面正常；证书信息可能来自 CDN 边缘。</p>
        <details className="mt-3 border-t border-neutral-200 pt-2">
          <summary className="min-h-10 cursor-pointer py-2 text-xs font-medium text-neutral-700 focus-visible:outline-indigo-600">查看分阶段检测记录（{run.attempts.length} 条）</summary>
          <ol className="space-y-2 text-xs text-neutral-600">
            {run.attempts.map((attempt, index) => <li key={index} className="break-all rounded bg-neutral-50 p-2">
              第 {attempt.round} 轮 · {attempt.stage.toUpperCase()} · {attempt.url}<br />
              {attempt.http_status !== null ? `HTTP ${attempt.http_status}` : ''}{attempt.error_code ? ` ${attempt.error_code}` : ' · 已收到结果'}
            </li>)}
          </ol>
        </details>
      </>}
    </section>
  );
}
function Field({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0"><dt className="text-xs text-neutral-500">{label}</dt><dd className="mt-1 break-all text-neutral-900">{value}</dd></div>;
}
