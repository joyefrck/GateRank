import React from 'react';

type TagBadgeSize = 'sm' | 'md';

interface TagBadgeProps {
  key?: React.Key;
  tag: string;
  size?: TagBadgeSize;
  className?: string;
}

interface TagBadgeGroupProps {
  tags: string[];
  size?: TagBadgeSize;
  emptyLabel?: string;
  className?: string;
}

interface TagTone {
  className: string;
  dotClassName: string;
}

const TAG_TONES: Record<string, TagTone> = {
  不推荐: {
    className:
      'border-rose-300/90 bg-[linear-gradient(135deg,#fff1f2_0%,#ffe4e6_50%,#fecdd3_100%)] text-rose-800 shadow-[0_10px_24px_-18px_rgba(225,29,72,0.95)]',
    dotClassName: 'bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.14)]',
  },
  风险观察: {
    className:
      'border-orange-300/90 bg-[linear-gradient(135deg,#fff7ed_0%,#ffedd5_50%,#fed7aa_100%)] text-orange-900 shadow-[0_10px_24px_-18px_rgba(234,88,12,0.9)]',
    dotClassName: 'bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.16)]',
  },
  新入榜: {
    className:
      'border-amber-300/90 bg-[linear-gradient(135deg,#fffbeb_0%,#fef3c7_55%,#fde68a_100%)] text-amber-900 shadow-[0_10px_24px_-18px_rgba(217,119,6,0.95)]',
    dotClassName: 'bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.16)]',
  },
  长期稳定: {
    className:
      'border-emerald-300/90 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_55%,#a7f3d0_100%)] text-emerald-900 shadow-[0_10px_24px_-18px_rgba(5,150,105,0.92)]',
    dotClassName: 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]',
  },
  新手友好: {
    className:
      'border-teal-300/90 bg-[linear-gradient(135deg,#f0fdfa_0%,#ccfbf1_50%,#99f6e4_100%)] text-teal-900 shadow-[0_10px_24px_-18px_rgba(13,148,136,0.92)]',
    dotClassName: 'bg-teal-500 shadow-[0_0_0_4px_rgba(20,184,166,0.14)]',
  },
  性价比高: {
    className:
      'border-yellow-300/90 bg-[linear-gradient(135deg,#fefce8_0%,#fef3c7_55%,#fde68a_100%)] text-yellow-900 shadow-[0_10px_24px_-18px_rgba(202,138,4,0.95)]',
    dotClassName: 'bg-yellow-500 shadow-[0_0_0_4px_rgba(234,179,8,0.16)]',
  },
  高性能: {
    className:
      'border-sky-300/90 bg-[linear-gradient(135deg,#ecfeff_0%,#e0f2fe_50%,#bae6fd_100%)] text-sky-900 shadow-[0_10px_24px_-18px_rgba(2,132,199,0.95)]',
    dotClassName: 'bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.16)]',
  },
  高端路线: {
    className:
      'border-amber-300/80 bg-[linear-gradient(135deg,#111827_0%,#1f2937_60%,#7c5f10_100%)] text-amber-50 shadow-[0_14px_30px_-18px_rgba(17,24,39,0.95)]',
    dotClassName: 'bg-amber-300 shadow-[0_0_0_4px_rgba(252,211,77,0.18)]',
  },
  观察中: {
    className:
      'border-slate-300/90 bg-[linear-gradient(135deg,#f8fafc_0%,#f1f5f9_55%,#e2e8f0_100%)] text-slate-700 shadow-[0_10px_24px_-18px_rgba(100,116,139,0.7)]',
    dotClassName: 'bg-slate-400 shadow-[0_0_0_4px_rgba(148,163,184,0.14)]',
  },
  流媒体友好: {
    className:
      'border-indigo-300/90 bg-[linear-gradient(135deg,#eef2ff_0%,#ede9fe_50%,#ddd6fe_100%)] text-indigo-900 shadow-[0_10px_24px_-18px_rgba(79,70,229,0.88)]',
    dotClassName: 'bg-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,0.14)]',
  },
  老牌机场: {
    className:
      'border-blue-300/90 bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_55%,#bfdbfe_100%)] text-blue-900 shadow-[0_10px_24px_-18px_rgba(37,99,235,0.88)]',
    dotClassName: 'bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.14)]',
  },
  备用线路多: {
    className:
      'border-cyan-300/90 bg-[linear-gradient(135deg,#ecfeff_0%,#cffafe_55%,#a5f3fc_100%)] text-cyan-900 shadow-[0_10px_24px_-18px_rgba(8,145,178,0.88)]',
    dotClassName: 'bg-cyan-500 shadow-[0_0_0_4px_rgba(6,182,212,0.14)]',
  },
};

const KEYWORD_TONES: Array<{ keywords: string[]; tone: TagTone }> = [
  { keywords: ['不推荐', '跑路', '高风险', '封禁'], tone: TAG_TONES.不推荐 },
  { keywords: ['风险', '观察', '投诉'], tone: TAG_TONES.风险观察 },
  { keywords: ['新', '首发'], tone: TAG_TONES.新入榜 },
  { keywords: ['稳', '可靠'], tone: TAG_TONES.长期稳定 },
  { keywords: ['试用', '新手', '友好'], tone: TAG_TONES.新手友好 },
  { keywords: ['性价比', '便宜', '省钱'], tone: TAG_TONES.性价比高 },
  { keywords: ['高性能', '速度', '游戏', '低延迟'], tone: TAG_TONES.高性能 },
  { keywords: ['高端', '旗舰', 'VIP'], tone: TAG_TONES.高端路线 },
  { keywords: ['流媒体', '奈飞', '解锁'], tone: TAG_TONES.流媒体友好 },
  { keywords: ['老牌', '成熟'], tone: TAG_TONES.老牌机场 },
  { keywords: ['备用', '线路', '节点'], tone: TAG_TONES.备用线路多 },
];

const DEFAULT_TONE: TagTone = {
  className:
    'border-neutral-300/90 bg-[linear-gradient(135deg,#ffffff_0%,#f5f5f5_55%,#e5e5e5_100%)] text-neutral-800 shadow-[0_10px_24px_-18px_rgba(38,38,38,0.45)]',
  dotClassName: 'bg-neutral-700 shadow-[0_0_0_4px_rgba(64,64,64,0.08)]',
};

function resolveTone(tag: string): TagTone {
  const exactMatch = TAG_TONES[tag];
  if (exactMatch) {
    return exactMatch;
  }

  const keywordMatch = KEYWORD_TONES.find((entry) => entry.keywords.some((keyword) => tag.includes(keyword)));
  return keywordMatch?.tone || DEFAULT_TONE;
}

export function TagBadge({
  tag,
  size = 'md',
  className = '',
}: TagBadgeProps): React.JSX.Element {
  const tone = resolveTone(tag);
  const sizeClassName =
    size === 'sm'
      ? 'gap-1.5 px-2.5 py-1 text-[11px] tracking-[0.08em]'
      : 'gap-2 px-3 py-1.5 text-[11px] md:text-xs tracking-[0.1em]';

  return (
    <span
      className={[
        'inline-flex max-w-full items-center rounded-full border font-black whitespace-nowrap transition-transform duration-200 hover:-translate-y-0.5',
        sizeClassName,
        tone.className,
        className,
      ].join(' ')}
    >
      <span className={['h-1.5 w-1.5 shrink-0 rounded-full', tone.dotClassName].join(' ')} />
      <span className="truncate">{tag}</span>
    </span>
  );
}

export function TagBadgeGroup({
  tags,
  size = 'md',
  emptyLabel = '暂无标签',
  className = '',
}: TagBadgeGroupProps): React.JSX.Element {
  if (tags.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-neutral-300 px-3 py-1 text-[11px] font-black tracking-[0.1em] text-neutral-400">
        {emptyLabel}
      </span>
    );
  }

  return (
    <div className={['flex flex-wrap gap-2', className].join(' ')}>
      {tags.map((tag) => (
        <TagBadge key={tag} tag={tag} size={size} />
      ))}
    </div>
  );
}
