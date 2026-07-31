import React from 'react';
import { TrendingUp, Zap, ShieldCheck, AlertTriangle, Star, Sparkles, ChevronRight } from 'lucide-react';
import { Airport } from '../types';

interface BottomGridProps {
  airports: Airport[];
  onOpenDetails: (airport: Airport) => void;
  onSelectCategory: (category: string) => void;
}

export default function BottomGrid({ airports, onOpenDetails, onSelectCategory }: BottomGridProps) {
  
  // 1. 新秀机场 (Rookies)
  const rookies = airports
    .filter(a => a.categories.includes('新秀机场') && a.status === 'normal')
    .slice(0, 4);

  // 2. 性价比最佳 (Best Value)
  const bestValue = airports
    .filter(a => a.status === 'normal')
    .sort((a, b) => (b.price === 0 ? 0 : b.rating / b.price) - (a.price === 0 ? 0 : a.rating / a.price))
    .slice(0, 4);

  // 3. 长期稳定机场 (Long-term Stable)
  const longTermStable = airports
    .filter(a => a.status === 'normal')
    .sort((a, b) => b.nodes - a.nodes)
    .slice(0, 4);

  // 4. 风险预警 (Risk Warnings)
  const riskAirports = airports
    .filter(a => a.status === 'risk' || a.status === 'scam')
    .slice(0, 4);

  const handleCategoryClick = (catVal: string) => {
    onSelectCategory(catVal);
    const elem = document.getElementById('gaterank-ranking-section');
    if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderRankBadge = (idx: number, type: 'normal' | 'risk') => {
    if (type === 'risk') {
      return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-rose-100 text-[11px] font-black text-rose-700">
          {idx + 1}
        </span>
      );
    }
    if (idx === 0) {
      return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-amber-500 text-[11px] font-black text-white shadow-xs">
          1
        </span>
      );
    }
    if (idx === 1) {
      return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-slate-300 to-slate-400 text-[11px] font-black text-white shadow-xs">
          2
        </span>
      );
    }
    if (idx === 2) {
      return (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-600 to-amber-700 text-[11px] font-black text-white shadow-xs">
          3
        </span>
      );
    }
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[11px] font-bold text-gray-500">
        {idx + 1}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: 新秀机场 */}
        <div className="group/card rounded-[24px] border border-gray-150 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3.5 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <TrendingUp className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-sans text-[16px] font-black tracking-tight text-gray-900 leading-tight">
                    新秀机场
                  </h3>
                  <span className="text-[11px] font-semibold text-gray-400">潜力新晋 · 近期上榜</span>
                </div>
              </div>
              <button
                onClick={() => handleCategoryClick('新秀机场')}
                className="text-[12px] font-bold text-gray-400 hover:text-indigo-600 flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <span>更多</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Items List */}
            <div className="space-y-2">
              {rookies.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => onOpenDetails(item)}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-gray-50/60 hover:bg-white hover:border-indigo-200 border border-transparent shadow-2xs hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {renderRankBadge(idx, 'normal')}

                    <div className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-gradient-to-br ${item.logoColor} text-white font-black text-[11px] shadow-2xs shrink-0 select-none`}>
                      {item.logoText}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-[13.5px] font-black text-gray-800 truncate group-hover:text-indigo-600 transition-colors">
                        {item.name}
                      </span>
                      <span className="text-[10.5px] text-gray-400 font-medium truncate">
                        观察 {item.nodes} 天 · ¥{item.price.toFixed(1)}/月
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-lg">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="font-mono text-[12px] font-extrabold text-amber-800">{item.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: 性价比最佳 */}
        <div className="group/card rounded-[24px] border border-gray-150 bg-white p-5 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-300 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3.5 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
                  <Zap className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-sans text-[16px] font-black tracking-tight text-gray-900 leading-tight">
                    性价比最佳
                  </h3>
                  <span className="text-[11px] font-semibold text-gray-400">大带宽 · 日常省钱</span>
                </div>
              </div>
              <button
                onClick={() => handleCategoryClick('性价比榜')}
                className="text-[12px] font-bold text-gray-400 hover:text-emerald-600 flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <span>更多</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Items List */}
            <div className="space-y-2">
              {bestValue.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => onOpenDetails(item)}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-gray-50/60 hover:bg-white hover:border-emerald-200 border border-transparent shadow-2xs hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {renderRankBadge(idx, 'normal')}

                    <div className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-gradient-to-br ${item.logoColor} text-white font-black text-[11px] shadow-2xs shrink-0 select-none`}>
                      {item.logoText}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-[13.5px] font-black text-gray-800 truncate group-hover:text-emerald-600 transition-colors">
                        {item.name}
                      </span>
                      <span className="text-[10.5px] text-gray-400 font-medium truncate">
                        ¥{item.price.toFixed(1)}/月 · 超高性价比
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-lg">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="font-mono text-[12px] font-extrabold text-amber-800">{item.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: 长期稳定机场 */}
        <div className="group/card rounded-[24px] border border-gray-150 bg-white p-5 shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-300 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3.5 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-50 border border-sky-100 text-sky-600">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-sans text-[16px] font-black tracking-tight text-gray-900 leading-tight">
                    长期稳定机场
                  </h3>
                  <span className="text-[11px] font-semibold text-gray-400">IEPL专线 · 不宕机</span>
                </div>
              </div>
              <button
                onClick={() => handleCategoryClick('稳定性榜')}
                className="text-[12px] font-bold text-gray-400 hover:text-sky-600 flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <span>更多</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Items List */}
            <div className="space-y-2">
              {longTermStable.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => onOpenDetails(item)}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-gray-50/60 hover:bg-white hover:border-sky-200 border border-transparent shadow-2xs hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {renderRankBadge(idx, 'normal')}

                    <div className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-gradient-to-br ${item.logoColor} text-white font-black text-[11px] shadow-2xs shrink-0 select-none`}>
                      {item.logoText}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-[13.5px] font-black text-gray-800 truncate group-hover:text-sky-600 transition-colors">
                        {item.name}
                      </span>
                      <span className="text-[10.5px] text-gray-400 font-medium truncate">
                        观察 {item.nodes} 天 · 极低延迟
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-lg">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="font-mono text-[12px] font-extrabold text-amber-800">{item.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 4: 风险预警 */}
        <div className="group/card rounded-[24px] border border-gray-150 bg-white p-5 shadow-sm hover:shadow-md hover:border-rose-200 transition-all duration-300 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3.5 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-100 text-rose-600">
                  <AlertTriangle className="h-4.5 w-4.5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-sans text-[16px] font-black tracking-tight text-gray-900 leading-tight">
                    风险预警
                  </h3>
                  <span className="text-[11px] font-semibold text-rose-500">避坑红榜 · 实时防封</span>
                </div>
              </div>
              <button
                onClick={() => {
                  const elem = document.getElementById('announcement-dynamics-section');
                  if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="text-[12px] font-bold text-gray-400 hover:text-rose-600 flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <span>红榜</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Items List */}
            <div className="space-y-2">
              {riskAirports.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => onOpenDetails(item)}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-rose-50/30 hover:bg-rose-50/70 hover:border-rose-200 border border-transparent transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {renderRankBadge(idx, 'risk')}

                    <div className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-gradient-to-br ${item.logoColor} text-white font-black text-[11px] shadow-2xs shrink-0 select-none`}>
                      {item.logoText}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-[13.5px] font-black text-gray-800 truncate group-hover:text-rose-600 transition-colors">
                        {item.name}
                      </span>
                      <span className="text-[10.5px] text-rose-500/90 font-medium truncate">
                        {item.status === 'scam' ? '网站关停 / 删群跑路' : `风险指数 ${item.riskScore || 90}%`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold text-white shadow-2xs ${
                      item.status === 'scam' ? 'bg-red-600' : 'bg-amber-500'
                    }`}>
                      {item.status === 'scam' ? '已跑路' : '极高风险'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
