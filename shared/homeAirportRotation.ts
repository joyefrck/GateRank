export interface HomeAirportRotationInfo {
  interval_minutes: number;
  round: number;
  started_at: string;
  next_rotation_at: string;
}

export function homeAirportRotationDescription(minutes = 120): string {
  const interval = minutes % 60 === 0 ? `${minutes / 60} 小时` : `${minutes} 分钟`;
  return `每 ${interval} 轮换展示，每轮各机场依次获得首位；评分供参考，综合排名请查看机场排行。`;
}
