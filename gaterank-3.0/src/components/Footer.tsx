import React from 'react';
import { motion } from 'motion/react';

interface FooterProps {
  setActiveTab: (tab: string) => void;
  onSelectCategory: (category: string) => void;
  onOpenApply: () => void;
}

export default function Footer({
  setActiveTab,
  onSelectCategory,
  onOpenApply,
}: FooterProps) {
  
  const handleFootNav = (val: string) => {
    setActiveTab(val);
    if (val === 'scam-monitor') {
      onSelectCategory('跑路监测');
      const elem = document.getElementById('gaterank-ranking-section');
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (val === 'all') {
      onSelectCategory('综合排名');
      const elem = document.getElementById('gaterank-ranking-section');
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (val === 'today') {
      const elem = document.getElementById('today-discovery-section');
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (val === 'offers') {
      const elem = document.getElementById('sponsored-recommend-section');
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (val === 'methods' || val === 'news') {
      const elem = document.getElementById('announcement-dynamics-section');
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (val === 'apply') {
      onOpenApply();
    }
  };

  return (
    <footer className="relative bg-white border-t border-gray-100 py-16 grid-bg overflow-hidden mt-16">
      {/* Grid dots background overlay */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#f3f3f3_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-60"></div>
      
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-8">
        
        {/* Rounded square lightning logo & title - Image 3 */}
        <div className="flex flex-col items-center justify-center gap-3">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-black shadow-sm"
          >
            <svg 
              className="h-6 w-6 text-white" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </motion.div>
          
          <h2 className="font-sans text-[18px] font-bold text-gray-950 tracking-tight">
            机场榜<span className="font-mono font-medium">GateRank</span>
          </h2>
        </div>

        {/* Corporate Statement / Philosophy - Image 3 */}
        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-gray-400">
          机场榜GateRank以公开监测数据、评分趋势和风险记录构建机场推荐体系，帮助用户在今日推荐、全量榜单与测评报告之间完成交叉判断。
        </p>

        {/* Clean nav layout - Image 3 */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-2 text-[14px] font-semibold text-gray-700">
          <button 
            type="button"
            className="hover:text-black cursor-pointer transition-colors"
            onClick={() => handleFootNav('today')}
          >
            今日推荐
          </button>
          <button 
            type="button"
            className="hover:text-black cursor-pointer transition-colors"
            onClick={() => handleFootNav('all')}
          >
            全量榜单
          </button>
          <button 
            type="button"
            className="hover:text-black cursor-pointer transition-colors"
            onClick={() => handleFootNav('offers')}
          >
            活动优惠
          </button>
          <button 
            type="button"
            className="hover:text-black cursor-pointer transition-colors"
            onClick={() => handleFootNav('scam-monitor')}
          >
            跑路监测
          </button>
          <button 
            type="button"
            className="hover:text-black cursor-pointer transition-colors"
            onClick={() => handleFootNav('methods')}
          >
            测评方法
          </button>
          <button 
            type="button"
            className="hover:text-black cursor-pointer transition-colors"
            onClick={() => handleFootNav('news')}
          >
            News
          </button>
          <button 
            type="button"
            className="hover:text-black cursor-pointer transition-colors"
            onClick={() => handleFootNav('apply')}
          >
            申请入驻
          </button>
        </div>

        {/* Divider */}
        <div className="mx-auto max-w-5xl border-t border-gray-100"></div>

        {/* Disclaimer and copyright exactly as in Image 3 */}
        <div className="text-[12px] text-gray-400 font-medium tracking-wide">
          <span>© 2026 机场榜GateRank. All rights reserved. </span>
          <span className="block sm:inline mt-1 sm:mt-0 font-normal text-gray-300">
            评分独立性声明：本站不含任何付费推广排名。
          </span>
        </div>

      </div>
    </footer>
  );
}
