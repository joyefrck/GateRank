import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;
const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'og');

// The homepage OG image is supplied artwork and should not be regenerated here.
const pages = [
  {
    file: 'rankings-all.png',
    eyebrow: 'FULL AIRPORT RANKING',
    title: ['全量机场', '排行榜'],
    subtitle: '全部已上线机场评分排名与筛选入口',
    score: 'Top 100',
    scoreSuffix: '',
    scoreLabel: '综合排名',
    badge: '每日更新',
    accent: '#0f766e',
    lightAccent: '#ccfbf1',
    features: [
      ['稳定性 S', '可用率与波动'],
      ['性能 P', '延迟与下载速度'],
      ['价格 C', '月付与年付对比'],
      ['风险 R', '域名/证书/投诉'],
      ['多维筛选', '支付/客户端/地区'],
      ['测评报告', '逐个机场详情'],
    ],
  },
  {
    file: 'tools.png',
    eyebrow: 'NETWORK TOOLBOX',
    title: ['网络检测', '工具箱'],
    subtitle: '客户端下载、流媒体解锁、IP 与 DNS 泄漏检测入口',
    score: '4',
    scoreSuffix: '工具',
    scoreLabel: '实用工具',
    badge: '免费',
    accent: '#0f766e',
    lightAccent: '#ccfbf1',
    features: [
      ['客户端下载', '五大平台入口'],
      ['流媒体', '六项服务检测'],
      ['IP 查询', '地区与 ASN'],
      ['DNS 泄漏', '解析器证据'],
      ['隐私边界', '按现有规则处理'],
      ['统一入口', '工具集中导航'],
    ],
  },
  {
    file: 'download.png',
    eyebrow: 'TOOLS DOWNLOAD',
    title: ['翻墙工具', '下载中心'],
    subtitle: '科学上网客户端、机场订阅工具与可信安装包入口',
    score: '5',
    scoreSuffix: '平台',
    scoreLabel: '客户端工具',
    badge: '可信',
    accent: '#0891b2',
    lightAccent: '#cffafe',
    features: [
      ['Windows', 'Clash/v2rayN'],
      ['macOS', 'Clash Verge'],
      ['iOS', '小火箭'],
      ['Android', 'v2rayNG'],
      ['Linux', 'sing-box'],
      ['受控下载', '安装包入口'],
    ],
  },
  {
    file: 'tools-streaming-check.png',
    eyebrow: 'STREAMING CHECK',
    title: ['流媒体', '解锁检测'],
    subtitle: 'ChatGPT、Netflix、Claude、TikTok 等覆盖与连通判断',
    score: '6',
    scoreSuffix: '服务',
    scoreLabel: '解锁检测',
    badge: '实时',
    accent: '#2563eb',
    lightAccent: '#dbeafe',
    features: [
      ['ChatGPT', 'AI 服务覆盖'],
      ['Netflix', '地区与片源'],
      ['Claude', '官方地区'],
      ['TikTok', '短视频访问'],
      ['Disney+', '流媒体覆盖'],
      ['HBO Max', '基础连通'],
    ],
  },
  {
    file: 'tools-ip-check.png',
    eyebrow: 'IP GEOLOCATION',
    title: ['IP 地理', '位置查询'],
    subtitle: '出口 IP、国家地区、ISP、ASN 与时区信息',
    score: 'IP',
    scoreSuffix: '',
    scoreLabel: '网络定位',
    badge: '免费',
    accent: '#7c3aed',
    lightAccent: '#ede9fe',
    features: [
      ['IPv4', '公网地址查询'],
      ['IPv6', '新协议支持'],
      ['域名', '解析后查询'],
      ['ISP', '网络运营商'],
      ['ASN', '自治系统编号'],
      ['地图', '地区与时区'],
    ],
  },
  {
    file: 'tools-dns-leak-test.png',
    eyebrow: 'DNS LEAK TEST',
    title: ['DNS 泄漏', '检测'],
    subtitle: '递归解析器、出口地区与 DNSSEC 能力信号',
    score: '10',
    scoreSuffix: '探针',
    scoreLabel: '解析路径',
    badge: '隐私',
    accent: '#047857',
    lightAccent: '#d1fae5',
    features: [
      ['递归 DNS', '真实解析器证据'],
      ['出口比较', '地区一致性'],
      ['DNSSEC', '能力信号'],
      ['AS 编号', '解析器网络'],
      ['十次探针', '一次性测试域名'],
      ['风险解释', '不输出伪结论'],
    ],
  },
  {
    file: 'monthly-reports.png',
    eyebrow: 'MONTHLY REPORTS',
    title: ['机场 VPN', '月度报告'],
    subtitle: '机场推荐、排名变化、测速趋势与跑路风险观察',
    score: '30d',
    scoreSuffix: '复盘',
    scoreLabel: '月度观察',
    badge: 'SEO',
    accent: '#be123c',
    lightAccent: '#ffe4e6',
    features: [
      ['机场推荐', '本月榜单变化'],
      ['机场排名', '全量榜单复盘'],
      ['稳定性', '可用率和波动'],
      ['测速趋势', '延迟与下载速度'],
      ['跑路风险', '异常与投诉观察'],
      ['下月清单', '持续跟踪重点'],
    ],
  },
  {
    file: 'deals-coupons.png',
    eyebrow: 'DEALS & COUPONS',
    title: ['机场优惠码', '大全'],
    subtitle: '活动折扣、免费试用与 USDT 支付优惠',
    score: '6/6',
    scoreSuffix: '活动',
    scoreLabel: '广告位活动',
    badge: '限时',
    accent: '#dc2626',
    lightAccent: '#fee2e2',
    features: [
      ['优惠码', '新用户与续费折扣'],
      ['免费试用', '先测后买'],
      ['USDT 支付', '加密货币优惠'],
      ['活动时间', '起止日期清晰'],
      ['套餐适用', '月付/季付/年付'],
      ['报告联动', '优惠与评分同看'],
    ],
  },
  {
    file: 'risk-monitor.png',
    eyebrow: 'RISK MONITOR',
    title: ['跑路机场', '监测'],
    subtitle: '高风险机场名单与机场跑路预警',
    score: '24h',
    scoreSuffix: '监测',
    scoreLabel: '风险观察',
    badge: '预警',
    accent: '#7f1d1d',
    lightAccent: '#fecaca',
    features: [
      ['官网异常', '域名和证书状态'],
      ['风险扣分', 'R 维度透明展示'],
      ['失联预警', '服务不可用提醒'],
      ['历史事件', '投诉与事故记录'],
      ['名单追踪', '高风险机场列表'],
      ['数据导出', 'JSON / Markdown'],
    ],
  },
  {
    file: 'methodology.png',
    eyebrow: 'METHODOLOGY',
    title: ['机场测评', '方法'],
    subtitle: '评估维度、数据来源与推荐依据',
    score: '5',
    scoreSuffix: '维度',
    scoreSuffixX: 172,
    scoreLabel: '公开原则',
    badge: '方法',
    accent: '#4f46e5',
    lightAccent: '#e0e7ff',
    features: [
      ['稳定性', '长期可用与连接波动'],
      ['性能', '真实连接体验'],
      ['网络覆盖', '地区与健康状态'],
      ['性价比', '价格与体验匹配'],
      ['风险', '信任信号独立呈现'],
      ['历史留痕', '日期与规则版本'],
    ],
  },
  {
    file: 'rankings-payment.png',
    eyebrow: 'PAYMENT FILTERS',
    title: ['支付方式', '机场排行'],
    subtitle: '按微信、支付宝、USDT 等付款方式筛选机场 VPN',
    score: '9',
    scoreSuffix: '方式',
    scoreLabel: '支付筛选',
    badge: '可比',
    accent: '#0f766e',
    lightAccent: '#ccfbf1',
    features: [
      ['支付宝', '普通用户核对'],
      ['微信', '常用付款'],
      ['USDT', '链上支付'],
      ['银行卡', '境外支付'],
      ['PayPal', '国际付款'],
      ['报告联动', '评分同看'],
    ],
  },
  {
    file: 'rankings-unlock.png',
    eyebrow: 'UNLOCK FILTERS',
    title: ['解锁服务', '机场排行'],
    subtitle: '按 Netflix、ChatGPT、Disney+ 等能力筛选',
    score: '7',
    scoreSuffix: '场景',
    scoreLabel: '解锁筛选',
    badge: '细分',
    accent: '#2563eb',
    lightAccent: '#dbeafe',
    features: [
      ['Netflix', '流媒体解锁'],
      ['ChatGPT', 'AI 工具访问'],
      ['Disney+', '海外内容'],
      ['YouTube', '视频体验'],
      ['TikTok', '短视频访问'],
      ['报告联动', '评分同看'],
    ],
  },
  {
    file: 'rankings-client.png',
    eyebrow: 'CLIENT FILTERS',
    title: ['客户端', '机场排行'],
    subtitle: '按 Clash、Shadowrocket、sing-box 等客户端筛选',
    score: '16',
    scoreSuffix: '工具',
    scoreLabel: '客户端筛选',
    badge: '适配',
    accent: '#0891b2',
    lightAccent: '#cffafe',
    features: [
      ['Clash', '桌面代理'],
      ['小火箭', 'iOS 客户端'],
      ['sing-box', '新核心支持'],
      ['v2rayN', 'Windows 常用'],
      ['导入方式', '订阅兼容'],
      ['报告联动', '评分同看'],
    ],
  },
  {
    file: 'rankings-region.png',
    eyebrow: 'REGION FILTERS',
    title: ['节点地区', '机场排行'],
    subtitle: '按香港、日本、新加坡、美国等节点地区筛选',
    score: '11',
    scoreSuffix: '地区',
    scoreLabel: '地区筛选',
    badge: '覆盖',
    accent: '#7c3aed',
    lightAccent: '#ede9fe',
    features: [
      ['香港', '低延迟常用'],
      ['日本', '游戏与视频'],
      ['新加坡', '东南亚线路'],
      ['美国', '内容覆盖'],
      ['台湾', '本地内容'],
      ['报告联动', '评分同看'],
    ],
  },
  {
    file: 'rankings-line.png',
    eyebrow: 'LINE FILTERS',
    title: ['线路类型', '机场排行'],
    subtitle: '按 IEPL、IPLC、CN2、BGP、中转线路筛选',
    score: '5',
    scoreSuffix: '线路',
    scoreLabel: '线路筛选',
    badge: '网络',
    accent: '#ea580c',
    lightAccent: '#ffedd5',
    features: [
      ['IEPL', '企业级专线'],
      ['IPLC', '跨境专线'],
      ['CN2', '优质回程'],
      ['BGP', '多线接入'],
      ['中转', '常见线路'],
      ['报告联动', '评分同看'],
    ],
  },
  {
    file: 'apply.png',
    eyebrow: 'APPLY FOR TEST',
    title: ['申请入驻', '测试'],
    subtitle: '提交机场资料、测试账号与订阅信息',
    score: '3',
    scoreSuffix: '步',
    scoreLabel: '申请流程',
    badge: '审核',
    accent: '#111827',
    lightAccent: '#e5e7eb',
    features: [
      ['资料提交', '官网与品牌'],
      ['测试账号', '订阅与套餐'],
      ['人工审核', '基础合规'],
      ['公开监测', '数据入库'],
      ['测评报告', '页面生成'],
      ['持续更新', '每日重算'],
    ],
  },
  {
    file: 'for-ai.png',
    eyebrow: 'MACHINE READABLE',
    title: ['GateRank', 'for AI'],
    subtitle: '机器可读数据、引用方式与 AI 应用入口',
    score: 'JSON',
    scoreSuffix: '',
    scoreLabel: '数据入口',
    badge: 'AI',
    accent: '#4f46e5',
    lightAccent: '#e0e7ff',
    features: [
      ['JSON', '结构化数据'],
      ['Markdown', '可读摘要'],
      ['排行榜', '机场排名'],
      ['风险监测', '跑路预警'],
      ['月度报告', '长期观察'],
      ['引用规范', 'AI 友好'],
    ],
  },
  {
    file: 'publish-token-docs.png',
    eyebrow: 'PUBLISH TOKEN DOCS',
    title: ['发布令牌', '接入文档'],
    subtitle: '自动发稿、封面上传、草稿发布与权限范围',
    score: 'API',
    scoreSuffix: '',
    scoreLabel: '接口文档',
    badge: 'Docs',
    accent: '#334155',
    lightAccent: '#e2e8f0',
    features: [
      ['鉴权', 'Bearer Token'],
      ['创建文章', '草稿入库'],
      ['上传封面', '图片托管'],
      ['发布归档', '状态流转'],
      ['权限矩阵', 'Scope 控制'],
      ['Markdown', '文档原文'],
    ],
  },
  {
    file: 'airport-report.png',
    eyebrow: 'AIRPORT REPORT',
    title: ['机场测评', '报告'],
    subtitle: '官网入口、评分、稳定性、速度与风险分析',
    score: 'S/P/R',
    scoreSuffix: '',
    scoreLabel: '测评模型',
    badge: '详情',
    accent: '#be123c',
    lightAccent: '#ffe4e6',
    features: [
      ['官网状态', '可访问性'],
      ['稳定性', '30 天趋势'],
      ['速度', '延迟与下载'],
      ['价格', '套餐门槛'],
      ['风险', '异常扣分'],
      ['历史数据', '长期观察'],
    ],
  },
  {
    file: 'news.png',
    eyebrow: 'GATERANK NEWS',
    title: ['GateRank', 'News'],
    subtitle: '机场推荐、跑路预警与科学上网指南',
    score: 'News',
    scoreSuffix: '',
    scoreLabel: '资讯中心',
    badge: '更新',
    accent: '#c93a2e',
    lightAccent: '#fee2e2',
    features: [
      ['机场推荐', '榜单解读'],
      ['跑路预警', '风险事件'],
      ['客户端', '配置教程'],
      ['支付安全', 'USDT 与订单'],
      ['专题聚合', '深度整理'],
      ['编辑更新', '持续发布'],
    ],
  },
  {
    file: 'news-category.png',
    eyebrow: 'NEWS CATEGORY',
    title: ['新闻分类', '专题入口'],
    subtitle: '按机场测评、风险预警、教程和支付安全浏览',
    score: '8',
    scoreSuffix: '类',
    scoreLabel: '内容分类',
    badge: '导航',
    accent: '#b45309',
    lightAccent: '#fef3c7',
    features: [
      ['测评', '机场报告'],
      ['预警', '风险观察'],
      ['教程', '客户端配置'],
      ['支付', '订单安全'],
      ['推荐', '榜单解读'],
      ['专题', '内容聚合'],
    ],
  },
  {
    file: 'news-topic.png',
    eyebrow: 'NEWS TOPIC',
    title: ['新闻专题', '聚合页'],
    subtitle: '围绕机场推荐、跑路监测、Clash 与 USDT 聚合',
    score: '6',
    scoreSuffix: '专题',
    scoreLabel: '专题聚合',
    badge: '深读',
    accent: '#0f766e',
    lightAccent: '#ccfbf1',
    features: [
      ['推荐专题', '选购线索'],
      ['风险专题', '跑路监测'],
      ['Clash', '客户端生态'],
      ['USDT', '支付安全'],
      ['AI 工具', '解锁观察'],
      ['长期更新', '内容沉淀'],
    ],
  },
  {
    file: 'news-article.png',
    eyebrow: 'NEWS ARTICLE',
    title: ['GateRank', '文章'],
    subtitle: '机场服务、客户端配置、支付安全与风险观察',
    score: 'SEO',
    scoreSuffix: '',
    scoreLabel: '文章分享',
    badge: '阅读',
    accent: '#dc2626',
    lightAccent: '#fee2e2',
    features: [
      ['观点', '编辑分析'],
      ['教程', '配置步骤'],
      ['风险', '事件记录'],
      ['榜单', '排名引用'],
      ['专题', '相关阅读'],
      ['分享', '社交预览'],
    ],
  },
];

await mkdir(OUTPUT_DIR, { recursive: true });

for (const page of pages) {
  const svg = renderOgSvg(page);
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(OUTPUT_DIR, page.file));
}

function renderOgSvg(page) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.54" stop-color="#f8fbff"/>
      <stop offset="1" stop-color="${page.lightAccent}"/>
    </linearGradient>
    <radialGradient id="globeFade" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${page.accent}" stop-opacity="0.22"/>
      <stop offset="0.75" stop-color="${page.accent}" stop-opacity="0.11"/>
      <stop offset="1" stop-color="${page.accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#0f172a" flood-opacity="0.14"/>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" rx="34" fill="url(#bg)"/>
  <rect x="30" y="30" width="1140" height="570" rx="28" fill="#ffffff" fill-opacity="0.74" stroke="#dbeafe" stroke-width="2"/>
  ${renderGlobe(page)}

  ${renderBrandLogo()}

  <text x="204" y="103" fill="#64748b" font-size="22" font-weight="800" font-family="${fontStack()}" letter-spacing="4">${escapeXml(page.eyebrow)}</text>
  <text x="204" y="156" fill="#050505" font-size="54" font-weight="900" font-family="${fontStack()}">${escapeXml(page.title[0])}</text>
  <text x="204" y="218" fill="#050505" font-size="64" font-weight="900" font-family="${fontStack()}">${escapeXml(page.title[1])}</text>
  <text x="204" y="263" fill="#334155" font-size="25" font-weight="700" font-family="${fontStack()}">${escapeXml(page.subtitle)}</text>

  <g transform="translate(82 328)">
    <text x="0" y="0" fill="#f59e0b" font-size="30" font-weight="900" font-family="${fontStack()}">★</text>
    <text x="44" y="0" fill="#111827" font-size="23" font-weight="900" font-family="${fontStack()}">${escapeXml(page.scoreLabel)}</text>
    <text x="0" y="82" fill="#050505" font-size="${page.score.length > 5 ? 56 : 72}" font-weight="900" font-family="${fontStack()}">${escapeXml(page.score)}</text>
    ${page.scoreSuffix ? `<text x="${page.scoreSuffixX || (page.score.length > 5 ? 214 : 182)}" y="82" fill="#334155" font-size="30" font-weight="900" font-family="${fontStack()}">${escapeXml(page.scoreSuffix)}</text>` : ''}
    <rect x="310" y="30" width="86" height="52" rx="14" fill="${page.lightAccent}"/>
    <text x="353" y="65" text-anchor="middle" fill="${page.accent}" font-size="26" font-weight="900" font-family="${fontStack()}">${escapeXml(page.badge)}</text>
  </g>

  ${renderFeatureGrid(page)}

  <g transform="translate(820 548)">
    <rect width="320" height="48" rx="24" fill="#0f172a"/>
    <circle cx="32" cy="24" r="12" fill="none" stroke="#ffffff" stroke-width="2"/>
    <path d="M20 24 H44 M32 12 C25 19 25 29 32 36 M32 12 C39 19 39 29 32 36" stroke="#ffffff" stroke-width="1.8" fill="none"/>
    <text x="62" y="32" fill="#ffffff" font-size="25" font-weight="800" font-family="${fontStack()}">gate-rank.com</text>
  </g>
</svg>`;
}

function renderFeatureGrid(page) {
  const icons = ['↯', '▶', 'AI', '¥', '◆', '✓'];
  return page.features.map((feature, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 82 + col * 178;
    const y = 486 + row * 82;
    return `
  <g transform="translate(${x} ${y})">
    <rect x="0" y="-54" width="150" height="66" rx="14" fill="#ffffff" fill-opacity="0.72" stroke="#e2e8f0"/>
    <circle cx="27" cy="-21" r="17" fill="${page.lightAccent}"/>
    <text x="27" y="-14" text-anchor="middle" fill="${page.accent}" font-size="16" font-weight="900" font-family="${fontStack()}">${escapeXml(icons[index])}</text>
    <text x="54" y="-27" fill="#0f172a" font-size="18" font-weight="900" font-family="${fontStack()}">${escapeXml(feature[0])}</text>
    <text x="54" y="-4" fill="#64748b" font-size="14" font-weight="700" font-family="${fontStack()}">${escapeXml(feature[1])}</text>
  </g>`;
  }).join('');
}

function renderBrandLogo() {
  return `
  <g transform="translate(82 82) scale(2.875)" filter="url(#shadow)">
    <rect width="32" height="32" rx="7" fill="#171717"/>
    <path d="M17 5 8.8 15H14.5L13 27 23.2 14H17.5L19 5Z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

function renderGlobe(page) {
  const dots = [
    [900, 296],
    [965, 235],
    [1030, 327],
    [1092, 258],
    [976, 440],
    [872, 402],
  ];
  const lines = [
    [0, 1],
    [1, 2],
    [2, 3],
    [0, 2],
    [0, 5],
    [2, 4],
    [4, 5],
    [1, 3],
  ];
  return `
  <circle cx="1010" cy="360" r="250" fill="url(#globeFade)"/>
  <circle cx="1010" cy="360" r="230" fill="none" stroke="${page.accent}" stroke-opacity="0.22" stroke-width="2"/>
  <path d="M790 360 C850 300 930 276 1010 276 C1090 276 1170 300 1230 360" fill="none" stroke="${page.accent}" stroke-opacity="0.18" stroke-width="2"/>
  <path d="M790 360 C850 420 930 444 1010 444 C1090 444 1170 420 1230 360" fill="none" stroke="${page.accent}" stroke-opacity="0.18" stroke-width="2"/>
  <path d="M1010 130 C950 210 940 510 1010 590" fill="none" stroke="${page.accent}" stroke-opacity="0.16" stroke-width="2"/>
  <path d="M1010 130 C1070 210 1080 510 1010 590" fill="none" stroke="${page.accent}" stroke-opacity="0.16" stroke-width="2"/>
  ${lines.map(([from, to]) => `<line x1="${dots[from][0]}" y1="${dots[from][1]}" x2="${dots[to][0]}" y2="${dots[to][1]}" stroke="${page.accent}" stroke-opacity="0.45" stroke-width="3"/>`).join('')}
  ${dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="${page.accent}" fill-opacity="0.86"/>`).join('')}
  ${Array.from({ length: 34 }, (_, index) => {
    const x = 790 + (index % 9) * 48;
    const y = 170 + Math.floor(index / 9) * 62;
    return `<circle cx="${x}" cy="${y}" r="2.3" fill="${page.accent}" fill-opacity="0.25"/>`;
  }).join('')}`;
}

function fontStack() {
  return 'Inter, PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif';
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
