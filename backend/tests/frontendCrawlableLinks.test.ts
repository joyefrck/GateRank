import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('Admin homepage settings label the legacy today-pick key as ranking count', async () => {
  const adminSource = await readFile(path.join(process.cwd(), 'src/admin/AdminApp.tsx'), 'utf8');

  assert.match(adminSource, /\{ key: 'today_pick', label: '排行榜数量' \}/);
});

test('Admin and applicant interfaces expose all shared homepage ad slots', async () => {
  const [adminSource, appSource] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/admin/AdminApp.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8'),
  ]);
  const marketingSettingsStart = adminSource.indexOf('function MarketingSettingsPage');
  const marketingSettingsEnd = adminSource.indexOf('function MarketingSettingsSection', marketingSettingsStart);
  const marketingSettingsSource = adminSource.slice(marketingSettingsStart, marketingSettingsEnd);
  const adModalStart = appSource.indexOf('function PortalAdCampaignModal');
  const adModalEnd = appSource.indexOf('function TrendPanel', adModalStart);
  const adModalSource = appSource.slice(adModalStart, adModalEnd);
  const submitStart = appSource.indexOf('const submitAdCampaign = async');
  const submitEnd = appSource.indexOf('const cancelAdCampaign = async', submitStart);
  const submitSource = appSource.slice(submitStart, submitEnd);

  assert.notEqual(marketingSettingsStart, -1);
  assert.notEqual(marketingSettingsEnd, -1);
  assert.notEqual(adModalStart, -1);
  assert.notEqual(adModalEnd, -1);
  assert.notEqual(submitStart, -1);
  assert.notEqual(submitEnd, -1);
  assert.match(adminSource, /type MarketingHomeAdSlot = `\$\{AirportHomeAdSlot\}`;/);
  assert.match(adminSource, /const marketingHomeAdSlots = AIRPORT_HOME_AD_SLOTS\.map\(String\) as MarketingHomeAdSlot\[\];/);
  assert.match(
    adminSource,
    /const defaultHomeAdSlotMonthlyPriceForm = Object\.fromEntries\(\s*marketingHomeAdSlots\.map\(\(slot\) => \[slot, '1000'\]\),\s*\) as Record<MarketingHomeAdSlot, string>;/,
  );
  assert.match(marketingSettingsSource, /const homeAdSlotMonthlyPrices = Object\.fromEntries\(\s*marketingHomeAdSlots\.map\(\(slot\) => \[\s*slot,\s*Number\(view\.home_ad_slot_monthly_prices\?\.\[slot\] \|\| airportAdMonthlyPrice\),/);
  assert.match(marketingSettingsSource, /home_ad_slot_monthly_prices: Object\.fromEntries\(\s*marketingHomeAdSlots\.map\(\(slot\) => \[\s*slot,\s*Number\(form\.home_ad_slot_monthly_prices\[slot\]\),/);
  assert.match(marketingSettingsSource, /首页 1–5：/);
  assert.match(marketingSettingsSource, /grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5/);

  assert.match(adModalSource, /grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5/);
  assert.match(adModalSource, /AIRPORT_HOME_AD_SLOTS\.map\(\(slot\) =>/);
  assert.match(adModalSource, /const available = adStatus\.home_slot_availability\?\.\[slot\] \?\? true;/);
  assert.match(adModalSource, /const price = adStatus\.home_slot_monthly_prices\?\.\[slot\]/);
  assert.match(adModalSource, /disabled=\{!available\}/);
  assert.match(adModalSource, /form\.home_slot === slot/);
  assert.match(adModalSource, /onClick=\{\(\) => onFormChange\(\(current\) => \(\{ \.\.\.current, home_slot: slot \}\)\)\}/);
  assert.match(submitSource, /请选择首页 1–5 号位/);
});

test('React streaming check only starts from the button and probes six services once per run', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/streamingCheck/StreamingCheckPage.tsx'), 'utf8');
  assert.match(source, /onClick=\{\(\) => \{ void runCheck\(\); \}\}/);
  assert.match(source, /const apiTask = requestStreamingCheck\(\)/);
  assert.match(source, /const probeTasks = STREAMING_SERVICES\.map/);
  assert.match(source, /const image = new Image\(\)/);
  assert.match(source, /image\.referrerPolicy = 'no-referrer'/);
  assert.match(source, /probeUrl\.searchParams\.set\('_gr_probe'/);
  assert.match(source, /window\.setTimeout\(\(\) => finish\('timeout'\), 8000\)/);
  assert.doesNotMatch(source, /mode: 'no-cors'/);
  assert.match(source, /NETFLIX_MANUAL_TESTS\.map/);
  assert.match(source, /rel="nofollow noreferrer noopener"/);
  assert.doesNotMatch(source, /useEffect\([\s\S]{0,200}runCheck/);
});

test('React full ranking report action remains a crawlable anchor', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const panelStart = source.indexOf('操作入口');
  assert.notEqual(panelStart, -1);
  const panelEnd = source.indexOf('</MarketingImpressionWrapper>', panelStart);
  assert.notEqual(panelEnd, -1);
  const fullRankingActionPanel = source.slice(panelStart, panelEnd);

  assert.match(fullRankingActionPanel, /href=\{item\.report_url\}/);
  assert.match(fullRankingActionPanel, /data-event="ranking_report_click"/);
  assert.doesNotMatch(fullRankingActionPanel, /navigate\(item\.report_url\)/);
});

test('React full ranking filter chips remain crawlable anchors with static SEO hrefs', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  const groupStart = source.indexOf('function FullRankingFilterGroup');
  assert.notEqual(groupStart, -1);
  const groupEnd = source.indexOf('function FullRankingCapabilitySummary', groupStart);
  assert.notEqual(groupEnd, -1);
  const groupSource = source.slice(groupStart, groupEnd);

  assert.match(groupSource, /<a/);
  assert.match(groupSource, /href=\{buildFullRankingHref\(undefined, 1, toggleFullRankingFilterValue\(filters, category, option\.key\)\)\}/);
  assert.match(groupSource, /full-ranking-filter-chip/);
  assert.match(groupSource, /is-active border-neutral-900 bg-neutral-900 text-white/);
  assert.doesNotMatch(groupSource, /<button/);
});

test('React full ranking selected chips force readable active text color', async () => {
  const appSource = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const cssSource = await readFile(path.join(process.cwd(), 'src/index.css'), 'utf8');

  const panelStart = appSource.indexOf('function FullRankingFilterPanel');
  assert.notEqual(panelStart, -1);
  const panelEnd = appSource.indexOf('function FullRankingFilterGroup', panelStart);
  assert.notEqual(panelEnd, -1);
  const panelSource = appSource.slice(panelStart, panelEnd);

  assert.match(panelSource, /full-ranking-filter-chip is-active/);
  assert.match(panelSource, /full-ranking-filter-chip inline-flex/);
  assert.match(panelSource, /is-active border-neutral-900 bg-neutral-900 text-white/);
  assert.match(cssSource, /\.full-ranking-filter-chip\.is-active\s*\{/);
  assert.match(cssSource, /color:\s*#ffffff;/);
  assert.match(cssSource, /-webkit-text-fill-color:\s*#ffffff;/);
});

test('React report page keeps outbound CTA and comparison links as anchors', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  const heroStart = source.indexOf('function ReportHeroV2');
  assert.notEqual(heroStart, -1);
  const heroEnd = source.indexOf('function ReportContentNarrative', heroStart);
  assert.notEqual(heroEnd, -1);
  const heroSource = source.slice(heroStart, heroEnd);
  assert.match(heroSource, /href=\{buildOutboundAirportHref\(data\.airport\.id, 'website', 'report_header'\)\}/);
  assert.match(heroSource, /target="_blank"/);
  assert.match(heroSource, /createTrackedOutboundClickHandler/);
  assert.match(heroSource, /href=\{buildAirportDealDetailHref\(data\.airport\.slug\)\}/);
  assert.match(heroSource, /查看该机场优惠信息/);

  const comparisonStart = source.indexOf('function ReportComparisonLinks');
  assert.notEqual(comparisonStart, -1);
  const comparisonEnd = source.indexOf('function ReportScoreCard', comparisonStart);
  assert.notEqual(comparisonEnd, -1);
  const comparisonSource = source.slice(comparisonStart, comparisonEnd);
  assert.match(comparisonSource, /<a/);
  assert.match(comparisonSource, /href=\{link\.href\}/);
  assert.doesNotMatch(comparisonSource, /navigate\(link\.href\)/);
});

test('React deals page uses the shared orange list hero', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/deals/DealsPage.tsx'), 'utf8');

  assert.match(source, /<ListPageHero/);
  assert.match(source, /tone="orange"/);
  assert.match(source, /label: '当前活动'/);
  assert.match(source, /label: '当前活动', value: `\$\{deals\.length\}`/);
  assert.doesNotMatch(source, /deals\.length\}\/6/);
  assert.match(source, /label: '免费试用'/);
  assert.match(source, /label: '支持 USDT'/);
  assert.match(source, /pt-10 md:pt-14/);
  assert.doesNotMatch(source, /function HeroMetric/);
});

test('React airport deal detail route preserves one slug page and SSR takeover', async () => {
  const appSource = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const detailSource = await readFile(path.join(process.cwd(), 'src/pages/deals/DealDetailPage.tsx'), 'utf8');
  const cardSource = await readFile(path.join(process.cwd(), 'src/pages/deals/DealCard.tsx'), 'utf8');
  const dealsSource = await readFile(path.join(process.cwd(), 'src/pages/deals/DealsPage.tsx'), 'utf8');

  const detailMatchIndex = appSource.indexOf('const dealDetailMatch');
  const listMatchIndex = appSource.indexOf('const dealsMatch');
  assert.ok(detailMatchIndex >= 0 && detailMatchIndex < listMatchIndex);
  assert.match(appSource, /kind: 'deal_detail'/);
  assert.match(appSource, /<DealDetailPage slug=\{route\.airportSlug \|\| ''\}/);
  assert.match(detailSource, /readDealDetailInitialData\(slug\)/);
  assert.match(detailSource, /data\.active_deals\.map/);
  assert.match(detailSource, /当前暂无有效优惠码/);
  assert.match(detailSource, /RiskNotice/);
  assert.match(dealsSource, /detailHref=\{buildAirportDealDetailHref\(deal\.airport_slug\)\}/);
  assert.match(cardSource, /sponsored nofollow noreferrer noopener/);
  assert.doesNotMatch(cardSource, /\/deals\/\$\{deal\.campaign_id\}/);
});

test('Portal activity title helper only appears for homepage ads', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const modalStart = source.indexOf('function PortalAdCampaignModal');
  const modalEnd = source.indexOf('function TrendPanel', modalStart);
  assert.notEqual(modalStart, -1);
  assert.notEqual(modalEnd, -1);
  const modalSource = source.slice(modalStart, modalEnd);
  const titleFieldStart = modalSource.indexOf('label="活动标题"');
  const titleFieldEnd = modalSource.indexOf('</PortalAdField>', titleFieldStart);
  assert.notEqual(titleFieldStart, -1);
  assert.notEqual(titleFieldEnd, -1);
  const titleFieldSource = modalSource.slice(titleFieldStart, titleFieldEnd);

  assert.match(
    titleFieldSource,
    /labelSuffix=\{form\.is_homepage \? \([\s\S]*?显示在首页广告描述中。<\/span>[\s\S]*?\) : null\}/,
  );
  assert.ok(titleFieldSource.indexOf('显示在首页广告描述中。') < titleFieldSource.indexOf('<input'));
});

test('React methodology page uses the shared sky list hero', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/methodology/MethodologyPage.tsx'), 'utf8');

  assert.match(source, /<ListPageHero/);
  assert.match(source, /tone="sky"/);
  assert.match(source, /label: item\.label/);
  assert.match(source, /value: item\.value/);
  assert.match(source, /pt-10 md:pt-14/);
});

test('React homepage renders the 3.0 trust and FAQ content without a duplicated trust navigation', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/home/HomePageV3.tsx'), 'utf8');

  assert.match(source, /<h1 className="[^"]*sm:whitespace-nowrap[^"]*">/);
  assert.match(source, />商业合作专区<\/h2>/);
  assert.match(source, />🏆 GateRank 排行榜<\/h2>/);
  assert.match(source, /公告与动态<\/h2>/);
  assert.match(source, /HOME_FAQ_ITEMS/);
  assert.match(source, /function TrustSection/);
  assert.match(source, /function FaqSection/);
  assert.doesNotMatch(source, /aria-label="首页深度内容入口"/);
  assert.doesNotMatch(source, /buildMethodologyHref/);
  assert.doesNotMatch(source, /buildRiskMonitorHref/);
});

test('React homepage keeps compact feature tags on the shared system color palette', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/home/HomePageV3.tsx'), 'utf8');

  assert.match(source, /import \{ getTagBadgeTone \} from '\.\.\/\.\.\/components\/TagBadge';/);
  assert.match(source, /const tone = getTagBadgeTone\(tag\);/);
  assert.match(source, /\$\{tone\.className\}/);
  assert.doesNotMatch(source, /const normalized = tag\.toLowerCase\(\);/);
  assert.match(source, /rounded px-2 py-0\.5 text-\[10px\]/);
});

test('React homepage exposes desktop table, mobile cards, empty states, hidden scores, and sponsored links', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/home/HomePageV3.tsx'), 'utf8');
  const sponsoredCardSource = source.slice(
    source.indexOf('function SponsoredDealCard'),
    source.indexOf('function SponsoredEmptySlot'),
  );
  const rankingTableRowSource = source.slice(
    source.indexOf('function RankingTableRow'),
    source.indexOf('function RankingMobileCard'),
  );
  const summaryBoardItemSource = source.slice(
    source.indexOf('function SummaryBoardItem'),
    source.indexOf('function SummaryRank'),
  );
  const summaryBoardsSource = source.slice(
    source.indexOf('function SummaryBoards'),
    source.indexOf('function TrustSection'),
  );
  const verticallyCenteredRankingCells = rankingTableRowSource.match(/<td className="align-middle px-4 py-4(?: text-center)?">/g) || [];

  assert.match(source, /<table className="w-full border-collapse text-left">/);
  assert.match(source, /排名每日更新，基于真实数据和客观多节点测速得出<\/p>/);
  assert.doesNotMatch(source, /共收录 \{total\} 个机场/);
  assert.match(source, /hover:scale-\[1\.02\].*hover:bg-stone-800.*active:scale-\[0\.98\].*focus-visible:ring-2/);
  assert.match(source, /data-testid="home-ranking-mobile"/);
  assert.match(source, /function RankingTableRow/);
  assert.match(source, /function RankingMobileCard/);
  assert.equal(verticallyCenteredRankingCells.length, 4);
  assert.match(rankingTableRowSource, /<td className="align-middle px-4 py-4 text-center"><RankBadge/);
  assert.match(source, /observationDays\(item\.created_at, date, false\)/);
  assert.match(source, /observationDays\(item\.created_at, date, true\)/);
  assert.doesNotMatch(source, /observationDays\(item\.founded_on/);
  assert.match(source, /if \(hidden \|\| value === null\) return '未公开'/);
  assert.match(source, /当前暂无有效广告/);
  assert.match(source, /综合榜暂无数据/);
  assert.match(source, /暂无已发布 News/);
  assert.match(source, /rel="nofollow sponsored noopener noreferrer"/);
  assert.match(source, /placement: 'deal_card'/);
  assert.match(source, /const websiteHref = normalizeExternalHref\(deal\.website\)/);
  assert.match(source, /href=\{websiteHref\}/);
  assert.match(source, /targetUrl: websiteHref/);
  assert.match(rankingTableRowSource, /const websiteHref = buildHomepageWebsiteHref\(item\.airport_id\)/);
  assert.match(rankingTableRowSource, /href=\{websiteHref\}/);
  assert.match(rankingTableRowSource, /createTrackedOutboundClickHandler\(\{[\s\S]*pageKind: 'home',[\s\S]*placement: 'home_card',[\s\S]*targetUrl: item\.website/);
  assert.match(rankingTableRowSource, /dedupeKey: `home\|ranking\|\$\{item\.airport_id\}`/);
  assert.match(rankingTableRowSource, /<motion\.tr[\s\S]*ref=\{ref\}/);
  assert.doesNotMatch(rankingTableRowSource, /href=\{item\.website\}/);
  assert.match(summaryBoardsSource, /<SummaryBoardItem/);
  assert.match(summaryBoardsSource, /sectionKey=\{config\.key\}/);
  assert.match(summaryBoardItemSource, /useMarketingImpression\(\{/);
  assert.match(summaryBoardItemSource, /dedupeKey: `home\|summary\|\$\{sectionKey\}\|\$\{item\.airport_id\}`/);
  assert.match(summaryBoardItemSource, /<li ref=\{ref\}>/);
  assert.match(source, /\{deal\.tracking_days\} 天观察<\/span>/);
  assert.match(source, /\{deal\.discount_title \|\| '查看官网了解当前优惠活动。'\}/);
  assert.doesNotMatch(source, /deal\.discount_description \|\| deal\.discount_title/);
  assert.doesNotMatch(source, /天观察 · \{scoreLabel\(deal\.score, deal\.score_hidden\)\} 分/);
  assert.doesNotMatch(sponsoredCardSource, /AD 广告/);
  assert.doesNotMatch(sponsoredCardSource, /scoreLabel\(deal\.score, deal\.score_hidden\)/);
  assert.doesNotMatch(sponsoredCardSource, /<Star className=/);
  assert.doesNotMatch(source, /该位置空缺，不会由普通优惠活动补位/);
});

test('React homepage uses shared five-slot commercial cards and plain summary scores', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/home/HomePageV3.tsx'), 'utf8');
  const sponsoredDealsStart = source.indexOf('function SponsoredDeals');
  const sponsoredDealCardStart = source.indexOf('function SponsoredDealCard');
  const sponsoredEmptySlotStart = source.indexOf('function SponsoredEmptySlot');
  const rankingPreviewStart = source.indexOf('function RankingPreview');
  const summaryBoardItemStart = source.indexOf('function SummaryBoardItem');
  const summaryRankStart = source.indexOf('function SummaryRank');

  assert.notEqual(sponsoredDealsStart, -1);
  assert.notEqual(sponsoredDealCardStart, -1);
  assert.notEqual(sponsoredEmptySlotStart, -1);
  assert.notEqual(rankingPreviewStart, -1);
  assert.notEqual(summaryBoardItemStart, -1);
  assert.notEqual(summaryRankStart, -1);

  const sponsoredDealsSource = source.slice(sponsoredDealsStart, sponsoredDealCardStart);
  const sponsoredDealCardSource = source.slice(sponsoredDealCardStart, sponsoredEmptySlotStart);
  const sponsoredEmptySlotSource = source.slice(sponsoredEmptySlotStart, rankingPreviewStart);
  const summaryBoardItemSource = source.slice(summaryBoardItemStart, summaryRankStart);

  assert.match(source, /import \{ AIRPORT_HOME_AD_SLOTS, type AirportHomeAdSlot \} from '\.\.\/\.\.\/\.\.\/shared\/airportAds';/);
  assert.match(source, /home_slot: AirportHomeAdSlot;/);
  assert.match(sponsoredDealsSource, /AIRPORT_HOME_AD_SLOTS\.map\(\(slot\) =>/);
  assert.doesNotMatch(sponsoredDealsSource, /Array\.from\(\{ length: 4 \}\)/);
  assert.match(sponsoredDealsSource, /grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5/);
  assert.match(sponsoredDealCardSource, /p-4/);
  assert.match(sponsoredEmptySlotSource, /p-4/);
  assert.match(sponsoredDealCardSource, /flex flex-col gap-1\.5/);
  assert.match(sponsoredDealCardSource, /<RouteLink href=\{deal\.report_url\} className="flex w-full/);
  assert.match(sponsoredDealCardSource, /className="flex w-full items-center justify-center[^"]*"\s*>\s*官网/);
  assert.ok(sponsoredDealCardSource.indexOf('<RouteLink href={deal.report_url}') < sponsoredDealCardSource.indexOf('<a\n            href={websiteHref}'));

  assert.match(summaryBoardItemSource, /bg-rose-600[^>]*>风险<\/span>/);
  assert.doesNotMatch(summaryBoardItemSource, /<Star/);
  assert.doesNotMatch(summaryBoardItemSource, /amber-/);
  assert.match(summaryBoardItemSource, /ml-auto shrink-0 text-right font-mono/);
});

test('React homepage omits summary more links and the announcement schedule note', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/home/HomePageV3.tsx'), 'utf8');
  const sidebarStart = source.indexOf('function HomeSidebar');
  const summaryStart = source.indexOf('function SummaryBoards', sidebarStart);
  const summaryEnd = source.indexOf('function SummaryRank', summaryStart);

  assert.notEqual(sidebarStart, -1);
  assert.notEqual(summaryStart, -1);
  assert.notEqual(summaryEnd, -1);

  const sidebarSource = source.slice(sidebarStart, summaryStart);
  const summarySource = source.slice(summaryStart, summaryEnd);

  assert.doesNotMatch(sidebarSource, /测速物理中转每日清晨 6 点重算评分/);
  assert.match(sidebarSource, /href="\/news"[^>]*>更多 <ChevronRight/);
  assert.match(summarySource, /const items = sections\[config\.key\]\?\.items \|\| \[\];/);
  assert.doesNotMatch(summarySource, /slice\(0,\s*4\)/);
  assert.doesNotMatch(summarySource, /查看更多\$\{config\.title\}/);
  assert.doesNotMatch(summarySource, /href=\{config\.href\}/);
});

test('React homepage sidebar keeps the 3.0 tool icon tones and News row rhythm', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/home/HomePageV3.tsx'), 'utf8');

  assert.match(source, /'text-blue-500'/);
  assert.match(source, /'text-purple-500'/);
  assert.match(source, /'text-emerald-500'/);
  assert.match(source, /'text-amber-500'/);
  assert.match(source, /border-gray-800 p-2\.5/);
  assert.match(source, /<ol className="space-y-1\.5 divide-y divide-gray-50">/);
  assert.match(source, /className="group py-2\.5 first:pt-0 last:pb-0"/);
});

test('React homepage keeps the 3.0 Hero grid and fixed floating navigation interactions', async () => {
  const homeSource = await readFile(path.join(process.cwd(), 'src/pages/home/HomePageV3.tsx'), 'utf8');
  const navSource = await readFile(path.join(process.cwd(), 'shared/publicTopNav.ts'), 'utf8');
  const shellSource = await readFile(path.join(process.cwd(), 'src/site/publicSite.tsx'), 'utf8');

  assert.match(homeSource, /backgroundImage: 'linear-gradient\(to right, rgba\(0, 0, 0, 0\.03\) 1px, transparent 1px\), linear-gradient\(to bottom/);
  assert.match(homeSource, /backgroundSize: '30px 30px'/);
  assert.match(shellSource, /className="public-top-nav-root"/);
  assert.match(navSource, /\.public-top-nav-root\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*z-index:\s*40;/);
  assert.match(navSource, /\.public-top-nav-login:hover\s*\{[^}]*background:\s*rgb\(243,244,246\);[^}]*transform:\s*scale\(1\.02\);/);
  assert.match(navSource, /\.public-top-nav-apply:hover\s*\{[^}]*background:\s*rgb\(38,38,38\);[^}]*transform:\s*translateY\(-0\.5px\) scale\(1\.02\);/);
});

test('shared public navigation includes a focus-restoring mobile drawer and canonical routes', async () => {
  const navSource = await readFile(path.join(process.cwd(), 'shared/publicTopNav.ts'), 'utf8');
  const shellSource = await readFile(path.join(process.cwd(), 'src/site/publicSite.tsx'), 'utf8');
  const configSource = await readFile(path.join(process.cwd(), 'shared/publicNavigation.ts'), 'utf8');

  assert.match(navSource, /data-public-mobile-drawer="true"/);
  assert.match(navSource, /<summary aria-label="打开主导航"/);
  assert.match(navSource, /PUBLIC_NAVIGATION_ITEMS\.map/);
  assert.match(navSource, /@media \(min-width: 1240px\)/);
  assert.match(navSource, /@media \(min-width: 1024px\)\s*\{[^}]*padding-left:\s*32px;[^}]*padding-right:\s*32px;/);
  assert.doesNotMatch(navSource, /item\.kind !== 'monthly_reports'/);
  assert.doesNotMatch(navSource, /item\.kind !== 'tools'/);
  assert.match(shellSource, /event\.key !== 'Escape'/);
  assert.match(shellSource, /summary\.focus\(\)/);
  assert.match(shellSource, /const footerNavigation = PUBLIC_NAVIGATION_ITEMS\.filter\(\(item\) => item\.href\);/);
  assert.match(configSource, /kind: 'methodology'/);
  assert.match(configSource, /href: '\/methodology'/);
  assert.match(configSource, /kind: 'monthly_reports'/);
  assert.match(configSource, /kind: 'tools'/);
});

test('shared public shell normalizes bare external domains and keeps the 3.0 footer grid', async () => {
  const shellSource = await readFile(path.join(process.cwd(), 'src/site/publicSite.tsx'), 'utf8');
  const pageFrameStart = shellSource.indexOf('export function PageFrame');
  const pageFrameEnd = shellSource.indexOf('function PublicTopNav', pageFrameStart);
  assert.notEqual(pageFrameStart, -1);
  assert.notEqual(pageFrameEnd, -1);
  const pageFrameSource = shellSource.slice(pageFrameStart, pageFrameEnd);

  assert.match(shellSource, /export function normalizeExternalHref/);
  assert.match(shellSource, /return `https:\/\/\$\{trimmed\}`/);
  assert.match(shellSource, /linear-gradient\(to right, rgba\(0, 0, 0, 0\.03\) 1px, transparent 1px\)/);
  assert.match(shellSource, /backgroundSize: '30px 30px'/);
  assert.match(pageFrameSource, /className="min-h-screen bg-\[#fafafa\]/);
  assert.doesNotMatch(pageFrameSource, /backgroundSize: '40px 40px'/);
});

test('React monthly report rows expose the view action as a crawlable anchor', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/monthlyReports/MonthlyReportsPage.tsx'), 'utf8');

  const rowStart = source.indexOf('function MonthlyReportRow');
  assert.notEqual(rowStart, -1);
  const rowEnd = source.indexOf('function HeroMetric', rowStart);
  assert.notEqual(rowEnd, -1);
  const rowSource = source.slice(rowStart, rowEnd);

  assert.match(rowSource, /<a[^>]+href=\{href\}[^>]*>/);
  assert.match(rowSource, /navigate\(href\)/);
  assert.doesNotMatch(rowSource, /<button/);
});

test('React SEO hook reuses the server-rendered JSON-LD script when present', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/site/publicSite.tsx'), 'utf8');

  const hookStart = source.indexOf('export function usePageSeo');
  assert.notEqual(hookStart, -1);
  const hookEnd = source.indexOf('function toAbsoluteImageUrl', hookStart);
  assert.notEqual(hookEnd, -1);
  const hookSource = source.slice(hookStart, hookEnd);

  assert.match(hookSource, /document\.head\.querySelector\('script\[type="application\/ld\+json"\]'\)/);
  assert.match(hookSource, /script\.id = scriptId/);
});
