export interface DefaultNewsTaxonomyItem {
  name: string;
  slug: string;
  description: string;
  sort_order: number;
}

export const DEFAULT_NEWS_CATEGORIES: DefaultNewsTaxonomyItem[] = [
  {
    name: '机场测评',
    slug: 'airport-reviews',
    description: '机场推荐、机场测评、节点稳定性和服务质量观察。',
    sort_order: 10,
  },
  {
    name: '风险预警',
    slug: 'risk-warning',
    description: '跑路机场、支付风险、服务异常和订阅安全预警。',
    sort_order: 20,
  },
  {
    name: '使用教程',
    slug: 'tutorials',
    description: '科学上网、机场订阅、客户端配置和新手入门教程。',
    sort_order: 30,
  },
  {
    name: '支付安全',
    slug: 'payment-security',
    description: 'USDT 机场支付、隐私支付、退款风险和付款安全指南。',
    sort_order: 40,
  },
  {
    name: '客户端协议',
    slug: 'client-protocols',
    description: 'Clash、Shadowrocket、Sing-box 等客户端和协议配置。',
    sort_order: 50,
  },
  {
    name: '行业监管',
    slug: 'industry-regulation',
    description: '机场行业监管、合规动态和跨境网络服务观察。',
    sort_order: 60,
  },
  {
    name: '机场主运营',
    slug: 'operator-ops',
    description: '机场主运营、用户增长、服务支持和风控运营方法。',
    sort_order: 70,
  },
  {
    name: 'AI工具',
    slug: 'ai-tools',
    description: 'AI 工具访问、模型服务可用性和智能工具使用指南。',
    sort_order: 80,
  },
];

export const DEFAULT_NEWS_TOPICS: DefaultNewsTaxonomyItem[] = [
  {
    name: '2026机场推荐专题',
    slug: 'airport-recommendations-2026',
    description: '围绕 2026 年机场 VPN 推荐、选择标准、稳定性和风险的专题内容。',
    sort_order: 10,
  },
  {
    name: '跑路机场监测专题',
    slug: 'runaway-airport-monitoring',
    description: '持续追踪跑路机场、异常公告、不可用风险和订阅安全提醒。',
    sort_order: 20,
  },
  {
    name: 'Clash机场订阅专题',
    slug: 'clash-subscription',
    description: 'Clash 机场订阅、配置导入、规则分流和常见错误处理。',
    sort_order: 30,
  },
  {
    name: 'USDT机场支付专题',
    slug: 'usdt-airport-payment',
    description: 'USDT 机场支付流程、链选择、到账确认和支付安全。',
    sort_order: 40,
  },
  {
    name: '机场测评方法专题',
    slug: 'airport-review-methodology',
    description: 'GateRank 机场测评方法、评分指标、风险判断和数据解读。',
    sort_order: 50,
  },
  {
    name: 'AI工具访问专题',
    slug: 'ai-tool-access',
    description: 'AI 工具访问、节点选择、可用性测试和跨境访问体验。',
    sort_order: 60,
  },
];
