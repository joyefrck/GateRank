import { METHODOLOGY_SEO } from '../../../shared/publicSeo';

export const methodologySeo = METHODOLOGY_SEO;

export const methodologyFacts = [
  {
    value: '五维观察',
    label: '稳定、性能、覆盖、价值与风险',
  },
  {
    value: '持续更新',
    label: '近期变化会被及时记录',
  },
  {
    value: '历史可追溯',
    label: '报告保留日期与规则版本',
  },
] as const;

export const dimensionCards = [
  {
    code: 'S',
    title: '稳定性',
    eyebrow: 'Stability',
    description: '观察服务是否持续可用、连接是否平稳，以及健康表现能否长期保持。',
    detail: '关注长期连续性，避免一次正常或一次故障代表全部体验。',
    tone: 'emerald',
  },
  {
    code: 'P',
    title: '性能',
    eyebrow: 'Performance',
    description: '观察连接响应、传输能力和真实代理请求中的实际体验。',
    detail: '强调具有代表性的持续表现，不以单次峰值作为结论。',
    tone: 'sky',
  },
  {
    code: 'N',
    title: '网络覆盖',
    eyebrow: 'Network',
    description: '观察可检测节点的地区广度、健康情况与整体分布结构。',
    detail: '通过真实代理请求确认节点状态，无法可靠检测的协议会单独标记。',
    tone: 'indigo',
  },
  {
    code: 'C',
    title: '性价比',
    eyebrow: 'Cost Value',
    description: '观察价格、套餐能力与真实使用体验之间是否匹配。',
    detail: '低价或高配置都不是独立结论，价值需要结合服务质量理解。',
    tone: 'amber',
  },
  {
    code: 'R',
    title: '风险',
    eyebrow: 'Risk',
    description: '观察域名、证书、投诉与历史异常等独立信任信号。',
    detail: '让性能问题和信任问题分开呈现，避免优秀跑分掩盖风险变化。',
    tone: 'rose',
  },
] as const;

export const dataPipeline = [
  {
    index: '01',
    title: '持续采集',
    description: '从可检测节点、公开信息和日常监测任务中持续形成样本。',
  },
  {
    index: '02',
    title: '真实性验证',
    description: '关键网络结果需要经过实际代理请求或一致性检查。',
  },
  {
    index: '03',
    title: '多维聚合',
    description: '综合不同维度与时间范围，降低极端样本和单项高光的影响。',
  },
  {
    index: '04',
    title: '异常复核',
    description: '采集缺失、数据突变和风险信号会被独立标记并保留复核空间。',
  },
] as const;

export const resultGuidance = [
  {
    title: '看综合，不看单项',
    description: '速度快、价格低或节点多，都不能独立决定最终推荐。更重要的是多个维度能否共同支撑长期体验。',
  },
  {
    title: '看趋势，不看截图',
    description: '近期变化会被及时记录，历史连续性也会作为判断背景。单次测速截图不能代替持续监测。',
  },
  {
    title: '看数据状态',
    description: '样本不足、当日采集缺失或规则版本不同会明确提示，不会把缺少的数据伪装成确定结论。',
  },
] as const;

export const transparencyBoundary = {
  publicItems: [
    '五个评估维度及其含义',
    '报告日期、趋势与历史快照',
    '风险来源类别与数据状态',
    '规则版本与榜单更新说明',
    '非付费排名与独立性声明',
  ],
  privateItems: [
    '模型权重与组合方式',
    '判断阈值与内部参数',
    '风险信号的具体处理规则',
    '抗操纵与异常识别细节',
    '可用于复算结果的实现逻辑',
  ],
} as const;

export const trustPrinciples = [
  {
    title: '持续监测',
    description: '关注长期表现与近期变化，不让一次采样代表全部体验。',
  },
  {
    title: '真实请求',
    description: '关键网络判断尽量来自实际代理链路，而不是只看端口状态。',
  },
  {
    title: '多维交叉',
    description: '稳定、性能、覆盖、价值与风险相互校验，降低单指标偏见。',
  },
  {
    title: '风险单列',
    description: '信任风险独立呈现，用户可以区分体验下降与风险变化。',
  },
  {
    title: '历史留痕',
    description: '报告保留对应日期和规则版本，避免后来规则改写当时结论。',
  },
  {
    title: '非付费排名',
    description: '广告、优惠和商业合作不会直接改变 GateRank 公开排名。',
  },
] as const;

export const methodologyFaq = [
  {
    question: '低价机场一定高分吗？',
    answer: '不会。价格只是评价价值的一部分，稳定性、性能、网络覆盖和风险表现同样会影响最终判断。',
  },
  {
    question: '测速快就一定推荐吗？',
    answer: '不会。单次测速只能说明一个时间点的表现，GateRank 更关注真实请求、持续稳定性、多地区表现和风险变化。',
  },
  {
    question: '为什么新机场可能需要更长时间观察？',
    answer: '新机场的有效样本和历史连续性较少。GateRank 会明确展示数据状态，并在积累足够证据前保持更谨慎的结论。',
  },
  {
    question: '风险分低代表已经跑路了吗？',
    answer: '不一定。它表示域名、证书、投诉或历史异常等信号值得关注，需要结合当前状态、报告日期和后续趋势判断。',
  },
  {
    question: 'GateRank 的机场推荐依据是什么？',
    answer: '推荐依据来自稳定性、性能、网络覆盖、性价比和风险五个维度，以及对应的数据日期、趋势和完整性状态。广告活动不进入公开排名。',
  },
  {
    question: '数据多久更新一次？',
    answer: '监测任务持续运行，公开榜单和报告会根据已完成的数据批次更新。页面会显示对应日期，避免把历史结果误认为实时结论。',
  },
] as const;

export const methodologyStructuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: methodologySeo.title,
    description: methodologySeo.description,
    about: ['机场测评方法', '五维评估框架', '数据来源', '风险监测', '历史报告', '机场推荐依据'],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '今日推荐',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '测评方法',
      },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: methodologyFaq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  },
] as const;
