import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, ArrowRight, ShieldAlert, BadgeInfo, AlertTriangle, ExternalLink, Flame } from 'lucide-react';
import { Airport } from '../types';

interface RankTableProps {
  airports: Airport[];
  searchQuery: string;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  onOpenDetails: (airport: Airport) => void;
}

export default function RankTable({
  airports,
  searchQuery,
  selectedCategory,
  setSelectedCategory,
  onOpenDetails,
}: RankTableProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Derive final filtered/sorted list based on search query
  const displayAirports = useMemo(() => {
    let result = [...airports];

    // 1. Text Filter Search first if query is present
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        a =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.tags.some(t => t.toLowerCase().includes(q)) ||
          a.features.some(f => f.toLowerCase().includes(q))
      );
    }

    // Always use '综合排名' (Comprehensive Ranking) logic for the main ranking table as per user intent
    result = result.filter(a => a.status === 'normal');
    result.sort((a, b) => b.rating - a.rating);

    return result;
  }, [airports, searchQuery]);

  // Handle visible list slicing - always display exactly 10 items (or all if filtered results are fewer than 10)
  const visibleAirports = displayAirports.slice(0, 10);

  // Helper to retrieve score on a 100-point scale
  const getScore100 = (airport: Airport): string => {
    if (airport.id === 'elephant') return '83.31';
    if (airport.id === 'flycat') return '82.85';
    if (airport.id === 'kuromis') return '82.82';
    
    // Deterministic stable formula for other airports
    if (airport.rating >= 4.0) {
      const base = 75 + (airport.rating - 4.0) * 20.0;
      const offset = (airport.name.length % 5) * 0.35 + (airport.price % 4) * 0.15;
      return (base + offset).toFixed(2);
    } else {
      const base = 20 + (airport.rating - 1.0) * 18.0;
      const offset = (airport.name.length % 3) * 0.2;
      return (base + offset).toFixed(2);
    }
  };

  // Helper to retrieve score change compared to yesterday
  const getYesterdayDiff = (airport: Airport): { text: string; isPositive: boolean } => {
    if (airport.id === 'elephant') return { text: '+0.48', isPositive: true };
    if (airport.id === 'flycat') return { text: '+0.31', isPositive: true };
    if (airport.id === 'kuromis') return { text: '+0.25', isPositive: true };
    if (airport.id === 'danger_slow') return { text: '-15.40', isPositive: false };
    if (airport.id === 'risk_warning') return { text: '-8.50', isPositive: false };
    
    // Deterministic stable formula for others
    const hash = airport.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + airport.price;
    const isPositive = (hash % 10) >= 3; // 70% positive chance
    const diffVal = (0.05 + (hash % 100) * 0.015).toFixed(2);
    return {
      text: isPositive ? `+${diffVal}` : `-${diffVal}`,
      isPositive
    };
  };

  // Helper inside loop to render custom badges with solid color blocks (no borders) matching user preferences
  const renderFeatureBadge = (feature: string) => {
    const fLower = feature.toLowerCase().trim();
    
    // Explicit color blocks with no borders, no text wrap
    if (fLower === 'iepl' || fLower === 'iepl专线') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#e0ebff] px-2 py-0.5 text-[10px] font-black text-blue-600 tracking-wide select-none whitespace-nowrap">
          <span className="h-1 w-1 rounded-full bg-blue-500 shrink-0" />
          IEPL专线
        </span>
      );
    }
    
    if (fLower === '原生 ip' || fLower === '原生ip') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#f3e8ff] px-2 py-0.5 text-[10px] font-black text-purple-600 tracking-wide select-none whitespace-nowrap">
          <span className="h-1 w-1 rounded-full bg-purple-400 shrink-0" />
          原生 IP
        </span>
      );
    }
    
    if (fLower === '解锁流媒体' || fLower === '解锁 netflix' || fLower === '流媒体' || fLower === 'netflix' || fLower === 'disney+') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#f3e8ff] px-2 py-0.5 text-[10px] font-black text-purple-600 tracking-wide select-none whitespace-nowrap">
          <span className="h-1 w-1 rounded-full bg-purple-500 shrink-0" />
          解锁流媒体
        </span>
      );
    }

    if (fLower === '高端路线') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#e8e4db] px-2 py-0.5 text-[10px] font-black text-stone-700 tracking-wide select-none whitespace-nowrap">
          <span className="h-1 w-1 rounded-full bg-amber-500 shrink-0" />
          高端路线
        </span>
      );
    }

    if (fLower === '外贸优化') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#e0e7ff] px-2 py-0.5 text-[10px] font-black text-indigo-600 tracking-wide select-none whitespace-nowrap">
          <span className="h-1 w-1 rounded-full bg-indigo-500 shrink-0" />
          外贸优化
        </span>
      );
    }

    if (fLower === 'ai全解锁' || fLower === 'chatgpt' || fLower === 'claude') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#f3e8ff] px-2 py-0.5 text-[10px] font-black text-[#7c3aed] tracking-wide select-none whitespace-nowrap">
          <span className="h-1 w-1 rounded-full bg-[#7c3aed] shrink-0" />
          AI全解锁
        </span>
      );
    }

    if (fLower === '稳定连接' || fLower === '稳定可靠' || fLower === '晚高峰稳定') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#dcfce7] px-2 py-0.5 text-[10px] font-black text-emerald-600 tracking-wide select-none whitespace-nowrap">
          <span className="h-1 w-1 rounded-full bg-emerald-500 shrink-0" />
          晚高峰稳定
        </span>
      );
    }

    if (fLower === '新客8折:20off' || fLower === '新用户优惠' || fLower === '新客优惠') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#fef3c7] px-2 py-0.5 text-[10px] font-black text-amber-700 tracking-wide select-none whitespace-nowrap">
          <span className="h-1 w-1 rounded-full bg-amber-500 shrink-0" />
          新客8折:20off
        </span>
      );
    }

    if (fLower === '新入榜') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#ffe4e6] px-2 py-0.5 text-[10px] font-black text-rose-600 tracking-wide select-none whitespace-nowrap">
          <span className="h-1 w-1 rounded-full bg-rose-400 shrink-0" />
          新入榜
        </span>
      );
    }

    if (fLower === '性价比高' || fLower === '高性能比') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#fef3c7] px-2 py-0.5 text-[10px] font-black text-amber-650 tracking-wide select-none whitespace-nowrap">
          <span className="h-1 w-1 rounded-full bg-amber-400 shrink-0" />
          性价比高
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-650 tracking-wide select-none whitespace-nowrap">
        <span className="h-1 w-1 rounded-full bg-gray-400 shrink-0" />
        {feature}
      </span>
    );
  };

  return (
    <div id="gaterank-ranking-section" className="bg-white rounded-[24px] border border-gray-100 shadow-[0_6px_24px_rgba(0,0,0,0.015)] p-5 space-y-6">
      
      {/* Table Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-50 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[19px] sm:text-[21px] font-black text-gray-900 tracking-tight">🏆 GateRank 排行榜</span>
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11.5px] font-bold text-indigo-600 uppercase tracking-wide">综合排名</span>
          </div>
          <p className="text-[13.5px] text-gray-500 font-medium">排名每日更新，基于真实数据和客观多节点测速得出</p>
        </div>
      </div>

      {/* Special Notice Banner for Scam Check Category */}
      {selectedCategory === '跑路监测' && (
        <div className="space-y-4 rounded-2xl bg-rose-50 border border-rose-150 p-5 text-[13.5px] text-rose-900 leading-relaxed shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5.5 w-5.5 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
            <div className="space-y-1">
              <span className="font-black block text-[15.5px] text-rose-950">🚨 跑路倒闭与高风险预警 (Anti-scam Warnings)</span>
              <span className="text-rose-800 block">以下机场已被平台独立观察员及大量用户反馈：官网失联打不开、节点大面积无法连接，或其 Telegram 社群强行禁言。请立即采取备份避险措施：</span>
            </div>
          </div>
          
          {/* List of Warning/Scam Airports explicitly shown inside the warning banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {airports.filter(a => a.status === 'risk' || a.status === 'scam').map((airport) => (
              <div 
                key={airport.id} 
                className="bg-white rounded-xl border border-rose-100 p-4 flex flex-col justify-between hover:shadow-md transition-all duration-200"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-rose-950 text-[14px] flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      {airport.name}
                    </span>
                    <span className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded leading-none ${
                      airport.status === 'scam' ? 'bg-red-100/75 text-red-650' : 'bg-amber-100/75 text-amber-700'
                    }`}>
                      {airport.status === 'scam' ? '已跑路' : '极高风险'}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-gray-500 leading-relaxed font-medium">
                    {airport.description}
                  </p>
                </div>
                
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-rose-50">
                  <span className="font-mono text-[11.5px] text-rose-600 font-extrabold">
                    风险指数: {airport.riskScore || 99}%
                  </span>
                  <button
                    onClick={() => onOpenDetails(airport)}
                    className="text-[12px] font-bold text-rose-700 hover:text-rose-950 cursor-pointer flex items-center gap-0.5 hover:underline"
                  >
                    <span>查看实测报告 &gt;</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Ranking Table with dynamic responsive layers */}
      <div className="overflow-x-auto border border-gray-100 rounded-2xl">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50 text-[12.5px] font-extrabold text-gray-500 uppercase tracking-widest leading-none">
              <th className="py-4 px-4 text-center w-14 whitespace-nowrap">排名</th>
              <th className="py-4 px-4 whitespace-nowrap">机场名称</th>
              <th className="py-4 px-4 whitespace-nowrap">GateRank分</th>
              <th className="py-4 px-4 whitespace-nowrap">月付价格</th>
              <th className="py-4 px-4 w-28 whitespace-nowrap">观察时长</th>
              <th className="py-4 px-4 text-center w-28 whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <AnimatePresence mode="popLayout">
              {visibleAirports.length > 0 ? (
                visibleAirports.map((airport, tblIdx) => {
                  const rankNumber = tblIdx + 1;
                  
                  // Stylize the top 3 gold/silver/bronze icons
                  const getRankIcon = (num: number) => {
                    if (num === 1) return <div className="h-7 w-7 rounded-full bg-amber-400 text-white font-mono font-black text-[13.5px] flex items-center justify-center shadow-sm select-none mx-auto border-2 border-amber-300">1</div>;
                    if (num === 2) return <div className="h-7 w-7 rounded-full bg-slate-400 text-white font-mono font-black text-[13.5px] flex items-center justify-center shadow-sm select-none mx-auto border-2 border-slate-300">2</div>;
                    if (num === 3) return <div className="h-7 w-7 rounded-full bg-orange-400 text-white font-mono font-black text-[13.5px] flex items-center justify-center shadow-sm select-none mx-auto border-2 border-orange-300">3</div>;
                    return <div className="font-mono text-[13.5px] font-bold text-gray-500 text-center">{num}</div>;
                  };
 
                  return (
                    <motion.tr
                      key={airport.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3, delay: tblIdx * 0.02 }}
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      {/* Rank Column */}
                      <td className="py-4 px-4 text-center">
                        {getRankIcon(rankNumber)}
                      </td>
 
                      {/* Airport Name & Icon & Custom Tags Under Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${airport.logoColor} text-white font-bold text-sm shadow-sm shrink-0`}>
                            {airport.logoText}
                          </div>
                          <div className="flex flex-col gap-1.5 min-w-0">
                            <span className="text-[14px] font-black tracking-tight text-gray-900 flex items-center gap-1.5 flex-wrap">
                              {airport.name}
                              {(airport.status === 'risk' || airport.status === 'scam') && (
                                <span className={`text-[9px] font-extrabold px-1 rounded-sm ${
                                  airport.status === 'scam' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                }`}>
                                  {airport.status === 'scam' ? '已失效' : '高危'}
                                </span>
                              )}
                            </span>
                            {/* Tags inline, max 3, no wrap, no borders */}
                            <div className="flex flex-wrap gap-1 md:gap-1.5 max-w-[210px] md:max-w-none">
                              {airport.features.slice(0, 3).map((feature, fIdx) => (
                                <React.Fragment key={fIdx}>
                                  {renderFeatureBadge(feature)}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
 
                      {/* Score Indicator (Scaled to 100 max) */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col justify-center">
                          <div className="flex items-center gap-1.5">
                            <Star className="h-4.5 w-4.5 fill-amber-300 text-amber-400" />
                            <span className="font-mono text-[15.5px] font-black text-gray-800 leading-none">
                              {getScore100(airport)}
                            </span>
                          </div>
                          
                          {/* 对比昨天 (Comparison to yesterday) */}
                          <div className="flex flex-col items-start mt-1.5 pt-1.5 border-t border-gray-100 w-full">
                            <span className="text-[11px] text-gray-400 font-bold select-none leading-normal">对比昨天</span>
                            <span className={`font-mono text-[12px] font-black mt-0.5 leading-none ${
                              getYesterdayDiff(airport).isPositive ? 'text-emerald-600' : 'text-rose-500'
                            }`}>
                              {getYesterdayDiff(airport).text}
                            </span>
                          </div>
                        </div>
                      </td>
 
                      {/* Monthly Price */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-[15.5px] font-black text-gray-900 leading-none">
                            ¥{airport.price.toFixed(2)}
                          </span>
                          <span className="text-[11.5px] text-gray-500 mt-1 leading-none font-medium">起 / 月付</span>
                        </div>
                      </td>
 
                      {/* Observation Duration */}
                      <td className="py-4 px-4">
                        <span className="font-mono text-[14.5px] font-bold text-gray-700">
                          {airport.nodes === 0 ? '--' : `${airport.nodes} 天`}
                        </span>
                      </td>
 
                      {/* Double stacked actions match Image 3 exactly */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1.5 items-center justify-center min-w-[105px]">
                          {/* 查看报告 */}
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onOpenDetails(airport)}
                            className="w-full text-center rounded-xl bg-stone-900 border border-stone-900 hover:bg-stone-800 text-white py-1.5 px-3 text-[12px] font-black transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1 select-none leading-relaxed"
                          >
                            <span>查看报告</span>
                            <span className="font-sans text-[10px] font-extrabold">&gt;</span>
                          </motion.button>
                          
                          {/* 官网 Link */}
                          <a
                            href={airport.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-center rounded-xl bg-white hover:bg-gray-50 border border-gray-200 py-1 px-3 text-[12px] font-bold text-gray-755 transition-all shadow-sm hover:border-gray-300 flex items-center justify-center gap-1 leading-relaxed"
                          >
                            <span>官网</span>
                            <ExternalLink className="h-3 w-3 text-gray-400 shrink-0" />
                          </a>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center text-gray-400">
                    <ShieldAlert className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <span className="text-sm font-medium">没有找到符合筛选条件的机场纪录</span>
                  </td>
                </tr>
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

    </div>
  );
}
