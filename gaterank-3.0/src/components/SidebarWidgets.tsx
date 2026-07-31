import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, Download, Tv, Globe, ShieldAlert, Briefcase, Sparkles, ChevronRight, Megaphone, X } from 'lucide-react';
import { UtilityTool, Airport, UTILITY_TOOLS, Announcement, INITIAL_ANNOUNCEMENTS } from '../types';

interface SidebarWidgetsProps {
  onOpenDetails: (airport: Airport) => void;
  onOpenTool: (toolType: string) => void;
  airports: Airport[];
}

export default function SidebarWidgets({ onOpenDetails, onOpenTool, airports }: SidebarWidgetsProps) {
  // Filter out sponsored items
  const sponsoredAirports = airports.filter(a => a.isSponsored && a.status === 'normal');
  const [selectedAnnounce, setSelectedAnnounce] = useState<Announcement | null>(null);

  // Helper to render tool icon based on configuration
  const getToolIcon = (name: string) => {
    switch (name) {
      case 'Download': return <Download className="h-5 w-5 text-blue-500" />;
      case 'Tv': return <Tv className="h-5 w-5 text-purple-500" />;
      case 'Globe': return <Globe className="h-5 w-5 text-emerald-500" />;
      case 'ShieldAlert': return <ShieldAlert className="h-5 w-5 text-amber-500" />;
      default: return <Briefcase className="h-5 w-5 text-teal-500" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Widget 2: 探索更多优质机场 Promo banner */}
      <div className="relative overflow-hidden rounded-[24px] bg-indigo-950 p-6 text-white shadow-md">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-indigo-500/10 blur-xl"></div>
        <div className="absolute left-6 bottom-0 h-32 w-32 rounded-full bg-violet-500/10 blur-xl"></div>
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-amber-300">
            <Sparkles className="h-4 w-4" />
            <span>EXCELLENCE IN CONSOLIDATION</span>
          </div>
          
          <h4 className="font-sans text-[19px] sm:text-[20px] font-black leading-tight tracking-tight">
            探索更多优质机场
          </h4>
          <p className="text-[13px] leading-relaxed text-indigo-100">
            想快速找出适合特定需求的高阶中转网络么？寻找配有电竞游戏级别优化、4K Netflix HDR高流控或双向原生 IP 的高级套餐通道。
          </p>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              const elem = document.getElementById('gaterank-ranking-section');
              if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white text-indigo-200 hover:text-black py-2.5 px-4.5 text-[13px] font-bold transition-all cursor-pointer border border-white/10"
          >
            <span>立即探索</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      </div>

      {/* Widget 3: 实用工具 (Utility Tools) */}
      <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
          <h3 className="font-sans text-[16px] sm:text-[17px] font-black tracking-tight text-gray-900 flex items-center gap-2">
            <Briefcase className="h-4.5 w-4.5 text-indigo-500" />
            实用工具
          </h3>
          <span className="text-[12.5px] font-bold text-gray-400">更多工具</span>
        </div>

        <div className="space-y-3.5">
          {UTILITY_TOOLS.map((tool) => (
            <div
              key={tool.id}
              onClick={() => onOpenTool(tool.type)}
              className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-gray-55 hover:bg-gray-50/50 hover:border-gray-150 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 border border-gray-100 shrink-0">
                  {getToolIcon(tool.iconName)}
                </div>
                <div className="flex flex-col">
                  <span className="text-[13.5px] font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">
                    {tool.name}
                  </span>
                  <span className="text-[11.5px] text-gray-500 leading-normal mt-0.5 max-w-[170px] truncate font-medium">
                    {tool.description}
                  </span>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-600 transition-colors shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Widget 4: 公告与动态 (Announcements & News) */}
      <div id="announcement-dynamics-section" className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
          <h3 className="font-sans text-[16px] sm:text-[17px] font-black tracking-tight text-gray-900 flex items-center gap-2">
            <Megaphone className="h-4.5 w-4.5 text-indigo-500 animate-pulse" />
            公告与动态
          </h3>
          <button
            onClick={() => setSelectedAnnounce(INITIAL_ANNOUNCEMENTS[0])}
            className="text-[12.5px] font-bold text-gray-400 hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer"
          >
            <span>更多</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* List items */}
        <div className="divide-y divide-gray-50 space-y-1.5">
          {INITIAL_ANNOUNCEMENTS.slice(0, 5).map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedAnnounce(item)}
              className="group flex items-center justify-between gap-2.5 text-[13px] py-2.5 first:pt-0 last:pb-0 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 group-hover:scale-125 transition-transform" />
                <span className="font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors leading-relaxed truncate max-w-[160px] md:max-w-[210px]">
                  {item.title}
                </span>
              </div>
              <span className="font-mono text-[11px] text-gray-400 whitespace-nowrap">{item.date}</span>
            </div>
          ))}
        </div>

        <div className="text-[11.5px] font-bold text-gray-500 bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-center mt-3 select-none leading-normal">
          📢 测速物理中转每日清晨 6 点重算评分
        </div>
      </div>

      {/* Announcement detail popup modal directly integrated inside */}
      <AnimatePresence>
        {selectedAnnounce && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg overflow-hidden bg-white rounded-3xl p-6 shadow-2xl border border-gray-100"
            >
              <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-indigo-600 tracking-wider uppercase">GateRank 官方公告</span>
                  <h4 className="font-sans text-[16px] font-black text-gray-900 leading-tight text-left">{selectedAnnounce.title}</h4>
                </div>
                <button
                  onClick={() => setSelectedAnnounce(null)}
                  className="rounded-full p-1.5 hover:bg-gray-50 text-gray-400 hover:text-black cursor-pointer transition-all shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <p className="my-5 text-xs md:text-sm leading-relaxed text-gray-600 font-semibold whitespace-pre-wrap text-left">
                {selectedAnnounce.content}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-gray-50 text-[10px] text-gray-400 font-mono">
                <span>网络情报发布: 2026-05-{selectedAnnounce.date}</span>
                <span className="font-bold text-indigo-600">GateRank 安全委员会</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
