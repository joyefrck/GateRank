import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowUpRight, LogIn, ExternalLink } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenLogin: () => void;
  onOpenApply: () => void;
  onSelectCategory: (category: string) => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  onOpenLogin,
  onOpenApply,
  onSelectCategory,
}: HeaderProps) {
  const menuItems = [
    { label: '首页', val: 'today', hasBadge: false, bText: '' },
    { label: '机场排行', val: 'all', hasBadge: false, bText: '' },
    { label: '活动优惠', val: 'offers', hasBadge: false, bText: '' },
    { label: '跑路监测', val: 'scam-monitor', hasBadge: true, bText: '快照' },
    { label: '测评方法', val: 'methods', hasBadge: false, bText: '' },
    { label: 'News', val: 'news', hasBadge: false, bText: '' },
  ];

  const handleMenuClick = (item: typeof menuItems[0]) => {
    setActiveTab(item.val);
    if (item.val === 'scam-monitor') {
      onSelectCategory('跑路监测');
      const elem = document.getElementById('gaterank-ranking-section');
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (item.val === 'all') {
      onSelectCategory('综合排名');
      const elem = document.getElementById('gaterank-ranking-section');
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (item.val === 'today') {
      const elem = document.getElementById('today-discovery-section');
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (item.val === 'offers') {
      const elem = document.getElementById('sponsored-recommend-section');
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (item.val === 'methods' || item.val === 'news') {
      const elem = document.getElementById('announcement-dynamics-section');
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo - Completely matched from Image 2 */}
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-black shadow-sm"
          >
            {/* Lightning bolt SVG icon exactly as in image 2/3 */}
            <svg 
              className="h-5 w-5 text-white" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </motion.div>
          
          <div className="flex flex-col">
            <span className="font-sans text-[17px] font-bold tracking-tight text-gray-900 sm:text-[19px]">
              机场榜<span className="font-mono text-black">GateRank</span>
            </span>
          </div>
        </div>

        {/* Middle Navigation - Exactly matching Image 2 */}
        <nav className="hidden items-center gap-1 md:flex lg:gap-2">
          {menuItems.map((item) => {
            const isActive = activeTab === item.val;
            
            const navColorClass = isActive
              ? 'bg-rose-50 text-rose-500 font-semibold border border-rose-200/60 shadow-2xs'
              : 'text-gray-600 hover:bg-gray-50 hover:text-black border border-transparent';

            return (
              <button
                key={item.label}
                id={`menu-item-${item.val}`}
                onClick={() => handleMenuClick(item)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-medium transition-all duration-200 cursor-pointer ${navColorClass}`}
              >
                <span>{item.label}</span>
                {item.hasBadge && (
                  <span className="flex h-[18px] items-center rounded bg-rose-500 px-1 text-[10px] font-bold text-white uppercase tracking-wider">
                    {item.bText}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Action buttons - Completely matching Image 2 */}
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenLogin}
            className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-2 text-[14px] font-medium text-gray-700 hover:bg-gray-100 hover:text-black transition-all cursor-pointer shadow-sm"
          >
            <LogIn className="h-4 w-4" />
            <span>登录</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -0.5 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenApply}
            className="flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-[14px] font-medium text-white transition-all hover:bg-gray-800 cursor-pointer shadow-sm"
          >
            <span>申请入驻测试</span>
            <ArrowUpRight className="h-4 w-4" />
          </motion.button>
        </div>
        
      </div>
    </header>
  );
}
