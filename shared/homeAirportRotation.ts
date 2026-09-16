export interface HomeAirportRotationInfo {
  interval_minutes: number;
  round: number;
  started_at: string;
  next_rotation_at: string;
}

export const HOME_SUMMARY_COPY = {
  most_stable: { title: '长期稳定机场', subtitle: '稳定达标 · 公平轮换' },
  best_value: { title: '性价比推荐', subtitle: '稳定实惠 · 公平轮换' },
} as const;

export function nextHomeRotationAt(rotations: Array<HomeAirportRotationInfo | undefined>): number | null {
  const times = rotations.map(rotation => Date.parse(rotation?.next_rotation_at || '')).filter(Number.isFinite);
  return times.length ? Math.min(...times) : null;
}

export function homeAirportRotationDescription(minutes = 120): string {
  const interval = minutes % 60 === 0 ? `${minutes / 60} 小时` : `${minutes} 分钟`;
  return `每 ${interval} 轮换展示，每轮各机场依次获得首位；评分供参考，综合排名请查看机场排行。`;
}
