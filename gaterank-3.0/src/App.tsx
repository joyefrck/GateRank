import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Info, Sparkles, Heart, Activity, ArrowRight, UserCheck, LogOut, CheckCircle2 } from 'lucide-react';

// Import Types and Data
import { Airport, ReviewComment, INITIAL_AIRPORTS } from './types';

// Import Components
import Header from './components/Header';
import Hero from './components/Hero';
import TodayDiscovery from './components/TodayDiscovery';
import RankTable from './components/RankTable';
import SidebarWidgets from './components/SidebarWidgets';
import BottomGrid from './components/BottomGrid';
import FaqSection from './components/FaqSection';

// Import Modals
import DetailsModal from './components/DetailsModal';
import ToolsModal from './components/ToolsModal';
import ApplyModal from './components/ApplyModal';
import LoginModal from './components/LoginModal';

export default function App() {
  // App Core States
  const [airports, setAirports] = useState<Airport[]>(INITIAL_AIRPORTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('综合排名');
  const [headerActiveTab, setHeaderActiveTab] = useState('today');

  // Interactive Modal Triggers
  const [selectedDetailAirport, setSelectedDetailAirport] = useState<Airport | null>(null);
  const [activeToolType, setActiveToolType] = useState<string | null>(null);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Authenticated state
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  // Callback to insert newly written user review & adjust score instantly
  const handleAddNewReview = (airportId: string, newReview: ReviewComment) => {
    setAirports((prevList) =>
      prevList.map((ap) => {
        if (ap.id === airportId) {
          const currentVotes = ap.votes;
          const currentRating = ap.rating;
          const newVotes = currentVotes + 1;
          
          // Re-calculate weighted average score
          const calculatedRating = Number(
            ((currentRating * currentVotes + newReview.rating) / newVotes).toFixed(2)
          );

          // Update active Detail overlay instantly if open
          const updatedAirport = {
            ...ap,
            votes: newVotes,
            rating: calculatedRating,
            reviews: [newReview, ...ap.reviews],
          };
          
          setSelectedDetailAirport(updatedAirport);
          return updatedAirport;
        }
        return ap;
      })
    );
  };

  const handleLoginSuccess = (name: string) => {
    setCurrentUser(name);
    setShowWelcome(true);
    setTimeout(() => {
      setShowWelcome(false);
    }, 5000);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans antialiased text-gray-800 selection:bg-indigo-500 selection:text-white">
      
      {/* 2026 Grid Background System Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>
      
      {/* 1. Header (Completely styled according to Image 2) */}
      <Header
        activeTab={headerActiveTab}
        setActiveTab={setHeaderActiveTab}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenApply={() => setIsApplyOpen(true)}
        onSelectCategory={setSelectedCategory}
      />

      {/* 2. Hero (Completely styled according to Image 2) */}
      <Hero />

      {/* Dynamic Authentication Toast Banner */}
      <AnimatePresence>
        {showWelcome && currentUser && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-4 z-50 flex items-center gap-3.5 rounded-2xl bg-black text-white p-4 shadow-xl border border-white/10"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="space-y-0.5">
              <span className="text-xs font-bold block">{currentUser} 探索会话登录成功！</span>
              <span className="text-[10px] text-gray-400 block font-mono">欢迎进入 GateRank 独立安全委员会</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 space-y-6">
        
        {/* User Logged-in Helper Indicator Bar */}
        {currentUser && (
          <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-800">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>
                  当前登录状态: <span className="font-extrabold">{currentUser}</span> (核心实测打分权限处于可用激活状态)
                </span>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 hover:text-indigo-950 font-bold hover:underline transition-all cursor-pointer"
              >
                <span>退出登录</span>
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 4. Commercial Cooperation Zone (4 Ad Slots) */}
        <TodayDiscovery
          airports={airports}
          onOpenDetails={setSelectedDetailAirport}
          onOpenApply={() => setIsApplyOpen(true)}
        />

        {/* 5. Main Double Column Content (Ranking table vs. Sidebar updates - Image 1 bottom middle layout) */}
        <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            
            {/* Left Column (Ranking list table) - Taking 8 cols */}
            <div className="lg:col-span-8">
              <RankTable
                airports={airports}
                searchQuery={searchQuery}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                onOpenDetails={setSelectedDetailAirport}
              />
            </div>

            {/* Right Column (Sidebar announcements and Ads helper widgets) - Taking 4 cols */}
            <div className="lg:col-span-4">
              <SidebarWidgets
                airports={airports}
                onOpenDetails={setSelectedDetailAirport}
                onOpenTool={setActiveToolType}
              />
            </div>

          </div>
        </section>

        {/* 6. Bottom Columns Grid (Rookies list, Hot classes, Comments - Image 1 bottom grid) */}
        <BottomGrid
          airports={airports}
          onOpenDetails={setSelectedDetailAirport}
          onSelectCategory={setSelectedCategory}
        />

        {/* 7. Why Select GateRank? Value Proposition row matching the bottom section of Image 1 */}
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 sm:py-12 border-t border-gray-100">
          <div className="space-y-8">
            
            <div className="text-center space-y-1.5">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block">Core Philosophy</span>
              <h3 className="font-sans text-2xl font-black text-gray-900 tracking-tight">为什么选择 GateRank?</h3>
              <p className="text-xs text-gray-400 font-medium">秉承彻底客观与硬核实测立场，全力维护航路透明</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              
              <div className="rounded-[24px] border border-gray-100 bg-white p-5 space-y-2 text-center flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 shadow-sm">
                  <CheckShieldIcon />
                </div>
                <h4 className="font-sans text-sm font-black text-gray-850">公正客观</h4>
                <p className="text-[11px] leading-relaxed text-gray-400 font-medium pt-1">
                  排名完全基于算法，彻底剔除所有外部广告包榜及恶意商业干预。
                </p>
              </div>

              <div className="rounded-[24px] border border-gray-100 bg-white p-5 space-y-2 text-center flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm">
                  <ChartTrendIcon />
                </div>
                <h4 className="font-sans text-sm font-black text-gray-850">真实数据</h4>
                <p className="text-[11px] leading-relaxed text-gray-400 font-medium pt-1">
                  全球5大机房不间断测速探针巡航，丢包率延迟数据全景透明。
                </p>
              </div>

              <div className="rounded-[24px] border border-gray-100 bg-white p-5 space-y-2 text-center flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shadow-sm">
                  <UptimeIcon />
                </div>
                <h4 className="font-sans text-sm font-black text-gray-850">持续更新</h4>
                <p className="text-[11px] leading-relaxed text-gray-400 font-medium pt-1">
                  每日零点精确重组测速基准计算，规避突发故障波动干扰。
                </p>
              </div>

              <div className="rounded-[24px] border border-gray-100 bg-white p-5 space-y-2 text-center flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 shadow-sm">
                  <PrivacyIcon />
                </div>
                <h4 className="font-sans text-sm font-black text-gray-850">隐私保护</h4>
                <p className="text-[11px] leading-relaxed text-gray-400 font-medium pt-1">
                  完全在本地执行所有订阅规则分流及账号校验，捍卫浏览轨迹隐私。
                </p>
              </div>

              <div className="rounded-[24px] border border-gray-100 bg-white p-5 space-y-2 text-center flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-sm">
                  <CommunityIcon />
                </div>
                <h4 className="font-sans text-sm font-black text-gray-850">社区驱动</h4>
                <p className="text-[11px] leading-relaxed text-gray-400 font-medium pt-1">
                  汇合资深极客深度交叉测试意见与风险舆情回执，众志成城防跑路。
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* FAQ Section for SEO */}
        <FaqSection />

      </main>

      {/* 8. Footer (Completely styled according to Image 3) */}
      <BottomFooter
        setActiveTab={setHeaderActiveTab}
        onSelectCategory={setSelectedCategory}
        onOpenApply={() => setIsApplyOpen(true)}
      />

      {/* Core Dialog / Modal portal controllers using elegant springy framer transitions */}
      <AnimatePresence>
        {/* Details Report Modal */}
        {selectedDetailAirport && (
          <DetailsModal
            airport={selectedDetailAirport}
            onClose={() => setSelectedDetailAirport(null)}
            onAddReview={handleAddNewReview}
          />
        )}

        {/* Sandbox Interactive Console Modal */}
        {activeToolType && (
          <ToolsModal
            initialType={activeToolType}
            onClose={() => setActiveToolType(null)}
            airports={airports}
          />
        )}

        {/* Partner Application Modal */}
        {isApplyOpen && (
          <ApplyModal
            onClose={() => setIsApplyOpen(false)}
          />
        )}

        {/* Auth Sign-in Modal */}
        {isLoginOpen && (
          <LoginModal
            onClose={() => setIsLoginOpen(false)}
            onLoginSuccess={handleLoginSuccess}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

// Separate Footer Import as local module to bypass strict build dependencies
import BottomFooter from './components/Footer';

// Little micro local inline-designed SVG illustrations for Value Propositions
function CheckShieldIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.952 11.952 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function ChartTrendIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function UptimeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
    </svg>
  );
}

function PrivacyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
