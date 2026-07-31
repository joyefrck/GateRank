import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Lock, Mail, Server, Shield, Sparkles, LogIn } from 'lucide-react';

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess: (name: string) => void;
}

export default function LoginModal({ onClose, onLoginSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [stateType, setStateType] = useState<'login' | 'register'>('login');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !pwd.trim()) return;

    setIsSuccess(true);
    setTimeout(() => {
      onLoginSuccess(email.split('@')[0]);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 15, opacity: 0 }}
        className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 p-6 space-y-6"
      >
        
        {/* Header banner custom text */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-indigo-500 tracking-wider block">GATERANK USER PORTAL</span>
            <h3 className="font-sans text-[17px] font-black text-gray-900 tracking-tight flex items-center gap-1.5 animate-pulse">
              <LogIn className="h-4 w-4" />
              {stateType === 'login' ? '玩家登录验证' : '注册全新账户'}
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
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 animate-bounce">
              <Server className="h-6 w-6" />
            </div>
            
            <div className="space-y-1">
              <span className="text-xs font-black text-gray-800 block">安全会话通道建立中...</span>
              <span className="text-[10px] text-gray-400 font-mono block">INITIALIZING SSH HANDSHAKE OVER TLS</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Toggle State */}
            <div className="flex rounded-xl bg-gray-50 p-1 border border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => setStateType('login')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  stateType === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-black'
                }`}
              >
                常规登入
              </button>
              
              <button
                type="button"
                onClick={() => setStateType('register')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  stateType === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-black'
                }`}
              >
                注册玩家
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase">电子邮件地址 (Email)</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="例如：myname@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase">安全密码 (Password)</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    placeholder="输入不低于 6 位的密码"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {stateType === 'login' && (
              <div className="text-right">
                <span className="text-[10px] font-bold text-indigo-500 hover:underline cursor-pointer">
                  忘记安全密码?
                </span>
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-black hover:bg-gray-800 text-white py-3 text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <span>{stateType === 'login' ? '授权验证登录' : '创建安全档案'}</span>
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            </button>

            <div className="text-[9.5px] text-center text-gray-400 leading-normal flex items-center justify-center gap-1 select-none pt-2 border-t border-gray-50/50">
              <Shield className="h-3.5 w-3.5 text-indigo-400" />
              <span>多重网络安全审计防护 · 所有验证本地独立处理</span>
            </div>

          </form>
        )}

      </motion.div>
    </div>
  );
}
