const INFORMATIONAL_NODE_PATTERN = /(官网|网站|剩余|流量|套餐到期|到期|公告|通知|倍率|客服|群组|更新订阅|使用说明|节点不通|刷新|重导订阅|订阅|traffic|expire|official|website)/i;

export function isInformationalNodeName(name: string): boolean {
  return INFORMATIONAL_NODE_PATTERN.test(String(name || ''));
}
