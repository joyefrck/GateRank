import { getDateInTimezone } from '../utils/time';
import type { RecomputeService } from '../services/recomputeService';
import type { AggregationService } from '../services/aggregationService';

export class DailyRecomputeJob {
  private timer: NodeJS.Timeout | null = null;
  private lastRunDate = '';

  constructor(
    private readonly recomputeService: RecomputeService,
    private readonly aggregationService: AggregationService,
  ) {}

  start(): void {
    const intervalMs = Number(process.env.RECOMPUTE_POLL_MS || 5 * 60 * 1000);
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);

    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    const now = new Date();
    const date = getDateInTimezone();
    const hourMinute = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    if (hourMinute < '00:10' || this.lastRunDate === date) {
      return;
    }

    try {
      await this.aggregationService.aggregateForDate(date);
      await this.recomputeService.recomputeForDate(date);
      this.lastRunDate = date;
      console.log(`[job] daily recompute finished for ${date}`);
    } catch (error) {
      console.error('[job] recompute failed', error);
    }
  }
}
