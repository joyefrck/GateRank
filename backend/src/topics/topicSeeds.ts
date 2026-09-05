import { EMPTY_SEO_TOPIC, type SeoTopicInput } from "../../../shared/seoTopics";
import type { FullRankingItem } from "../types/domain";
import type { TopicService } from "./topicService";

export const TOPIC_SEEDS: Array<{ key: string; input: SeoTopicInput }> = [
  {
    key: "clash",
    input: {
      ...EMPTY_SEO_TOPIC,
      name: "Clash 机场推荐",
      h1: "Clash 机场推荐 2026",
      path: "/rankings/clash-airports",
      seo_title:
        "Clash 机场推荐 2026：支持 Clash Verge / Mihomo 的机场排行 | GateRank",
      summary:
        "面向 Clash 及相关客户端用户，结合已收录的兼容信息选择订阅，并通过测评报告检查价格、节点表现与风险记录。",
      seo_description:
        "查看 Clash 机场推荐与选购指南，了解 Clash Verge、Mihomo 配置和订阅导入的核对方法，结合 GateRank 公开测评选择适合自己的服务。",
      seo_keywords: "Clash 机场推荐,Clash Verge,Mihomo,机场订阅",
      sort_order: 10,
      content_markdown: `## 先确认客户端与订阅格式

Clash 是一组常见配置与客户端生态的称呼。Clash Verge、使用 Mihomo 内核的客户端以及路由器端工具，在配置字段、内核版本和导入方式上可能存在差异。机场标记“支持 Clash”，并不等于每个客户端版本都已经验证可用。

订阅前应向服务商确认当前客户端名称、内核版本、支持的协议和推荐导入方式。本页推荐理由仅描述已收录的信息，不把通用兼容标签扩展成未经验证的版本承诺。

## 怎样比较机场

| 核对项目 | 建议做法 |
| --- | --- |
| 兼容信息 | 在机场测评页查看客户端及导入支持，再核对服务商文档 |
| 网络表现 | 比较常用地区的近期测速和延迟，避免只看一次峰值 |
| 套餐限制 | 确认流量、设备数、倍率及是否允许路由器使用 |
| 风险记录 | 阅读风险提示和历史变化，优先短周期试用 |

## 导入和使用前的检查

使用客户端内置的订阅导入入口。订阅链接通常包含个人访问凭据，不应发到公开论坛或交给不可信的在线转换网站。导入后检查节点数量、规则模式和更新状态，再用实际常用网站验证连接。

配置更新失败不一定意味着机场离线，也可能来自订阅过期、客户端版本或配置字段差异。保留错误信息，但分享时移除订阅地址中的凭据。

## 常见问题

### 标注支持 Clash，就能直接用于 Mihomo 吗？

不能仅凭标签保证。请检查协议、配置格式和内核版本；以服务商说明和实际导入结果为准。

### 为什么不按客户端数量排序？

支持更多客户端并不等于更适合你的网络。推荐列表采用编辑顺序，公开评分、价格和能力信息用于辅助判断。

### 下一步看什么？

可继续查看[完整机场排行](/rankings/all)、[测评方法](/methodology)和[跑路监测](/risk-monitor)，再决定是否短期订阅。`,
    },
  },
  {
    key: "shadowrocket",
    input: {
      ...EMPTY_SEO_TOPIC,
      name: "Shadowrocket 机场推荐",
      h1: "Shadowrocket 机场推荐 2026",
      path: "/rankings/shadowrocket-airports",
      seo_title:
        "Shadowrocket 机场推荐 2026：iPhone 小火箭机场订阅排行 | GateRank",
      summary:
        "为使用 iPhone 小火箭的用户整理机场选择与订阅检查方法，区分客户端购买、机场套餐和实际网络表现。",
      seo_description:
        "Shadowrocket 小火箭机场推荐专题：核对 iPhone 客户端兼容、订阅导入、套餐流量与风险信息，结合 GateRank 测评选择机场。",
      seo_keywords: "Shadowrocket 机场推荐,iPhone 小火箭,机场订阅",
      sort_order: 20,
      content_markdown: `## 客户端和机场订阅是两件事

Shadowrocket 是客户端，机场提供节点及网络服务。拥有客户端不代表已经购买机场套餐；购买机场套餐也不代表包含客户端授权。付款前分别确认客户端来源和机场套餐的费用。

本页优先整理已收录 Shadowrocket 支持信息的机场。列表中的兼容信息不能替代对当前 iOS 与客户端版本的实际验证。

## iPhone 用户重点看什么

- **导入方式**：确认是否提供适合 Shadowrocket 的订阅或官方导入说明。
- **日常网络**：分别在 Wi-Fi 和移动网络下测试，两个环境的表现可能不同。
- **流量与倍率**：视频和大文件会明显增加流量消耗，注意特殊节点是否有倍率。
- **连接恢复**：测试锁屏、网络切换和重新打开应用后的连接情况。

## 从短期套餐开始验证

先选择可承受的短周期套餐，导入订阅后检查节点、到期时间与剩余流量。用自己常用的网站或应用验证，而不是只看节点延迟数字。发生异常时，先检查套餐状态和订阅更新，再核对规则配置。

不要公开分享订阅二维码或完整地址。它们可能允许他人访问你的订阅和消耗流量。

## 常见问题

### 小火箭能自动解决所有连接问题吗？

不能。客户端、规则配置、机场节点和本地网络都会影响体验，需要逐项检查。

### 为什么同一个机场在移动网络和 Wi-Fi 表现不同？

接入运营商、网络路径及当时负载可能不同。应在自己的实际使用环境下测试。

### 能否只看评分购买？

评分是参考，还应阅读[测评方法](/methodology)、机场报告中的能力信息和[风险记录](/risk-monitor)，并核对套餐条款。`,
    },
  },
  {
    key: "chatgpt",
    input: {
      ...EMPTY_SEO_TOPIC,
      name: "ChatGPT 机场推荐",
      h1: "ChatGPT 机场推荐 2026",
      path: "/rankings/chatgpt-airports",
      seo_title: "ChatGPT 机场推荐 2026：AI 解锁稳定机场排行 | GateRank",
      summary:
        "围绕 ChatGPT 使用场景，结合已收录的支持信息与近期测评，检查连接稳定性、节点地区和服务使用条件。",
      seo_description:
        "ChatGPT 机场推荐与 AI 使用场景指南：查看已收录的支持信息，理解解锁标签、实际连接体验和账号服务条件的区别。",
      seo_keywords: "ChatGPT 机场推荐,AI 解锁,机场稳定性",
      sort_order: 30,
      content_markdown: `## 理解“支持 ChatGPT”的含义

机场的 ChatGPT 支持标签反映已收录的能力信息，不保证每个节点、每个时刻或每个账号都能使用。网站可打开、账号可登录以及功能可正常运行，也不是完全相同的验证结果。

使用前应核对目标服务对账号、地区和产品功能的要求。本页不承诺绕过服务限制，也不将支持标签表述为长期可用保证。

## 选择时关注实际工作流程

如果主要用于文字对话，可以测试页面加载、登录和连续对话。如果工作依赖文件上传、语音或其他功能，应分别验证对应流程。一次成功访问不能代表长时间会话的稳定性。

| 观察项 | 检查方式 |
| --- | --- |
| 连接连续性 | 在常用时段进行多次真实对话 |
| 节点信息 | 核对出口地区与服务商的节点说明 |
| 历史表现 | 查看机场近期报告，关注变化而非单次峰值 |
| 隐私 | 不向机场客服或公开群提供账号密码、会话凭据 |

## 遇到访问异常时

先检查目标服务自身状态、账号提示和本地网络，再检查机场订阅状态。记录错误类型与发生时间，避免把所有错误都归因于节点。切换节点后仍异常时，阅读服务提供方的说明，不反复提交敏感账号信息。

## 常见问题

### AI 解锁是否意味着包含 ChatGPT 付费订阅？

不意味着。机场网络服务与 AI 产品的账户或付费套餐分别提供，需各自确认。

### 标题中的稳定机场能保证始终可用吗？

不能。稳定性需要持续观察；公开测评和支持标签只提供判断依据，实际结果还受到网络、账号与目标服务状态影响。

### 如何进一步核验？

打开推荐机场的测评页，结合[完整排行](/rankings/all)及[测评方法](/methodology)查看数据口径，并优先短周期测试。`,
    },
  },
  {
    key: "cheap",
    input: {
      ...EMPTY_SEO_TOPIC,
      name: "便宜机场推荐",
      h1: "便宜机场推荐 2026",
      path: "/rankings/cheap-airports",
      seo_title: "便宜机场推荐 2026：低价月付、性价比机场排行榜 | GateRank",
      summary:
        "以可确认的月付价格作为初选依据，同时比较流量、倍率、限制和风险，避免只看折算后的低价。",
      seo_description:
        "便宜机场推荐 2026：从真实月付价格出发比较机场套餐，核对流量、倍率、设备限制和风险记录，区分月付与年付折算价格。",
      seo_keywords: "便宜机场推荐,低价月付机场,性价比机场",
      sort_order: 40,
      content_markdown: `## 先分清月付价和折算价

“每月几元”可能是实际月付价格，也可能要求一次支付全年费用。比较时先查看付款周期和实际首笔支付金额，再核对优惠到期后的续费价格。本专题初始化优先参考可确认的月付套餐，不把年付折算金额当作月付价格。

页面价格来自已收录信息，可能与服务商当前促销不同，最终以购买页面为准。价格未知的机场不会因填入零元而被当作最低价推荐。

## 性价比需要一起比较的条件

| 条件 | 容易忽略的问题 |
| --- | --- |
| 流量额度 | 重置时间、是否结转和超额后的处理方式 |
| 节点倍率 | 相同使用量可能扣除不同额度 |
| 设备限制 | 同时在线数量是否符合家庭或多设备需求 |
| 高峰体验 | 低价不代表常用时段仍有相同速度 |
| 退款与续费 | 试用、退款及优惠续期条件是否明确 |

## 为什么建议先短期试用

长期预付会增加一次性支出，也会拉长服务风险暴露时间。先在自己的网络环境测试常用地区和应用，再决定是否延长周期。不要为了低折算价购买明显超过使用需求的套餐。

比较服务时，结合[风险监测](/risk-monitor)和具体机场报告。编辑推荐顺序可以调整，不代表价格永远从低到高，也不构成服务持续运营的保证。

## 常见问题

### 最便宜的机场一定最划算吗？

不一定。流量、倍率、节点可用性与设备限制共同决定实际成本。

### 年付更便宜，是否应该直接买一年？

应结合预算、使用经验和服务风险自行决定。年付折算更低不等于实际月付，也不减少预付风险。

### 价格与官网不一致怎么办？

以服务商结算页面为准，核对币种、周期、优惠及续费条件，并将差异反馈给 GateRank。`,
    },
  },
  {
    key: "hub",
    input: {
      ...EMPTY_SEO_TOPIC,
      name: "机场推荐",
      h1: "机场推荐 2026：按需求选择机场",
      path: "/airport-recommendations",
      template: "hub",
      seo_title: "机场推荐 2026：机场排行、选购指南与专题推荐 | GateRank",
      summary:
        "从客户端、AI 使用场景和预算出发，找到对应的专题指南，再结合公开测评、价格与风险记录选择机场。",
      seo_description:
        "GateRank 机场推荐综合指南，汇总 Clash、Shadowrocket、ChatGPT 和低价月付等专题，结合机场排行、测评方法与风险监测辅助选择。",
      seo_keywords: "机场推荐,机场推荐2026,机场排行,机场选购指南",
      sort_order: 0,
      content_markdown: `## 先明确自己的使用需求

选择机场前，先列出设备和客户端、常用网站或应用、主要使用时段、预算及预计流量。本页按需求汇总专题，每个专题包含编辑选择的机场及对应指南。列表是人工维护的推荐顺序，公开评分提供另一个判断角度。

## 按场景阅读专题

- **Clash 用户**：重点核对配置格式、内核版本和订阅导入方式。
- **iPhone 小火箭用户**：关注 Shadowrocket 支持、移动网络体验和套餐限制。
- **ChatGPT 用户**：区分支持标签与实际账号、地区及功能可用性。
- **预算敏感用户**：比较真实月付费用、流量、倍率与续费条件。

上方专题目录仅展示已经发布的内容，后续会持续补充新的场景。

## 把推荐、排行与风险信息放在一起看

推荐专题解释选择思路；[完整机场排行](/rankings/all)帮助横向比较；具体机场测评提供更详细的数据；[风险监测](/risk-monitor)用于检查异常与历史变化。可以先阅读[测评方法](/methodology)，理解评分及数据的适用范围。

## 建议的选择步骤

1. 按设备、用途和预算找到对应专题。
2. 阅读候选机场测评，核对公开能力和价格。
3. 检查套餐周期、流量倍率、设备数与退款条件。
4. 用短周期套餐在自己的网络下测试。
5. 根据实际体验决定是否续订，并持续关注变化。

## 常见问题

### 推荐名单是否等同于评分榜？

不是。专题名单按编辑推荐顺序展示，价格与评分读取当前公开数据。不同需求可能对应不同选择。

### GateRank 是否保证机场始终可用？

不保证。机场表现、价格和服务状态会变化，推荐与测评用于辅助判断，不能替代实际测试。

### 新手应该先看哪里？

先确定客户端，再看对应专题和测评方法。预算有限时优先确认真实月付成本，避免一开始就进行长期预付。`,
    },
  },
];
export async function seedTopics(
  service: TopicService,
): Promise<{ created: number; skipped: number }> {
  const existing = await service.repository.list();
  const airports = await service.airports();
  let created = 0,
    skipped = 0;
  for (const { key, input } of TOPIC_SEEDS) {
    // Includes historical aliases, so renaming an initialized page never recreates it.
    if (
      (await service.repository.hasSeed(key)) ||
      existing.some((t) => t.path === input.path) ||
      (await service.repository.resolve(input.path))
    ) {
      skipped++;
      continue;
    }
    let selected: FullRankingItem[] = [];
    if (key === "cheap")
      selected = airports
        .filter((a) => a.plan_price_month > 0)
        .sort(
          (a, b) =>
            a.plan_price_month - b.plan_price_month ||
            a.airport_id - b.airport_id,
        );
    else if (key !== "hub")
      selected = airports.filter((a) =>
        key === "chatgpt"
          ? a.capabilities?.streaming.some((c) => c.key === "chatgpt")
          : a.capabilities?.clients.some((c) =>
              key === "clash"
                ? ["clash", "clash_verge"].includes(c.key)
                : c.key === "shadowrocket",
            ),
      );
    await service.repository.save(
      {
        ...input,
        airports: selected
          .slice(0, 5)
          .map((a) => ({
            airport_id: a.airport_id,
            reason:
              key === "cheap"
                ? "已收录有效月付价格，可结合流量、倍率与近期测评比较实际成本。"
                : `已收录${key === "chatgpt" ? " ChatGPT 支持" : key === "shadowrocket" ? " Shadowrocket 支持" : " Clash 相关客户端支持"}信息，购买前请核对当前版本及实际使用环境。`,
          })),
      },
      undefined,
      key,
    );
    created++;
  }
  return { created, skipped };
}
