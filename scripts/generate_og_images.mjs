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
    subtitle: '评分规则、测速标准、风险扣分与推荐依据',
    score: 'S/P/C/R',
    scoreSuffix: '模型',
    scoreSuffixX: 248,
    scoreLabel: '四维模型',
    badge: '透明',
    accent: '#4f46e5',
    lightAccent: '#e0e7ff',
    features: [
      ['稳定性', '可用率和连续健康天数'],
      ['性能', '延迟、下载与丢包'],
      ['价格', '套餐价格和试用'],
      ['风险', '官网、SSL、投诉'],
      ['时间衰减', '近期数据权重更高'],
      ['每日重算', '公开监测驱动'],
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
