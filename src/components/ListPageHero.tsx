import type React from 'react';

type ListPageHeroTone = 'default' | 'alert' | 'orange' | 'sky';

export function ListPageHero({
  eyebrow,
  title,
  subtitle,
  description,
  stats,
  tone = 'default',
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  stats: Array<{ label: string; value: React.ReactNode }>;
  tone?: ListPageHeroTone;
}) {
  const isAlert = tone === 'alert';
  const isOrange = tone === 'orange';
  const isSky = tone === 'sky';
  const sectionClassName = isAlert
    ? 'relative overflow-hidden rounded-[32px] border border-neutral-200 bg-[linear-gradient(135deg,#3f0f19_0%,#1f172a_34%,#f7f2f4_100%)] px-6 py-8 md:px-10 md:py-12 text-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]'
    : isOrange
      ? 'relative overflow-hidden rounded-[32px] border border-orange-200/20 bg-[linear-gradient(135deg,#241207_0%,#6F2F0B_38%,#D97706_72%,#F7D7B2_100%)] px-6 py-8 md:px-10 md:py-12 text-white shadow-[0_30px_80px_rgba(120,53,15,0.22)]'
      : isSky
        ? 'relative overflow-hidden rounded-[32px] border border-sky-200/20 bg-[linear-gradient(135deg,#082F49_0%,#075985_38%,#0284C7_72%,#BAE6FD_100%)] px-6 py-8 md:px-10 md:py-12 text-white shadow-[0_30px_80px_rgba(2,132,199,0.18)]'
      : 'relative overflow-hidden rounded-[32px] border border-neutral-200 bg-[linear-gradient(135deg,#111827_0%,#0f172a_38%,#f8fafc_100%)] px-6 py-8 md:px-10 md:py-12 text-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]';
  const overlayStyle = isAlert
    ? {
        backgroundImage:
          'radial-gradient(circle at top left, rgba(251,113,133,0.34), transparent 34%), radial-gradient(circle at bottom right, rgba(255,255,255,0.22), transparent 30%)',
      }
    : isOrange
      ? {
          backgroundImage:
            'radial-gradient(circle at top left, rgba(255,237,213,0.34), transparent 35%), radial-gradient(circle at bottom right, rgba(36,18,7,0.28), transparent 32%)',
        }
      : isSky
        ? {
            backgroundImage:
              'radial-gradient(circle at top left, rgba(186,230,253,0.34), transparent 35%), radial-gradient(circle at bottom right, rgba(8,47,73,0.28), transparent 32%)',
          }
      : { backgroundImage: 'radial-gradient(circle at top left, rgba(255,255,255,0.28), transparent 35%)' };
  const eyebrowClassName = isAlert
    ? 'inline-flex items-center gap-2 rounded-full border border-rose-200/20 bg-rose-200/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-rose-50/88 backdrop-blur'
    : isOrange
      ? 'inline-flex items-center gap-2 rounded-full border border-orange-100/20 bg-orange-100/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-orange-50/88 backdrop-blur'
      : isSky
        ? 'inline-flex items-center gap-2 rounded-full border border-sky-100/20 bg-sky-100/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-sky-50/88 backdrop-blur'
      : 'inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur';
  const statCardClassName = isAlert
    ? 'rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur'
    : isOrange
      ? 'rounded-2xl border border-white/12 bg-white/12 p-4 backdrop-blur'
      : isSky
        ? 'rounded-2xl border border-white/12 bg-white/12 p-4 backdrop-blur'
      : 'rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur';
  const statLabelClassName = isAlert
    ? 'text-[11px] uppercase tracking-[0.18em] text-rose-50/62 font-black'
    : isOrange
      ? 'text-[11px] uppercase tracking-[0.18em] text-orange-50/68 font-black'
      : isSky
        ? 'text-[11px] uppercase tracking-[0.18em] text-sky-50/68 font-black'
      : 'text-[11px] uppercase tracking-[0.18em] text-white/60 font-black';
  const subtitleClassName = isAlert ? 'block text-rose-50/42' : isOrange ? 'block text-orange-50/46' : isSky ? 'block text-sky-50/46' : 'block text-white/45';

  return (
    <section className={sectionClassName}>
      <div className="absolute inset-0 opacity-20" style={overlayStyle} />
      <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
        <div>
          <div className={eyebrowClassName}>
            {eyebrow}
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl md:text-5xl lg:text-[56px] font-black leading-[0.95] tracking-tight">
            {title}
            <span className={subtitleClassName}>{subtitle}</span>
          </h1>
          <p className="mt-5 max-w-3xl text-sm md:text-base leading-7 text-white/72">
            {description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((item) => (
            <div key={item.label} className={statCardClassName}>
              <div className={statLabelClassName}>{item.label}</div>
              <div className="mt-2 text-[clamp(1.45rem,5vw,1.875rem)] font-black leading-tight text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
