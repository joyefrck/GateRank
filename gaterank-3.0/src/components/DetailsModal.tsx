import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Globe, Shield, MessageSquare, Gauge, Check, Award, AlertTriangle } from 'lucide-react';
import { Airport, ReviewComment } from '../types';

interface DetailsModalProps {
  airport: Airport | null;
  onClose: () => void;
  onAddReview: (airportId: string, newReview: ReviewComment) => void;
}

export default function DetailsModal({ airport, onClose, onAddReview }: DetailsModalProps) {
  const [userName, setUserName] = useState('');
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!airport) return null;

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userComment.trim()) return;

    const review: ReviewComment = {
      user: userName.trim(),
      avatar: ['🦁', '🐼', '🦊', '🐷', '🐱', '🐥', '🦉'][Math.floor(Math.random() * 7)],
      rating: userRating,
      time: '刚刚',
      comment: userComment.trim()
    };

    onAddReview(airport.id, review);
    setSuccessMsg('您的评测已成功提交，正在通过多节点交叉核验！感谢支持独立评测。');
    setUserName('');
    setUserComment('');
    setUserRating(5);

    setTimeout(() => {
      setSuccessMsg('');
    }, 5000);
  };

  const getStatusColor = (status: string) => {
    if (status === 'scam') return 'bg-red-50 text-red-600 border border-red-100';
    if (status === 'risk') return 'bg-amber-50 text-amber-600 border border-amber-100';
    return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ y: 25, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 25, opacity: 0 }}
        className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 my-8"
      >
        {/* Banner with airport logo gradient */}
        <div className={`h-32 bg-gradient-to-r ${airport.logoColor} relative flex items-end p-6 overflow-hidden`}>
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute right-0 -bottom-10 h-36 w-36 rounded-full bg-white/10 blur-xl"></div>
          
          <div className="relative z-10 flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center justify-center font-black text-white text-xl shadow-md">
              {airport.logoText}
            </div>
            
            <div className="space-y-0.5 text-white">
              <h3 className="font-sans text-xl font-black tracking-tight">{airport.name} 详情报告</h3>
              <p className="text-xs text-white/80 font-medium">官方链接：{airport.officialUrl.replace('https://', '')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-black/25 hover:bg-black/45 p-1.5 text-white cursor-pointer transition-all border border-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal body content scrolling container */}
        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6">
          
          {/* Section 1: Health status indicators & description */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className={`p-3.5 rounded-2xl flex flex-col justify-center items-center text-center ${getStatusColor(airport.status)}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">运行状态</span>
              <span className="text-sm font-black mt-1">
                {airport.status === 'scam' ? '确认跑路 (SCAM)' : airport.status === 'risk' ? '中高风险 (RISK)' : '在线稳定 (ACTIVE)'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-center items-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450">测速均值</span>
              <span className="text-sm font-black text-gray-800 mt-1">{airport.status === 'scam' ? '0' : `${airport.speedStats.averageSpeed} Mbps`}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-center items-center text-center col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450">可用节点</span>
              <span className="text-sm font-black text-gray-850 mt-1">{airport.status === 'scam' ? '0' : `${airport.nodes}+ 运营节点`}</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <h4 className="font-sans text-xs font-bold text-gray-400 uppercase tracking-widest">简介与评价</h4>
            <p className="text-sm leading-relaxed text-gray-650 font-medium bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              {airport.description}
            </p>
          </div>

          {/* Section 2: Real timing diagnostics (Except scammed ones) */}
          {airport.status !== 'scam' && (
            <div className="space-y-3.5">
              <h4 className="font-sans text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Gauge className="h-4 w-4" />
                全球多测速点实际延迟测定 (Global Latency)
              </h4>
              
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="text-[11px] font-bold text-gray-400">香港 HKT</span>
                  <span className="block font-mono text-base font-black text-gray-800 mt-1">{airport.speedStats.hk} ms</span>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="text-[11px] font-bold text-gray-400">新加坡 GTT</span>
                  <span className="block font-mono text-base font-black text-gray-800 mt-1">{airport.speedStats.sg} ms</span>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="text-[11px] font-bold text-gray-400">东京 IDCF</span>
                  <span className="block font-mono text-base font-black text-gray-800 mt-1">{airport.speedStats.jp} ms</span>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <span className="text-[11px] font-bold text-gray-400">美国 Anycast</span>
                  <span className="block font-mono text-base font-black text-gray-800 mt-1">{airport.speedStats.us} ms</span>
                </div>
              </div>

              {/* Loss stats */}
              <div className="flex items-center justify-between text-xs font-semibold px-1 text-gray-500">
                <span>主力全节点平均丢包率 (Packet Loss): <span className="font-mono text-indigo-600">{airport.speedStats.packetLoss}%</span></span>
                <span>评测测速基准：Cloud Run 自动化中转</span>
              </div>
            </div>
          )}

          {/* Section 3: User reviews / Comments */}
          <div className="space-y-4">
            <h4 className="font-sans text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              玩家实测评价 ({airport.reviews.length})
            </h4>

            <div className="space-y-3">
              {airport.reviews.length > 0 ? (
                airport.reviews.map((rev, rIdx) => (
                  <div key={rIdx} className="flex gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-50 items-start">
                    <span className="text-xl leading-none">{rev.avatar}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-800">{rev.user}</span>
                        <span className="text-[10px] font-mono text-gray-400">{rev.time}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-amber-400 py-0.5">
                        {Array.from({ length: 5 }).map((_, starI) => (
                          <Star key={starI} className={`h-3 w-3 ${starI < Math.round(rev.rating) ? 'fill-amber-400' : 'text-gray-200'}`} />
                        ))}
                        <span className="font-mono text-[10px] font-bold text-gray-500">({rev.rating.toFixed(1)})</span>
                      </div>

                      <p className="text-xs text-gray-650 leading-relaxed font-semibold">
                        {rev.comment}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-gray-400 font-medium">
                  暂无历史评价纪录，欢迎提交第一条中立客观的测速评价！
                </div>
              )}
            </div>

            {/* Submitting form */}
            <form onSubmit={handleSubmitReview} className="rounded-2xl border border-gray-100 p-4 space-y-3.5 bg-gray-50/20">
              <span className="text-xs font-black text-gray-800 block">提交真实评测反馈 (Submit Review)</span>
              
              {successMsg && (
                <div className="rounded-xl bg-indigo-50 border border-indigo-150 p-3 text-xs text-indigo-700 font-semibold flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 bg-indigo-600 text-white rounded-full p-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="游戏代号 / 评测人昵称"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white p-2.5 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                />

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-bold">打分评分:</span>
                  <div className="flex items-center gap-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((starNum) => (
                      <button
                        key={starNum}
                        type="button"
                        onClick={() => setUserRating(starNum)}
                        className="p-0.5 hover:scale-110 cursor-pointer"
                      >
                        <Star className={`h-4.5 w-4.5 ${starNum <= userRating ? 'fill-amber-400' : 'text-gray-200'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <textarea
                required
                rows={2}
                placeholder="在此说明您的测速节点连接、丢包或流媒体解锁情况。谢绝广告，违规拉黑。..."
                value={userComment}
                onChange={(e) => setUserComment(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm leading-relaxed"
              />

              <div className="text-right">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  发表测评观点
                </motion.button>
              </div>
            </form>
          </div>

        </div>

        {/* Action footer launch */}
        <div className="border-t border-gray-100 p-5 bg-gray-50 flex items-center justify-between gap-4">
          <div className="text-xs text-gray-450 font-semibold flex items-center gap-1 select-none">
            <Award className="h-4 w-4 text-amber-500" />
            <span>独立核实编码 #{airport.id.toUpperCase()}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-100 py-2.5 px-4 text-xs font-bold transition-all cursor-pointer"
            >
              关闭报告
            </button>
            
            <a
              href={airport.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-black hover:bg-gray-800 text-white py-2.5 px-5 text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
            >
              <span>直达官网</span>
              <Globe className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
