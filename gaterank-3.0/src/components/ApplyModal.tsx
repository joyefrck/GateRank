import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, ShieldCheck, FileText, Send, CheckCircle } from 'lucide-react';

interface ApplyModalProps {
  onClose: () => void;
}

export default function ApplyModal({ onClose }: ApplyModalProps) {
  const [apName, setApName] = useState('');
  const [apUrl, setApUrl] = useState('');
  const [apTg, setApTg] = useState('');
  const [apDesc, setApDesc] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apName.trim() || !apUrl.trim() || !apTg.trim()) return;

    // Simulate successfully saving to Firestore/Mock schema
    setIsSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="relative w-full max-w-lg bg-white rounded-[24px] overflow-hidden shadow-2xl border border-gray-100 p-6 space-y-6"
      >
        
        {/* Header Title with nice logo info */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase block">GATERANK PARTNERSHIP</span>
            <h3 className="font-sans text-[17px] font-black tracking-tight text-gray-900 flex items-center gap-1.5">
              <FileText className="h-4.5 w-4.5 text-indigo-500" />
              机场主入驻评测申请
            </h3>
          </div>

          <button
            onClick={onClose}
            className="rounded-full hover:bg-gray-50 p-1.5 text-gray-400 hover:text-black cursor-pointer transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isSuccess ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="py-6 space-y-4 text-center"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h4 className="text-base font-black text-gray-900">入驻评测请求成功投递！</h4>
              <p className="text-xs leading-relaxed text-gray-500 max-w-md mx-auto font-medium">
                我们将安排全球5大物理测试机房，以 5 分钟/次的基准频率，在接下来 <span className="font-bold text-indigo-600">24 小时</span> 内不间断探查监控您的核心主线中转稳定度。生成的独立测算打分报告达到标准后，系统将自动化加入备用排行列表。
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl bg-black hover:bg-gray-800 text-white font-bold text-xs py-2.5 px-6 shadow-sm transition-all cursor-pointer"
            >
              我知道了
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-[11px] leading-relaxed text-gray-500 font-semibold flex items-start gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-indigo-600 shrink-0 mt-0.5" />
              <span>我们奉行公正严格的算法审查：拒绝任何买榜、包榜行为。入驻申请只需留好测试账户。GateRank 将免费核算您真实的物理评级与全球负载。</span>
            </div>

            <div className="space-y-3.5">
              
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase">机场官方名称 *</label>
                <input
                  type="text"
                  required
                  placeholder="例如：大象网络 / ABC Cloud"
                  value={apName}
                  onChange={(e) => setApName(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase">官方主页网址 *</label>
                <input
                  type="url"
                  required
                  placeholder="例如：https://my-cloud-vpn.net"
                  value={apUrl}
                  onChange={(e) => setApUrl(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase">管理主 Telegram / 联系邮箱 *</label>
                <input
                  type="text"
                  required
                  placeholder="例如：@my_cloud_owner / admin@abc.com"
                  value={apTg}
                  onChange={(e) => setApTg(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase">线路核心优势 / 套餐说明 (选填)</label>
                <textarea
                  rows={2}
                  placeholder="例如：我们主要提供优质的 IPLC 广深/沪日物理专线优化，提供解锁全区 4K Disney+ 等服务..."
                  value={apDesc}
                  onChange={(e) => setApDesc(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm leading-relaxed"
                />
              </div>

            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-50">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 hover:bg-gray-100 py-2.5 px-5 text-xs font-bold text-gray-600 transition-colors cursor-pointer bg-white"
              >
                取消
              </button>
              
              <button
                type="submit"
                className="rounded-xl bg-black hover:bg-gray-800 text-white py-2.5 px-6 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>正式投递测试</span>
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>

          </form>
        )}

      </motion.div>
    </div>
  );
}
