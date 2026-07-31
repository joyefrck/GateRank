export interface SpeedStats {
  hk: number; // ms
  sg: number; // ms
  jp: number; // ms
  us: number; // ms
  averageSpeed: number; // Mbps
  packetLoss: number; // %
}

export interface ReviewComment {
  user: string;
  avatar: string;
  rating: number;
  time: string;
  comment: string;
}

export interface Airport {
  id: string;
  name: string;
  logoText: string;
  logoColor: string;
  description: string;
  tags: string[];
  price: number;
  rating: number;
  votes: number;
  nodes: number;
  features: string[];
  categories: string[]; // '综合排名', '性价比榜', '流媒体榜', 'AI 解锁榜', '稳定性榜', '游戏加速榜', '跑路监测', '新秀机场'
  status: 'normal' | 'risk' | 'scam'; // For "跑路监测" (Exit alert) feature
  riskScore?: number; // 0-100, 100 means extreme risk
  speedStats: SpeedStats;
  reviews: ReviewComment[];
  isSponsored?: boolean;
  sponsoredText?: string;
  officialUrl: string;
}

export interface Announcement {
  id: string;
  title: string;
  date: string;
  content: string;
}

export interface UtilityTool {
  id: string;
  name: string;
  description: string;
  iconName: string;
  type: string;
}

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  { id: '1', title: 'GateRank 2.0 全新升级公告', date: '05-20', content: '为了提供更全面、公开透明的机场测速考核，GateRank 今日完成 2.0 智能打分系统升级。引入了多地区实时丢包率、延迟以及节点在线率加权算法，确保排行榜免受人为刷票干扰。敬请期待 3.0 更简洁的交互体验。' },
  { id: '2', title: '关于评分算法的说明与声明', date: '05-18', content: '我们在此重申：GateRank 是中立公正的评测平台。我们的星级评分是由：全球实测算力 (40%) + 历史稳定性 (30%) + 用户评价评分 (30%) 综合计算得出。任何赞助商的赞助费用仅能购买侧边栏曝光广告，绝对无法左右或干涉主榜单上的具体排名与评分。' },
  { id: '3', title: '如何正确选择适合自己的机场？', date: '05-17', content: '新手常犯的一个错误是仅仅看价格。若您主要用于写论文或使用 ChatGPT，优先寻找配有多国原生 IP 以及原生 AI 解锁线路的机场；而如果您是影音发烧友，则高带宽、低丢包率的 IEPL / IPLC 专线是看 4K HDR 串流的最佳保障。' },
  { id: '4', title: '机场评测标准与方法（2026年修订版）', date: '05-15', content: '2026年夏季评测规范：增加“节点峰值波动振幅”与“多客户端流控响应”两个新维度。所有测速点目前涵盖香港 HKT、新加坡 GTT、东京 IDCF，并全线支持 IPv6 测速条件下的性能审查。' },
  { id: '5', title: '常见问题解答 (FAQ) 及跑路申诉', date: '05-10', content: '如果发现某个机场长时间无法连接，并且官网出现无法访问、删群等异常行为，欢迎进入“跑路监测”板块提交实时舆情。我们会在核实情况后将其评级降为“高危风险”，最大限度降低用户遭受跑路资金损失。' }
];

export const INITIAL_AIRPORTS: Airport[] = [
  {
    id: 'elephant',
    name: '大象网络',
    logoText: '大',
    logoColor: 'from-blue-500 to-indigo-600',
    description: '优质 IEPL 专线，稳定高速，高通稳定，性价比首选',
    tags: ['IEPL 专线', '稳定可靠', '客服响应快', '原生IP'],
    price: 18.00,
    rating: 4.89,
    votes: 1203,
    nodes: 150,
    features: ['IEPL', '原生 IP', '解锁流媒体'],
    categories: ['综合排名', '流媒体榜', '稳定性榜'],
    status: 'normal',
    speedStats: { hk: 22, sg: 34, jp: 42, us: 110, averageSpeed: 450, packetLoss: 0.1 },
    reviews: [
      { user: '极客先锋', avatar: '🦁', rating: 5, time: '2小时前', comment: '大象网络真心稳定，晚高峰跑满带宽，不卡顿。' },
      { user: '云端漫步-Y', avatar: '🐼', rating: 4.8, time: '1天前', comment: '专线延迟很舒服，打港服游戏太好使了，丢包基本上是0。' }
    ],
    isSponsored: true,
    sponsoredText: '限时 6 折',
    officialUrl: 'https://elephant-net.com'
  },
  {
    id: 'flycat',
    name: '飞猫云',
    logoText: '飞',
    logoColor: 'from-purple-500 to-indigo-500',
    description: '流媒体解锁专家，全球极速专线',
    tags: ['解锁 Netflix', 'Disney+', '流畅 4K', '多国节点'],
    price: 15.00,
    rating: 4.78,
    votes: 982,
    nodes: 120,
    features: ['解锁流媒体', 'Netflix', 'Disney+', 'YouTube'],
    categories: ['综合排名', '性价比榜', '流媒体榜', 'AI 解锁榜'],
    status: 'normal',
    speedStats: { hk: 25, sg: 38, jp: 46, us: 118, averageSpeed: 410, packetLoss: 0.2 },
    reviews: [
      { user: '影音发烧友', avatar: '🐱', rating: 4.8, time: '3小时前', comment: '拿来看Netflix 4K没有过任何缓冲，非常棒。' }
    ],
    isSponsored: true,
    sponsoredText: '新用户 7 折优惠',
    officialUrl: 'https://flycat-cloud.net'
  },
  {
    id: 'kuromis',
    name: 'Kuromis',
    logoText: 'K',
    logoColor: 'from-pink-500 to-rose-600',
    description: '极低延迟专线，专门解锁 ChatGPT / Claude 等 AI 工具',
    tags: ['IEPL', '稳定连接', 'ChatGPT', '纯净原生IP'],
    price: 20.00,
    rating: 4.65,
    votes: 768,
    nodes: 100,
    features: ['IEPL', '稳定连接', 'ChatGPT'],
    categories: ['综合排名', 'AI 解锁榜', '稳定性榜'],
    status: 'normal',
    speedStats: { hk: 18, sg: 30, jp: 38, us: 105, averageSpeed: 380, packetLoss: 0.05 },
    reviews: [
      { user: 'AI开发者', avatar: '🤖', rating: 4.7, time: '12小时前', comment: '专门用来接Claude API的，几乎不宕机，IP非常干净。' }
    ],
    officialUrl: 'https://kuromis-link.com'
  },
  {
    id: 'xianlu',
    name: '仙路湾',
    logoText: '仙',
    logoColor: 'from-teal-400 to-blue-500',
    description: '高通稳定，性价比最优选择，适合大众日常使用',
    tags: ['IEPL 专线', '稳定可用', '优质优选'],
    price: 16.00,
    rating: 4.56,
    votes: 850,
    nodes: 80,
    features: ['解锁流媒体', 'Netflix', 'Disney+'],
    categories: ['综合排名', '性价比榜', '流媒体榜'],
    status: 'normal',
    speedStats: { hk: 28, sg: 42, jp: 50, us: 130, averageSpeed: 320, packetLoss: 0.4 },
    reviews: [
      { user: '日常刷网者', avatar: '🦊', rating: 4.5, time: '1天前', comment: '这个价位里买到带专线的很超值了，不奢求更多，稳定第一。' }
    ],
    officialUrl: 'https://xianluwan.xyz'
  },
  {
    id: 'netflixpro',
    name: 'NetflixPRO',
    logoText: 'N',
    logoColor: 'from-red-600 to-red-800',
    description: '终极流媒体原生IP解锁机场，双轨回国优化',
    tags: ['IEPL', '双流', 'Disney+', '4K'],
    price: 22.00,
    rating: 4.52,
    votes: 543,
    nodes: 200,
    features: ['IEPL', 'Netflix', 'Disney+', '4K'],
    categories: ['流媒体榜', 'AI 解锁榜'],
    status: 'normal',
    speedStats: { hk: 20, sg: 36, jp: 40, us: 112, averageSpeed: 520, packetLoss: 0.15 },
    reviews: [],
    officialUrl: 'https://netflix-pro.app'
  },
  {
    id: 'abc_airport',
    name: 'ABC 机场',
    logoText: 'A',
    logoColor: 'from-gray-700 to-gray-900',
    description: '多国大节点覆盖，安全加密协议加持',
    tags: ['稳定连接', '多国节点', '安全性高'],
    price: 19.00,
    rating: 4.48,
    votes: 421,
    nodes: 120,
    features: ['稳定连接', '多国节点'],
    categories: ['综合排名', '稳定性榜'],
    status: 'normal',
    speedStats: { hk: 26, sg: 39, jp: 45, us: 125, averageSpeed: 300, packetLoss: 0.3 },
    reviews: [],
    officialUrl: 'https://abc-vpn.org'
  },
  {
    id: 'yandian',
    name: '闪电云',
    logoText: '闪',
    logoColor: 'from-amber-400 to-orange-500',
    description: '轻量级多协议适配器，学生折扣优选',
    tags: ['性价比高', '新用户优惠'],
    price: 13.00,
    rating: 4.45,
    votes: 638,
    nodes: 100,
    features: ['性价比高', '新用户优惠'],
    categories: ['性价比榜'],
    status: 'normal',
    speedStats: { hk: 31, sg: 45, jp: 52, us: 135, averageSpeed: 280, packetLoss: 0.5 },
    reviews: [],
    officialUrl: 'https://shandianyun.space'
  },
  {
    id: 'speedrabbit',
    name: '极速兔',
    logoText: '兔',
    logoColor: 'from-green-400 to-emerald-600',
    description: '深度游戏网络，超低抖动网络优化，电竞加速',
    tags: ['游戏加速', '低延迟', '全球专线'],
    price: 17.00,
    rating: 4.42,
    votes: 567,
    nodes: 150,
    features: ['游戏加速', '低延迟'],
    categories: ['综合排名', '游戏加速榜'],
    status: 'normal',
    speedStats: { hk: 15, sg: 28, jp: 34, us: 120, averageSpeed: 340, packetLoss: 0.08 },
    reviews: [],
    officialUrl: 'https://jisutu-gaming.link'
  },
  {
    id: 'star_net',
    name: '星辰网络',
    logoText: '星',
    logoColor: 'from-sky-500 to-indigo-600',
    description: '全自动负载均衡，全天候平稳传输',
    tags: ['稳定可靠', '客服响应快'],
    price: 14.00,
    rating: 4.38,
    votes: 489,
    nodes: 80,
    features: ['稳定可靠', '客服响应快'],
    categories: ['综合排名', '新秀机场'],
    status: 'normal',
    speedStats: { hk: 29, sg: 40, jp: 48, us: 128, averageSpeed: 310, packetLoss: 0.35 },
    reviews: [],
    officialUrl: 'https://star-network.io'
  },
  {
    id: 'silver_galaxy',
    name: '银河加速',
    logoText: '银',
    logoColor: 'from-cyan-500 to-blue-600',
    description: '新纪元优化线路，多终端同时在线不降速',
    tags: ['高性能比', '多设备支持'],
    price: 12.00,
    rating: 4.35,
    votes: 456,
    nodes: 60,
    features: ['高性能比', '多设备支持'],
    categories: ['性价比榜'],
    status: 'normal',
    speedStats: { hk: 32, sg: 44, jp: 55, us: 140, averageSpeed: 290, packetLoss: 0.6 },
    reviews: [],
    officialUrl: 'https://galaxy-speed.net'
  },
  // New addition
  {
    id: 'cloudnova',
    name: 'CloudNova',
    logoText: 'C',
    logoColor: 'from-amber-500 to-orange-600',
    description: '新晋卓越品牌，拥有顶尖流控系统和独家网络架构',
    tags: ['性价比高', '多国节点', '新用户优惠'],
    price: 14.00,
    rating: 4.45,
    votes: 623,
    nodes: 150,
    features: ['多国节点', '新用户优惠', '稳定不崩溃'],
    categories: ['新秀机场', '性价比榜', '稳定性榜'],
    status: 'normal',
    speedStats: { hk: 24, sg: 35, jp: 43, us: 115, averageSpeed: 420, packetLoss: 0.12 },
    reviews: [
      { user: '新秀发现家', avatar: '🐥', rating: 4.6, time: '4小时前', comment: '作为新秀，这个速度和稳定度超出预期！非常爽。' }
    ],
    isSponsored: true,
    sponsoredText: '年付立减 30 元',
    officialUrl: 'https://cloud-nova.co'
  },
  {
    id: 'future_speed',
    name: '未来加速',
    logoText: '未',
    logoColor: 'from-fuchsia-500 to-purple-600',
    description: '采用下一代 Vless 实测优化，提供极高保密网络',
    tags: ['新上线', '无审计节点', '大带宽'],
    price: 11.00,
    rating: 4.28,
    votes: 180,
    nodes: 70,
    features: ['安全性高', '大带宽'],
    categories: ['新秀机场'],
    status: 'normal',
    speedStats: { hk: 30, sg: 43, jp: 49, us: 132, averageSpeed: 330, packetLoss: 0.4 },
    reviews: [],
    officialUrl: 'https://future-accel.io'
  },
  {
    id: 'thundernet',
    name: 'ThunderNet',
    logoText: '雷',
    logoColor: 'from-violet-600 to-violet-800',
    description: '极致电竞中转线路，支持全球主流加速器',
    tags: ['全专线', '游戏加速', '极致延迟'],
    price: 9.00,
    rating: 4.35,
    votes: 215,
    nodes: 50,
    features: ['极速中转', '游戏优化'],
    categories: ['新秀机场', '游戏加速榜'],
    status: 'normal',
    speedStats: { hk: 19, sg: 32, jp: 40, us: 108, averageSpeed: 360, packetLoss: 0.1 },
    reviews: [],
    officialUrl: 'https://thunder-net-gaming.cc'
  },
  // Risky items for "跑路监测" showcase
  {
    id: 'danger_slow',
    name: '慢速蜗牛 (已跑路)',
    logoText: '蜗',
    logoColor: 'from-red-500 to-red-700',
    description: '【跑路警告】网站关停，节点全部断线。该机场于日前已处于封锁状态，老板删群跑路。',
    tags: ['全部断线', '网站失联', '涉嫌跑路'],
    price: 5.00,
    rating: 1.2,
    votes: 432,
    nodes: 10,
    features: ['无'],
    categories: ['跑路监测'],
    status: 'scam',
    riskScore: 99,
    speedStats: { hk: 999, sg: 999, jp: 999, us: 999, averageSpeed: 0, packetLoss: 100 },
    reviews: [
      { user: '受害者老王', avatar: '😭', rating: 1.0, time: '3天前', comment: '天杀的，刚充的年付VIP第二周就跑路了！千万避雷！' },
      { user: '维权维权', avatar: '😡', rating: 1.0, time: '5天前', comment: '群解散了，官网打不开。铁打的跑路，别上当。' }
    ],
    officialUrl: 'http://scam-snail-offline.xyz'
  },
  {
    id: 'risk_warning',
    name: '风帆加速 (极高风险)',
    logoText: '帆',
    logoColor: 'from-yellow-500 to-orange-600',
    description: '【风险警告】自 5月25日 起，大量用户反馈部分核心专线节点下线，客服工单停滞不回复，Telegram 群禁言。建议小额月付，绝不年付。',
    tags: ['高延迟', '多节点宕机', '群禁言'],
    price: 8.80,
    rating: 2.8,
    votes: 310,
    nodes: 40,
    features: ['节点不稳定', '高延迟'],
    categories: ['跑路监测'],
    status: 'risk',
    riskScore: 75,
    speedStats: { hk: 85, sg: 120, jp: 154, us: 240, averageSpeed: 45, packetLoss: 12.5 },
    reviews: [
      { user: '避雷针小徐', avatar: '⚠️', rating: 2.0, time: '1天前', comment: '多条主力IEPL线都挂了，剩几条直连又卡得要死。群直接禁言了，离跑路不远了估计。' }
    ],
    officialUrl: 'https://sailing-risk-speed.net'
  }
];

export const UTILITY_TOOLS: UtilityTool[] = [
  { id: '1', name: '翻墙工具下载', description: 'Clash / Shadowrocket / Sing-box / Surge 等软件下载', iconName: 'Download', type: 'download' },
  { id: '2', name: '流媒体解锁检测', description: '一键分析 Netflix, Disney+, YouTube 解锁评级', iconName: 'Tv', type: 'netflix' },
  { id: '3', name: 'IP 检测', description: '查询出口 IP 归属地及 ChatGPT / 风控值', iconName: 'Globe', type: 'ippurity' },
  { id: '4', name: 'DNS 泄漏检测', description: '排查 DNS 域名解析过程是否存在隐私泄漏风险', iconName: 'ShieldAlert', type: 'dnsleak' }
];
