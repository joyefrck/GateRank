import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, ChevronDown, Sparkles, ShieldCheck, Zap, Globe } from 'lucide-react';

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const FAQ_DATA: FaqItem[] = [
  {
    id: '1',
    category: '机场选购',
    question: '什么是 GateRank 机场榜？它是如何评估机场质量的？',
    answer: 'GateRank 3.0 是一个独立客观的机场（SS/SSR/V2Ray/Trojan/Hysteria）监测与综合评分平台。排名由全球 5 大探针节点巡航的真实延迟、丢包率、峰值带宽、流媒体解锁能力（Netflix / Disney+ / ChatGPT）以及稳定运营时长等多维算法驱动，彻底剔除外部商业买榜干预。'
  },
  {
    id: '2',
    category: '线路技术',
    question: '什么是 IEPL 专线、IPLC 专线与直连/中转线路？',
    answer: 'IPLC/IEPL 专线是点对点内网传输线路，流量不经过国家防火墙 GFW，延迟极低且敏感时期几乎不封锁；中转线路由国内高带宽节点转发流量至海外，速度快且性价比高；直连线路为客户端直连海外 VPS，成本低但易受 GFW 干扰波动。'
  },
  {
    id: '3',
    category: '机场选购',
    question: '为什么有的机场价格极低但容易“跑路”？',
    answer: '极低价机场通常采用月抛 VPS 或超卖带宽模式，缺乏可持续盈利模型，极易导致高峰期严重拥堵或随时关站跑路。建议优先选择运营时间 1 年以上、支持月付、且在 GateRank 榜单中处于“观察期良好”的商家。'
  },
  {
    id: '4',
    category: '流媒体与AI',
    question: '如何选择适合自己的翻墙机场节点？',
    answer: '根据实际需求选择：看 4K/8K 视频优先选择高带宽中转或专线；玩外服游戏选择低延迟 IEPL 专线；使用 ChatGPT / Claude 选原生 Clean IP 节点；客户端方面：Windows/Mac 推荐 Clash Verge / Sing-box，iOS 推荐 Shadowrocket（小火箭），Android 推荐 v2rayNG。'
  },
  {
    id: '5',
    category: '流媒体与AI',
    question: '节点解锁 Netflix / Disney+ / ChatGPT 提示被封锁怎么办？',
    answer: '首先检查客户端分流规则是否选择“AI / 流媒体专用节点”，或使用 GateRank 工具箱中的【IP 检测】排查当前出口 IP 是否被 OpenAI 或流媒体平台风控封锁，建议切换至带“原生/Clean IP”标记的节点。'
  },
  {
    id: '6',
    category: '安全隐私',
    question: 'GateRank 是否会收集用户的订阅链接或浏览轨迹？',
    answer: '绝对不会。GateRank 的订阅转换工具与节点测试逻辑完全运行在本地浏览器沙盒或匿名探针端点中，绝不做任何订阅 URL 的服务端存储或日志追踪，切实保障用户的个人隐私安全。'
  }
];

export default function FaqSection() {
  const [openIds, setOpenIds] = useState<string[]>(['1']); // Default open item 1 to stay compact
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  const categories = ['全部', '机场选购', '线路技术', '流媒体与AI', '安全隐私'];

  const toggleItem = (id: string) => {
    setOpenIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const filteredFaqs = activeCategory === '全部'
    ? FAQ_DATA
    : FAQ_DATA.filter(faq => faq.category === activeCategory);

  return (
    <section className="py-12 border-t border-gray-100/80 bg-gradient-to-b from-white to-gray-50/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-[11.5px] font-bold text-indigo-700">
              <HelpCircle className="h-3.5 w-3.5 text-indigo-600" />
              <span>常见问题 FAQ & SEO 指南</span>
            </div>
            <h3 className="font-sans text-xl md:text-2xl font-black text-gray-900 tracking-tight">
              常见问题与翻墙选购指南
            </h3>
            <p className="text-xs md:text-sm text-gray-500 font-medium">
              解答机场选择、专线技术、流媒体解锁与网络安全避坑技巧
            </p>
          </div>

          {/* Category Filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Compact 2-column Grid of Collapsible Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
          {filteredFaqs.map((faq) => {
            const isOpen = openIds.includes(faq.id);
            return (
              <div
                key={faq.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isOpen 
                    ? 'border-indigo-200/90 bg-white shadow-xs' 
                    : 'border-gray-200/80 bg-white/80 hover:border-gray-300 hover:bg-white'
                }`}
              >
                <button
                  onClick={() => toggleItem(faq.id)}
                  className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer group select-none"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[11px] font-black text-indigo-600 mt-0.5">
                      Q
                    </span>
                    <span className="text-[13.5px] font-extrabold text-gray-850 group-hover:text-indigo-600 transition-colors leading-snug">
                      {faq.question}
                    </span>
                  </div>

                  <div className={`p-1 rounded-lg text-gray-400 group-hover:text-gray-600 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 bg-gray-100 text-gray-700' : ''}`}>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100 text-xs text-gray-600 leading-relaxed font-normal bg-gray-50/40">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
