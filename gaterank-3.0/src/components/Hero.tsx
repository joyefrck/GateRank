import React from 'react';
import { motion } from 'motion/react';
import { Search, Zap, Server } from 'lucide-react';

export default function Hero() {
  return (
    <div className="relative overflow-hidden bg-white py-5 sm:py-6 md:py-7 border-b border-gray-50 grid-bg">
      {/* Decorative clean background mesh and grid dots */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#f0f0f0_1px,transparent_1px)] [background-size:20px_20px] opacity-70"></div>
      
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          
          {/* Left Text content */}
          <div className="lg:col-span-8 flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-2.5"
            >
              {/* Title exactly from Image 2 */}
              <h1 className="font-sans text-xl font-black tracking-tight text-gray-900 sm:text-2xl md:text-3xl leading-tight lg:leading-[1.15]">
                机场榜：机场 <span className="text-black inline-block font-extrabold">VPN</span> 推荐与
                <span className="block mt-0.5 sm:inline sm:mt-0 font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-500 via-gray-400 to-gray-300 drop-shadow-sm select-none">
                  可靠性榜单
                </span>
              </h1>
 
              {/* Description exactly as pictured in Image 2 */}
              <p className="max-w-2xl text-[13.5px] leading-relaxed text-gray-550 sm:text-[14.5px]">
                首页默认聚焦今日推荐，同时结合 <span className="font-semibold text-gray-800">长期稳定、性价比、新入榜与风险预警</span> 五类榜单，帮助用户从不同角度快速筛选。
              </p>
            </motion.div>
          </div>
 
          {/* Right Metrics & Report Time Pill in Bottom Right */}
          <div className="lg:col-span-4 flex flex-col justify-end h-full gap-3 lg:items-end">
            <motion.div
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col gap-2 min-w-[220px] w-full sm:w-auto"
            >
              <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.015)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] justify-between flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-gray-400 shrink-0">
                    <Search className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-gray-400 tracking-wider leading-none mb-1">监测机场</span>
                    <span className="font-mono text-[20px] font-black text-gray-900 leading-none">58+</span>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-black text-emerald-600 tracking-wider">LIVE</span>
              </div>
 
              <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.015)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] justify-between flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-gray-400 shrink-0">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-gray-400 tracking-wider leading-none mb-1">实时测速</span>
                    <span className="font-mono text-[18px] font-black text-gray-900 leading-none">22,490+</span>
                  </div>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-black text-blue-600 tracking-wider">AUTO</span>
              </div>

              {/* Report Time Pill - Bottom Right */}
              <div className="flex justify-end pt-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200/90 bg-white/90 px-3.5 py-1.5 shadow-2xs backdrop-blur-xs select-none">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[12px] font-medium text-gray-600">
                    报告时间：<strong className="font-mono text-[13px] font-black text-gray-900 px-0.5">6</strong> 小时前
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
 
        </div>
      </div>
    </div>
  );
}
