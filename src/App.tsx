import React from 'react';
import { 
  Flame, 
  Trophy, 
  Banknote, 
  Plus, 
  AlertTriangle, 
  ChevronRight, 
  ShieldCheck, 
  BarChart3, 
  Search,
  Zap,
  Clock,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';

interface CardProps {
  type: 'stable' | 'value' | 'risk' | 'new';
  title?: string;
  name: string;
  tags: string[];
  score: number;
  details: { label: string; value: string }[];
  conclusion: string;
  icon?: React.ReactNode;
}

const ConclusionCard = ({ type, title, name, tags, score, details, conclusion, icon }: CardProps) => {
  const styles = {
    stable: 'border-emerald-500/30 bg-white shadow-[4px_4px_0px_0px_rgba(16,185,129,0.1)]',
    value: 'border-sky-500/30 bg-white shadow-[4px_4px_0px_0px_rgba(14,165,233,0.1)]',
    risk: 'border-rose-500/30 bg-white shadow-[4px_4px_0px_0px_rgba(244,63,94,0.1)]',
    new: 'border-sky-500/30 bg-white shadow-[4px_4px_0px_0px_rgba(14,165,233,0.1)]',
  };

  const tagStyles = {
    stable: 'bg-emerald-500 text-white',
    value: 'bg-sky-500 text-white',
    risk: 'bg-rose-500 text-white',
    new: 'bg-sky-500 text-white',
  };

  const scoreColors = {
    stable: 'text-emerald-600',
    value: 'text-sky-600',
    risk: 'text-rose-600',
    new: 'text-sky-600',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`p-6 rounded-xl border ${styles[type]} transition-all hover:translate-y-[-2px] hover:shadow-xl group cursor-pointer h-full flex flex-col relative overflow-hidden`}
    >
      {/* Technical Grid Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '10px 10px' }}></div>

      <div className="flex items-start justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`p-1.5 rounded-lg bg-neutral-900 text-white`}>
              {React.cloneElement(icon as React.ReactElement, { size: 16 })}
            </div>
          )}
          {title && <h3 className="font-black text-sm uppercase tracking-widest text-neutral-400">{title}</h3>}
        </div>
        <div className="text-right">
          <div className="text-[10px] text-neutral-400 uppercase tracking-tighter font-bold mb-1">可靠性评分</div>
          <div className={`text-3xl font-black font-mono leading-none ${scoreColors[type]}`}>{score}</div>
        </div>
      </div>

      <div className="mb-6 relative z-10">
        <div className="flex flex-col gap-3">
          <span className="font-black text-lg tracking-tight text-neutral-900">{name}</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-sm font-black uppercase tracking-wider ${tagStyles[type]}`}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
        {details.map((detail, idx) => (
          <div key={idx} className="bg-neutral-50 p-3 rounded-lg border border-neutral-100">
            <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mb-1">{detail.label}</div>
            <div className="text-sm font-black font-mono text-neutral-800">{detail.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-8 relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-3 bg-neutral-900"></div>
          <div className="text-[10px] text-neutral-900 uppercase tracking-widest font-black">监测结论</div>
        </div>
        <p className="text-xs font-medium leading-relaxed text-neutral-600 line-clamp-3 pl-3 border-l border-neutral-200">{conclusion}</p>
      </div>

      <button className="w-full py-3 rounded-lg bg-neutral-900 text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors mt-auto relative z-10">
        查看完整报告
        <ChevronRight className="w-3 h-3" />
      </button>
    </motion.div>
  );
};

const SectionHeader = ({ icon: Icon, title, subtitle, color = "text-black", bgClass = "bg-neutral-900", extra }: { icon: any, title: string, subtitle: string, color?: string, bgClass?: string, extra?: React.ReactNode }) => {
  const shadowMap: Record<string, string> = {
    'bg-orange-500': 'shadow-orange-500/20',
    'bg-emerald-500': 'shadow-emerald-500/20',
    'bg-sky-500': 'shadow-sky-500/20',
    'bg-indigo-500': 'shadow-indigo-500/20',
    'bg-rose-500': 'shadow-rose-500/20',
    'bg-neutral-900': 'shadow-neutral-900/20',
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        <div className={`w-8 h-8 rounded-lg ${bgClass} flex items-center justify-center text-white shadow-xl ${shadowMap[bgClass] || ''} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-black tracking-tighter text-neutral-900">{title}</h2>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full bg-current ${color} animate-pulse`}></div>
            <p className="text-[9px] text-neutral-400 font-black uppercase tracking-[0.2em]">{subtitle}</p>
          </div>
        </div>
      </div>
      {extra && <div className="flex items-center">{extra}</div>}
    </div>
  );
};

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col relative">
      {/* Global Technical Grid */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none z-0" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-neutral-900 rounded flex items-center justify-center shadow-xl">
                <Zap className="text-white w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-lg tracking-tighter leading-none">机场榜</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">GateRank</span>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-neutral-500">
              <a href="#" className="hover:text-black transition-colors border-b-2 border-transparent hover:border-neutral-900 pb-1">今日推荐</a>
              <a href="#" className="hover:text-black transition-colors border-b-2 border-transparent hover:border-neutral-900 pb-1">全量榜单</a>
              <a href="#" className="hover:text-black transition-colors border-b-2 border-transparent hover:border-neutral-900 pb-1 flex items-center gap-2">
                跑路监测 <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-sm text-[8px]">实时</span>
              </a>
            </div>
          </div>
          <button className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-2.5 rounded text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3">
            <span className="hidden sm:inline">申请入驻测试</span>
            <span className="sm:hidden">申请</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </nav>

      {/* Hero Section - Ultra Compact */}
      <header className="max-w-7xl mx-auto px-4 pt-6 pb-6 text-center relative z-10">
        <h1 className="text-2xl md:text-4xl font-black tracking-tighter mb-2 leading-none text-neutral-900">
          2026 机场<span className="text-neutral-400">实时监测</span>
        </h1>
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6 text-neutral-500 mb-4">
          <p className="text-[10px] md:text-xs font-medium tracking-tight">
            专业级测速与稳定性追踪。我们监控基础设施，让您无忧连接。
          </p>
          <div className="hidden md:block w-px h-3 bg-neutral-200"></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
              <span className="text-neutral-300"><Search className="w-3 h-3" /></span>
              <span className="text-neutral-400">监测机场</span>
              <span className="text-neutral-900 font-mono">128+</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
              <span className="text-neutral-300"><Zap className="w-3 h-3" /></span>
              <span className="text-neutral-400">实时测速</span>
              <span className="text-neutral-900 font-mono">41k+</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="max-w-7xl mx-auto px-4 space-y-12 flex-grow relative z-10">
        
        {/* Row 1: Today's Pick (3 Items) */}
        <section>
          <SectionHeader 
            icon={Flame} 
            title="今日推荐机场" 
            subtitle="Today's Top Pick" 
            color="text-orange-500" 
            bgClass="bg-orange-500"
            extra={
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-50 border border-neutral-200 text-[10px] font-black text-neutral-500 tracking-widest uppercase">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                报告时间：6 小时前
              </div>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ConclusionCard 
              type="stable"
              name="大象网络"
              tags={['长期稳定', '性价比高']}
              score={95}
              details={[
                { label: '稳定记录', value: '455 天' },
                { label: '最近30天', value: '0 波动' },
              ]}
              conclusion="整体最均衡，适合大多数用户优先考虑。长期使用稳定，响应极快。"
            />
            <ConclusionCard 
              type="stable"
              name="极速蜂"
              tags={['高速稳定', '售后快']}
              score={94}
              details={[
                { label: '稳定记录', value: '310 天' },
                { label: '晚高峰速率', value: '800Mbps+' },
              ]}
              conclusion="近期表现极其亮眼，客服响应速度极快，适合对售后有要求的用户。"
            />
            <ConclusionCard 
              type="stable"
              name="飞鸟云"
              tags={['全能型', '节点多']}
              score={93}
              details={[
                { label: '稳定记录', value: '280 天' },
                { label: '全球节点', value: '120+' },
              ]}
              conclusion="节点覆盖极其广泛，无论是在东南亚还是欧美，延迟表现都非常均衡。"
            />
          </div>
        </section>

        {/* Row 2: Most Stable (3 Items) */}
        <section>
          <SectionHeader 
            icon={Trophy} 
            title="长期稳定机场" 
            subtitle="Most Stable" 
            color="text-emerald-500" 
            bgClass="bg-emerald-500"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ConclusionCard 
              type="stable"
              name="稳如泰山"
              tags={['BGP中继', '零波动']}
              score={96}
              details={[
                { label: '稳定记录', value: '620 天' },
                { label: '可用率', value: '99.99%' },
              ]}
              conclusion="名副其实的稳定性之王，采用多线BGP中继，近两年几乎无任何掉线记录。"
            />
            <ConclusionCard 
              type="stable"
              name="极光加速"
              tags={['高性能', '专线直连']}
              score={94}
              details={[
                { label: '稳定记录', value: '380 天' },
                { label: '可用率', value: '99.9%' },
              ]}
              conclusion="近30天可用率最高，波动最低。适合对稳定性有极致要求的专业用户。"
            />
            <ConclusionCard 
              type="stable"
              name="恒星网络"
              tags={['老牌机场', '极低延迟']}
              score={95}
              details={[
                { label: '运营时长', value: '4年+' },
                { label: '平均延迟', value: '35ms' },
              ]}
              conclusion="老牌机场，技术底蕴深厚，自研传输协议，在极端网络环境下依然稳健。"
            />
          </div>
        </section>

        {/* Row 3: Best Value (3 Items) */}
        <section>
          <SectionHeader 
            icon={Banknote} 
            title="性价比最佳" 
            subtitle="Best Value" 
            color="text-sky-500" 
            bgClass="bg-sky-500"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ConclusionCard 
              type="value"
              name="星岛梦"
              tags={['性价比高', '入门首选']}
              score={92}
              details={[
                { label: '连续无波动', value: '24 天' },
                { label: '价格', value: '¥9.9/月起' },
              ]}
              conclusion="价格低于平均水平，近期性能表现稳定。预算有限的首选。"
            />
            <ConclusionCard 
              type="value"
              name="蓝鸟云"
              tags={['大带宽', '低延迟']}
              score={90}
              details={[
                { label: '稳定记录', value: '120 天' },
                { label: '价格', value: '¥15.0/月起' },
              ]}
              conclusion="在同价位中提供了极高的带宽冗余，晚高峰表现亮眼。"
            />
            <ConclusionCard 
              type="value"
              name="极客云"
              tags={['多节点', '性价比']}
              score={89}
              details={[
                { label: '稳定记录', value: '95 天' },
                { label: '价格', value: '¥12.0/月起' },
              ]}
              conclusion="节点覆盖面广，虽然单点性能不是最强，但综合性价比极高。"
            />
          </div>
        </section>

        {/* Row 4: New Entries (3 Items) */}
        <section>
          <SectionHeader 
            icon={Plus} 
            title="新入榜潜力" 
            subtitle="New Entries" 
            color="text-indigo-500" 
            bgClass="bg-indigo-500"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ConclusionCard 
              type="new"
              name="闪电猫"
              tags={['新入榜', '高性能']}
              score={88}
              details={[
                { label: '观察时长', value: '14 天' },
                { label: '近期评分', value: '上升中' },
              ]}
              conclusion="稳定性强，适合长期使用，价格适中。目前处于观察期，表现优异。"
            />
            <ConclusionCard 
              type="new"
              name="银河Link"
              tags={['新入榜', '原生IP']}
              score={87}
              details={[
                { label: '观察时长', value: '10 天' },
                { label: '流媒体解锁', value: '全绿' },
              ]}
              conclusion="主打流媒体解锁，新开线路负载极低，速度表现非常惊人。"
            />
            <ConclusionCard 
              type="new"
              name="雷霆Cloud"
              tags={['新入榜', '低延迟']}
              score={86}
              details={[
                { label: '观察时长', value: '7 天' },
                { label: '节点类型', value: '全IEPL' },
              ]}
              conclusion="全线IEPL内网传输，延迟表现极佳，正在观察其长期扩容能力。"
            />
          </div>
        </section>

        {/* Row 5: Risk Alerts */}
        <section>
          <SectionHeader 
            icon={AlertTriangle} 
            title="风险预警" 
            subtitle="Risk Alerts" 
            color="text-rose-500" 
            bgClass="bg-rose-500"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <ConclusionCard 
                type="risk"
                name="跑路云"
                tags={['风险观察', '官网失联']}
                score={42}
                details={[
                  { label: '异常记录', value: '官网失联' },
                  { label: '投诉指数', value: '显著上升' },
                ]}
                conclusion="近期波动变大，官网异常。建议立即停止续费，转移数据。"
              />
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 mt-24 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex flex-col items-center gap-6 mb-12">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <Zap className="text-white w-5 h-5" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-black text-xl tracking-tighter leading-none">机场榜</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">GateRank</span>
              </div>
            </div>
            <p className="text-neutral-500 max-w-md text-sm leading-relaxed">
              GateRank 致力于提供最真实的机场测评数据。我们不接受任何形式的付费排名，所有结论均基于客观监测数据。
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-sm font-bold text-neutral-600 mb-12">
            <a href="#" className="hover:text-black transition-colors">测评方法论</a>
            <a href="#" className="hover:text-black transition-colors">服务条款</a>
            <a href="#" className="hover:text-black transition-colors">隐私政策</a>
          </div>

          <div className="border-t border-neutral-100 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-[10px] text-neutral-400 font-medium">
              © 2026 GateRank. All rights reserved. 评分独立性声明：本站不含任何付费推广排名。
            </div>
            <div className="flex gap-6 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              <span>Status: Online</span>
              <span>API: v2.4.1</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
