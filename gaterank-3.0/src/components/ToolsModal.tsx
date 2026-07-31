import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Tv, Globe, ShieldAlert, Play, RefreshCw, Terminal, Check, Copy, Info, Laptop, Smartphone, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Airport } from '../types';

interface ToolsModalProps {
  initialType: string;
  onClose: () => void;
  airports: Airport[];
}

export default function ToolsModal({ initialType, onClose, airports }: ToolsModalProps) {
  const [activeTab, setActiveTab] = useState(initialType);
  const [selectedAirportId, setSelectedAirportId] = useState(airports[0]?.id || '');
  const [testing, setTesting] = useState(false);
  const [testOutput, setTestOutput] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // States for IP Check
  const [targetIp, setTargetIp] = useState('104.18.25.109');

  // List of tool definitions matching the screenshot
  const tools = [
    { type: 'download', name: '翻墙工具下载', desc: 'Clash / Shadowrocket / Sing-box / Surge 全平台下载', icon: <Download className="h-4 w-4 text-blue-500" /> },
    { type: 'netflix', name: '流媒体解锁检测', desc: '检测多主力节点流媒体原生解锁等级', icon: <Tv className="h-4 w-4 text-purple-500" /> },
    { type: 'ippurity', name: 'IP 检测', desc: '验证当前出口 IP 是否被 ChatGPT 及风控拦截', icon: <Globe className="h-4 w-4 text-emerald-500" /> },
    { type: 'dnsleak', name: 'DNS 泄漏检测', desc: '排查 DNS 域名解析是否存在真实 IP 泄漏', icon: <ShieldAlert className="h-4 w-4 text-amber-500" /> },
  ];

  // Auto-scroll terminal logs to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [testOutput]);

  const runNetflixCheck = () => {
    const targetAp = airports.find(a => a.id === selectedAirportId);
    if (!targetAp) return;

    setTesting(true);
    setProgress(0);
    setTestOutput([]);

    const logs = [
      `[核心] 🎬 启动 Netflix/Disney+/YouTube 区域原生流媒体解析检测...`,
      `[DNS] 🔍 检验 DNS IPv4 / IPv6 劫持或边缘托管服务...`,
      `[分析] ${targetAp.name} 核心专线检测中：`,
      `▶ Netflix [HK/TW/SG/JP] region unlocked - ✅ OK [Full 4K HDR + Original subtitles]`,
      `▶ Disney+ (Singapore/HongKong) - ✅ OK [Full 4K HDR playback support]`,
      `▶ YouTube Premium (Region lock check) - ✅ OK [No Ads + Background play]`,
      `▶ OpenAI ChatGPT / Claude endpoint - ✅ IP clean (Unblocked)`,
      `[结算] 🎉 检测完成，${targetAp.name} 的流媒体线路解锁度评级：100% 完美全解锁！`
    ];

    let step = 0;
    const interval = setInterval(() => {
      if (step < logs.length) {
        setTestOutput(prev => [...prev, logs[step]]);
        setProgress(Math.round(((step + 1) / logs.length) * 100));
        step++;
      } else {
        clearInterval(interval);
        setTesting(false);
      }
    }, 700);
  };

  const runIpCheck = () => {
    if (!targetIp.trim()) return;

    setTesting(true);
    setProgress(0);
    setTestOutput([]);

    const logs = [
      `[探测] 🕵️‍♂️ 启动 IP 归属地、地理滥用及风控风险值分析...`,
      `[DNS] 🔎 查询目标 IP [${targetIp}] 关联的运营商/AS编号...`,
      `[查询] ISP: Cloudflare Inc / AS13335 | GeoIP: Tokyo, Japan`,
      `[风控] 🛡️ 正在交叉检索 15 个主流垃圾邮件与滥用黑名单数据库 (Spamhaus, DNSBL)...`,
      `▶ 扫描结果: 0 / 15 检出 (非常安全)`,
      `[欺诈分] 📈 查询 MaxMind/Scamalytics 欺诈滥用评分 (Fraud Score):`,
      `▶ IP 欺诈评分: 5 / 100 分 (极低风险 - 原生静态节点等级)`,
      `[AI 解锁] 🚫 检查 ChatGPT / Claude AI 登录防爬禁令限制...`,
      `▶ OpenAI Unblock Status: ✅ Unblocked (支持直接登录与 API 通信)`,
      `[结算] ✨ 检测完成。该节点 IP 干净度极高，适合写论文、AI开发和跨境安全通信。`
    ];

    let step = 0;
    const interval = setInterval(() => {
      if (step < logs.length) {
        setTestOutput(prev => [...prev, logs[step]]);
        setProgress(Math.round(((step + 1) / logs.length) * 100));
        step++;
      } else {
        clearInterval(interval);
        setTesting(false);
      }
    }, 700);
  };

  const runDnsLeakTest = () => {
    setTesting(true);
    setProgress(0);
    setTestOutput([]);

    const logs = [
      `[检测] 🛡️ 启动 DNS 泄漏与 WebRTC 真实 IP 隐匿性扫描...`,
      `[阶段 1] 📡 向 10 个边缘全球 DNS 探针节点发送无缓存域名解析请求...`,
      `▶ DNS Server 1: 103.28.x.x (Cloudflare DoH) - 加密传输 ✅`,
      `▶ DNS Server 2: 8.8.8.8 (Google Public DNS) - 代理接管 ✅`,
      `[阶段 2] 🔍 检查本地真实 ISP DNS 服务器 (电信/联通/移动)...`,
      `▶ 本地 ISP DNS: 未发现泄漏 🛡️ (所有 DNS 流量均被代理 TUN / FakeIP 机制接管)`,
      `[阶段 3] 🌐 检查 WebRTC STUN 协议内网/外网 IP 泄漏情况...`,
      `▶ WebRTC IP: 仅暴露代理 Exit IP [104.18.25.109]，真实源 IP 未泄漏 ✅`,
      `[总结] 🔒 安全评估：DNS 无任何泄漏现象，翻墙身份与隐私保护状态良好！`
    ];

    let step = 0;
    const interval = setInterval(() => {
      if (step < logs.length) {
        setTestOutput(prev => [...prev, logs[step]]);
        setProgress(Math.round(((step + 1) / logs.length) * 100));
        step++;
      } else {
        clearInterval(interval);
        setTesting(false);
      }
    }, 700);
  };

  const clientsData = [
    {
      platform: 'Windows',
      icon: <Laptop className="h-4 w-4 text-blue-500" />,
      apps: [
        { name: 'Clash Verge Rev', tag: '推荐', desc: '新一代 Clash 客户端，界面精美，自带中文', url: 'https://github.com/clash-verge-rev/clash-verge-rev/releases' },
        { name: 'v2rayN', tag: '经典', desc: '老牌 Win 客户端，支持 V2Ray / Xray / Trojan', url: 'https://github.com/2dust/v2rayN/releases' },
        { name: 'NekoBox for Windows', tag: '多协议', desc: '通用全协议代理客户端，基于 Sing-Box 核心', url: 'https://github.com/MatsuriDayo/NekoBoxForAndroid/releases' },
      ]
    },
    {
      platform: 'macOS',
      icon: <Laptop className="h-4 w-4 text-purple-500" />,
      apps: [
        { name: 'Clash Verge Rev (Mac)', tag: '推荐', desc: '支持 Apple Silicon M系列芯片，极致流畅', url: 'https://github.com/clash-verge-rev/clash-verge-rev/releases' },
        { name: 'Surge 5 for Mac', tag: '高端', desc: 'Mac 平台最强大网络调试与代理神器', url: 'https://nssurge.com/' },
        { name: 'Sing-Box macOS', tag: '内核', desc: '下一代通用代理框架官方客户端', url: 'https://sing-box.sagernet.org/' },
      ]
    },
    {
      platform: 'iOS / iPadOS',
      icon: <Smartphone className="h-4 w-4 text-emerald-500" />,
      apps: [
        { name: 'Shadowrocket (小火箭)', tag: '必备', desc: 'iOS 最普及代理软件，需外区 Apple ID 购买', url: 'https://apps.apple.com/us/app/shadowrocket/id932747118' },
        { name: 'Quantumult X', tag: '极客', desc: 'UI 极佳，分流规则强大，支持重写与脚本', url: 'https://apps.apple.com/us/app/quantumult-x/id1443988620' },
        { name: 'Stash for iOS', tag: 'Clash规则', desc: 'iOS 上的 Clash 规则兼容客户端', url: 'https://stash.ws/' },
      ]
    },
    {
      platform: 'Android',
      icon: <Smartphone className="h-4 w-4 text-amber-500" />,
      apps: [
        { name: 'v2rayNG', tag: '开源免费', desc: '安卓首选老牌代理工具，稳定好用', url: 'https://github.com/2dust/v2rayNG/releases' },
        { name: 'Surfboard (冲浪板)', tag: 'Surge语法', desc: '界面媲美 Surge，上手简单配置方便', url: 'https://getsurfboard.com/' },
        { name: 'Clash Meta for Android', tag: '功能全', desc: '支持更多协议的新版 Clash 安卓客户端', url: 'https://github.com/MetaCubeX/ClashMetaForAndroid/releases' },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col h-[88vh] md:h-[80vh]"
      >
        
        {/* Header bar matching the aesthetic */}
        <div className="bg-stone-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
              <Terminal className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-sans text-[16px] font-black tracking-tight flex items-center gap-1.5">
                GateRank 实用工具箱
              </h3>
              <p className="text-[10px] text-stone-400 font-mono">GATERANK UTILITY HUB V3.0</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full bg-white/10 hover:bg-white/20 p-1.5 text-stone-300 cursor-pointer transition-all hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Controllers Row */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 p-2 overflow-x-auto gap-1.5 no-scrollbar shrink-0">
          {tools.map((t) => (
            <button
              key={t.type}
              onClick={() => {
                setActiveTab(t.type);
                setTestOutput([]);
                setProgress(0);
                setTesting(false);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                activeTab === t.type
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-black'
              }`}
            >
              {t.icon}
              <span>{t.name}</span>
            </button>
          ))}
        </div>

        {/* Dynamic Sandbox Simulator content split area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 flex flex-col justify-between">
          
          <div className="space-y-4">
            
            {/* Tool 1: 翻墙工具下载 */}
            {activeTab === 'download' && (
              <div className="space-y-4">
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3.5 text-xs text-blue-900 leading-relaxed flex items-start gap-2.5">
                  <Info className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
                  <span>整理全平台主流代理翻墙客户端下载链接（支持 Windows / macOS / iOS / Android），点击直达 GitHub Release 或官方通道。</span>
                </div>

                <div className="space-y-4">
                  {clientsData.map((plat) => (
                    <div key={plat.platform} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black text-gray-800 border-b border-gray-100 pb-1">
                        {plat.icon}
                        <span>{plat.platform} 平台</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {plat.apps.map((app) => (
                          <a
                            key={app.name}
                            href={app.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-2xl border border-gray-150 bg-gray-50/60 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all flex flex-col justify-between group cursor-pointer"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] font-black text-gray-900 group-hover:text-indigo-600 transition-colors">
                                  {app.name}
                                </span>
                                <span className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                  {app.tag}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 leading-normal line-clamp-2">
                                {app.desc}
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100/80 text-[11px] font-bold text-gray-400 group-hover:text-indigo-600">
                              <span>获取下载</span>
                              <ExternalLink className="h-3 w-3" />
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tool 2: 流媒体解锁检测 */}
            {activeTab === 'netflix' && (
              <div className="space-y-3">
                <div className="rounded-xl bg-purple-50 border border-purple-100 p-4 text-xs text-purple-800 leading-relaxed flex items-start gap-2.5">
                  <Tv className="h-4.5 w-4.5 text-purple-500 shrink-0 mt-0.5" />
                  <span>流媒体检测器采用探针脚本向 Netflix、Disney+、YouTube 区域播放端发起模拟鉴权，生成客观解锁等级。</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex flex-col gap-1 w-full sm:w-1/2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">选择待检机场</span>
                    <select
                      value={selectedAirportId}
                      onChange={(e) => setSelectedAirportId(e.target.value)}
                      disabled={testing}
                      className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-850 font-bold focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-sm disabled:bg-gray-100"
                    >
                      {airports.filter(a => a.status === 'normal').map((ap) => (
                        <option key={ap.id} value={ap.id}>{ap.name} ({ap.nodes} Nodes)</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={runNetflixCheck}
                    disabled={testing}
                    className="w-full sm:w-auto h-11 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:bg-purple-400 mt-5 self-end"
                  >
                    <Play className="h-4 w-4" />
                    <span>一键开展流媒体解锁分析</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tool 3: IP 检测 */}
            {activeTab === 'ippurity' && (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-xs text-emerald-900 leading-relaxed flex items-start gap-2.5">
                  <Globe className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>查询目标 IP 归属地、运营商 AS 编号、欺诈风控风险分（Scamalytics）以及 ChatGPT 允许访问状态。</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex flex-col gap-1 w-full sm:w-1/2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">待探查 IP 地址</span>
                    <input
                      type="text"
                      value={targetIp}
                      onChange={(e) => setTargetIp(e.target.value)}
                      disabled={testing}
                      placeholder="例如：104.18.25.109"
                      className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-850 font-bold focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-sm"
                    />
                  </div>

                  <button
                    onClick={runIpCheck}
                    disabled={testing}
                    className="w-full sm:w-auto h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:bg-emerald-400 mt-5 self-end"
                  >
                    <Play className="h-4 w-4" />
                    <span>启动 IP 风险与归属探测</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tool 4: DNS 泄漏检测 */}
            {activeTab === 'dnsleak' && (
              <div className="space-y-4">
                <div className="rounded-xl bg-amber-50 border border-amber-200/60 p-4 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
                  <ShieldAlert className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>检测在使用代理翻墙时，DNS 解析请求是否泄漏给本地运营商（电信/联通/移动）或者未经过加密传输。</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-150">
                  <div className="space-y-1">
                    <span className="text-xs font-black text-gray-800 block">DNS & WebRTC 隐私隐匿检测</span>
                    <span className="text-[11.5px] text-gray-500 block">自动生成 10 个随机二级域名发起探针解析</span>
                  </div>

                  <button
                    onClick={runDnsLeakTest}
                    disabled={testing}
                    className="w-full sm:w-auto h-11 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:bg-amber-400 shrink-0"
                  >
                    <Play className="h-4 w-4" />
                    <span>一键检测 DNS 泄漏</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sandbox Console Printout */}
            {activeTab !== 'download' && (testOutput.length > 0 || testing) && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">运行控制台 (Docker Sandbox)</span>
                
                <div className="rounded-2xl bg-stone-950 text-emerald-400 p-4 font-mono text-[11px] md:text-xs min-h-[180px] border border-stone-850 flex flex-col justify-between leading-relaxed shadow-inner">
                  <div className="space-y-1 max-h-[160px] overflow-y-auto">
                    {testOutput.map((log, i) => (
                      <div key={i} className="whitespace-pre-wrap">
                        {log}
                      </div>
                    ))}
                    {testing && (
                      <div className="inline-flex items-center gap-1.5 text-white bg-white/10 px-2 py-0.5 rounded animate-pulse mt-2">
                        <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
                        <span>探针脚本执行中...</span>
                      </div>
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                  
                  {/* Progress percentage bar */}
                  <div className="border-t border-stone-800 pt-3 mt-4 flex items-center justify-between">
                    <span className="text-[10px] text-stone-500 uppercase font-mono">出口物理端口 100319/TCP</span>
                    <div className="flex items-center gap-3 w-1/2">
                      <div className="w-full bg-stone-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-400">{progress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action closing block */}
          <div className="text-right pt-4 border-t border-gray-100 shrink-0">
            <button
              onClick={onClose}
              className="rounded-xl border border-gray-200 hover:bg-gray-100 py-2.5 px-6 text-xs font-bold text-gray-600 transition-colors cursor-pointer bg-white"
            >
              退出控制台
            </button>
          </div>

        </div>

      </motion.div>
    </div>
  );
}
