import React from 'react';
import { motion } from 'motion/react';
import { Star, Sparkles, ExternalLink } from 'lucide-react';
import { Airport } from '../types';

interface TodayDiscoveryProps {
  airports: Airport[];
  onOpenDetails: (airport: Airport) => void;
  onOpenApply?: () => void;
}

export default function TodayDiscovery({ airports, onOpenDetails, onOpenApply }: TodayDiscoveryProps) {
  // Find sponsored or normal airports for the 4 commercial ad slots
  const sponsoredList = airports.filter(a => a.isSponsored && a.status === 'normal');
  const normalList = airports.filter(a => !a.isSponsored && a.status === 'normal');
  
  // Combine to ensure up to 4 ad items
  const adAirports = [...sponsoredList, ...normalList].slice(0, 4);

  // Fill up to 4 slots if fewer than 4 exist
  const slotsCount = 4;
  const itemsToDisplay = [...adAirports];

  // Helper function to render colorful tag badges
  const renderTagBadge = (tag: string) => {
    const tLower = tag.toLowerCase().trim();
    if (tLower.includes('iepl') || tLower.includes('专线') || tLower.includes('极速')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200/60 px-2 py-0.5 text-[10.5px] font-extrabold text-blue-600 tracking-wide select-none whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
          {tag}
        </span>
      );
    }
    if (tLower.includes('解锁') || tLower.includes('netflix') || tLower.includes('disney') || tLower.includes('ip') || tLower.includes('ai') || tLower.includes('chatgpt') || tLower.includes('claude')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200/60 px-2 py-0.5 text-[10.5px] font-extrabold text-purple-600 tracking-wide select-none whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
          {tag}
        </span>
      );
    }
    if (tLower.includes('性价比') || tLower.includes('折') || tLower.includes('立减') || tLower.includes('省') || tLower.includes('年付')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-600 tracking-wide select-none whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          {tag}
        </span>
      );
    }
    if (tLower.includes('稳定') || tLower.includes('可靠') || tLower.includes('节点') || tLower.includes('多国')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200/60 px-2 py-0.5 text-[10.5px] font-extrabold text-sky-600 tracking-wide select-none whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
          {tag}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[10.5px] font-extrabold text-amber-700 tracking-wide select-none whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
        {tag}
      </span>
    );
  };

  return (
    <div 
      id="today-discovery-section" 
      className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8"
    >
      <div id="commercial-cooperation-section" id2="sponsored-recommend-section" className="bg-white border border-gray-100 p-5 rounded-[24px] shadow-sm flex flex-col justify-between">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-2 select-none">
          <div className="flex items-center gap-2.5">
            <span className="text-[17px] sm:text-[18px] font-black text-gray-900 tracking-tight">商业合作专区</span>
            <span className="rounded-md bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[10.5px] font-extrabold text-amber-700 tracking-wide uppercase flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              广告展位
            </span>
            <span className="hidden md:inline-block text-[12px] text-gray-400 font-medium">
              独立于机场评分
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-bold text-gray-400">官方合作招商中</span>
            {onOpenApply && (
              <button
                onClick={onOpenApply}
                className="text-[11.5px] font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                申请入驻 &gt;
              </button>
            )}
          </div>
        </div>

        {/* 4 Ad Slots Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {Array.from({ length: slotsCount }).map((_, idx) => {
            const airport = itemsToDisplay[idx];

            if (airport) {
              return (
                <motion.div
                  key={airport.id}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden rounded-[20px] bg-gradient-to-b from-slate-50/60 to-white border border-gray-150 p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 group min-h-[225px]"
                >
                  {/* Top Row: Logo, Name, AD Badge */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${airport.logoColor} text-white font-black text-xs shadow-sm shrink-0 select-none`}>
                          {airport.logoText}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[14px] sm:text-[15px] font-black text-gray-900 truncate leading-tight group-hover:text-indigo-600 transition-colors">
                            {airport.name}
                          </span>
                          <span className="text-[11.5px] text-gray-400 font-mono leading-none mt-1">
                            {airport.nodes} 天观察 · {airport.rating} 分
                          </span>
                        </div>
                      </div>
                      
                      <span className="shrink-0 rounded bg-stone-100 border border-stone-200/80 px-1.5 py-0.5 text-[9.5px] font-black text-stone-600 uppercase tracking-wider select-none leading-none">
                        {airport.sponsoredText || 'AD 广告'}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[12.5px] leading-relaxed text-gray-500 line-clamp-2 font-medium">
                      {airport.description}
                    </p>

                    {/* Feature tags */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {airport.tags.slice(0, 2).map((tag, tIdx) => (
                        <React.Fragment key={tIdx}>
                          {renderTagBadge(tag)}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Panel */}
                  <div className="pt-3 border-t border-gray-100 mt-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-400 block leading-none font-bold">起步月付</span>
                        <span className="font-mono text-[15px] font-black text-indigo-600">
                          ¥{airport.price.toFixed(1)} <span className="text-[10.5px] font-normal text-gray-400">/起</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/50 rounded-lg py-0.5 px-2">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-mono text-[12px] font-extrabold text-amber-700">{airport.rating}</span>
                      </div>
                    </div>

                    {/* Action buttons matching RankTable style */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        onClick={() => onOpenDetails(airport)}
                        className="flex-1 py-2 px-2 bg-stone-900 border border-stone-900 hover:bg-black text-white text-[12px] font-black rounded-xl shadow-xs transition-colors text-center cursor-pointer flex items-center justify-center gap-1 select-none whitespace-nowrap leading-none"
                      >
                        <span>查看报告</span>
                        <span className="font-sans text-[10px] font-extrabold">&gt;</span>
                      </button>
                      <a
                        href={airport.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 py-2 px-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-755 hover:border-gray-300 text-[12px] font-bold rounded-xl transition-all shadow-sm text-center cursor-pointer flex items-center justify-center gap-1 select-none whitespace-nowrap leading-none"
                      >
                        <span>官网</span>
                        <ExternalLink className="h-3 w-3 text-gray-400 shrink-0" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              );
            }

            // Placeholder Ad slot if fewer than 4 airports
            return (
              <div
                key={`empty-ad-${idx}`}
                onClick={onOpenApply}
                className="relative overflow-hidden rounded-[20px] bg-gray-50/70 border border-dashed border-gray-250 p-4.5 flex flex-col justify-between items-center text-center cursor-pointer hover:bg-indigo-50/20 hover:border-indigo-300 transition-all min-h-[225px] group"
              >
                <div className="my-auto space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 font-bold group-hover:scale-110 transition-transform">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <span className="font-extrabold text-[14px] text-gray-800 block">商业广告位招募中</span>
                  <p className="text-[12px] text-gray-400 max-w-[180px] mx-auto leading-relaxed">
                    提供每日数万次独立IP展示与多节点深度测速背书
                  </p>
                </div>
                <button className="w-full py-2 bg-white border border-gray-200 text-gray-700 text-[12px] font-bold rounded-xl group-hover:bg-stone-900 group-hover:text-white group-hover:border-stone-900 transition-colors">
                  联系商务合作
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}


