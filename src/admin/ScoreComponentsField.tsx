import React, { useEffect, useState } from 'react';
import { SCORE_COMPONENT_KEYS, applyScoreComponents, finalComponentTotal, type ManualScoreComponents, type ScoreComponentEditorState, type ScoreComponentKey } from '../../shared/gateRankScore';

const LABELS = { s: '稳定性分 (S)', p: '性能分 (P)', n: '网络覆盖分 (N)', c: '价格分 (C)', r: '风险分 (R)' };
type Draft = Record<ScoreComponentKey, string | null>;
function initialDraft(state: ScoreComponentEditorState): Draft {
  return Object.fromEntries(SCORE_COMPONENT_KEYS.map((key) => [key, state.overrides[key] == null ? null : String(state.overrides[key])])) as Draft;
}

export function ScoreComponentsField({ state, onSave }: {
  key?: React.Key;
  state: ScoreComponentEditorState | null;
  onSave: (patch: ManualScoreComponents) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>({ s: null, p: null, n: null, c: null, r: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (state) setDraft(initialDraft(state)); }, [state]);
  if (!state) return <div className="col-span-full rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">当前日期没有评分记录，暂不能修改分项。</div>;
  const patch: ManualScoreComponents = {};
  const overrides: ManualScoreComponents = {};
  let invalid = false;
  for (const key of SCORE_COMPONENT_KEYS) {
    if (key === 'n' && state.rule_version === 'v1_spcr') continue;
    const text = draft[key];
    const value = text === null ? null : Number(text);
    if (text !== null && (!text.trim() || !Number.isFinite(value) || value! < 0 || value! > 100)) invalid = true;
    const rounded = value === null ? null : Math.round(value * 100) / 100;
    overrides[key] = rounded;
    if (rounded !== (state.overrides[key] ?? null)) patch[key] = rounded;
  }
  const dirty = Object.keys(patch).length > 0;
  const total = invalid ? null : finalComponentTotal(applyScoreComponents(state.automatic, overrides, state.rule_version), state.rule_version, state.cold_start_factor);
  async function save(values: ManualScoreComponents) {
    setSaving(true); setError(''); setSaved(false);
    try { await onSave(values); setSaved(true); }
    catch (err) { setError(err instanceof Error ? err.message : '分项保存失败'); }
    finally { setSaving(false); }
  }
  return (
    <section className="col-span-full rounded-2xl border border-neutral-200 bg-neutral-50 p-4" aria-label="分项评分">
      <h3 className="font-semibold text-neutral-900">分项评分</h3>
      <p className="mt-1 text-xs text-neutral-500">修改仅对所选日期生效，原始探测数据不变。未修改的分项继续自动计算。</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SCORE_COMPONENT_KEYS.map((key) => {
          const inactive = key === 'n' && state.rule_version === 'v1_spcr';
          return <div key={key}>
            <label className="block text-xs text-neutral-600" htmlFor={`component-score-${key}`}>{LABELS[key]}</label>
            <input id={`component-score-${key}`} type="number" min="0" max="100" step="0.01"
              className="mt-2 min-h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 disabled:bg-neutral-100"
              value={inactive ? '' : draft[key] ?? state.automatic[key] ?? ''} disabled={saving || inactive}
              onChange={(event) => { setDraft((current) => ({ ...current, [key]: event.target.value })); setSaved(false); }} />
            <div className="mt-1 flex min-h-10 items-center justify-between gap-2 text-xs text-neutral-500">
              <span>{inactive ? '历史 v1 不参与计算' : `自动值：${state.automatic[key]?.toFixed(2) ?? '—'}`}</span>
              {!inactive && draft[key] !== null && <button type="button" className="min-h-10 px-1 underline underline-offset-4 disabled:opacity-50" disabled={saving}
                onClick={() => { setDraft((current) => ({ ...current, [key]: null })); setSaved(false); }}>恢复自动值</button>}
            </div>
          </div>;
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <div aria-live="polite">
          <span className="text-sm text-neutral-600">公式总分</span>
          <output className="ml-3 font-mono text-xl font-bold">{total?.toFixed(2) ?? '—'}</output>
          {dirty && <span className="ml-2 text-xs text-amber-700">未保存</span>}
          <p className="mt-1 text-xs text-neutral-500">冷启动系数：{state.cold_start_factor} · 有效数据 {state.data_days} 天</p>
        </div>
        <button type="button" className="min-h-10 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={saving || invalid || (!dirty && state.legacy_total_score === null)} onClick={() => void save(patch)}>
          {saving ? '保存中...' : '保存分数'}
        </button>
      </div>
      {state.legacy_total_score !== null && <div className="mt-3 text-xs text-amber-700">
        当前仍展示旧人工总分 {state.legacy_total_score.toFixed(2)}，保存分项后将使用上方公式总分。
        <button type="button" className="ml-2 min-h-10 underline underline-offset-4" disabled={saving}
          onClick={() => void save(Object.fromEntries(SCORE_COMPONENT_KEYS.map((key) => [key, null])))}>恢复全部自动评分</button>
      </div>}
      {invalid && <p className="mt-3 text-xs text-rose-600" role="alert">每项必须填写 0 到 100 之间的数字。</p>}
      {error && <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p>}
      {saved && !dirty && <p className="mt-3 text-xs text-emerald-700" role="status">分项分数已保存</p>}
    </section>
  );
}
