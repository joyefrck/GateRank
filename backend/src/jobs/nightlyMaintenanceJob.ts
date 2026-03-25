import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { SHANGHAI_TIMEZONE } from '../config/scoring';
import { getDateInTimezone } from '../utils/time';

const execFileAsync = promisify(execFile);

interface LoggerLike {
  log(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

interface NightlyMaintenanceJobDeps {
  airportRepository: {
    listAll(): Promise<Array<{ id: number; status?: string }>>;
  };
  riskCheckService: {
    inspectAirportForDate(airportId: number, date: string): Promise<{ domain_ok: boolean; ssl_days_left: number | null }>;
  };
  aggregationService: {
    aggregateForDate(date: string): Promise<{ aggregated: number }>;
  };
  recomputeService: {
    recomputeForDate(date: string): Promise<{ recomputed: number }>;
  };
  logger?: LoggerLike;
  sleep?: (ms: number) => Promise<void>;
  execFileAsync?: (
    file: string,
    args: readonly string[],
    options: {
      cwd: string;
      env: NodeJS.ProcessEnv;
      maxBuffer: number;
      timeout: number;
    },
  ) => Promise<{ stdout: string; stderr: string }>;
  now?: () => Date;
}

interface NightlyStageResult {
  stage: 'stability' | 'performance' | 'risk' | 'aggregate' | 'recompute';
  status: 'succeeded' | 'failed';
  detail: string;
}

export class NightlyMaintenanceJob {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastAttemptDate = '';
  private readonly logger: LoggerLike;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly execFileFn: NonNullable<NightlyMaintenanceJobDeps['execFileAsync']>;
  private readonly nowFn: () => Date;
  private readonly repoRoot: string;
  private readonly pythonBin: string;
  private readonly apiBase: string;
  private readonly adminApiKey: string;
  private readonly adminBearerToken: string;
  private readonly enabled: boolean;
  private readonly startAt: string;
  private readonly pollMs: number;
  private readonly stageGapMs: number;
  private readonly riskAirportGapMs: number;
  private readonly scriptTimeoutMs: number;
  private readonly airportStatus: string;
  private readonly triggerWindowMinutes: number;

  constructor(private readonly deps: NightlyMaintenanceJobDeps) {
    this.logger = deps.logger || console;
    this.sleepFn = deps.sleep || defaultSleep;
    this.execFileFn = deps.execFileAsync || execFileAsync;
    this.nowFn = deps.now || (() => new Date());
    this.repoRoot = process.cwd();
    this.pythonBin = process.env.PYTHON_BIN || 'python3';
    this.apiBase = (process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 8787}`).replace(/\/+$/, '');
    this.adminApiKey = process.env.ADMIN_API_KEY || '';
    this.adminBearerToken = process.env.ADMIN_BEARER_TOKEN || '';
    this.enabled = !isFalsey(process.env.NIGHTLY_PIPELINE_ENABLED ?? '0');
    this.startAt = normalizeClockTime(process.env.NIGHTLY_PIPELINE_START_AT || '00:00');
    this.pollMs = maxNumber(process.env.NIGHTLY_PIPELINE_POLL_MS, 60_000);
    this.stageGapMs = maxNumber(process.env.NIGHTLY_PIPELINE_STAGE_GAP_MS, 30_000);
    this.riskAirportGapMs = maxNumber(process.env.NIGHTLY_PIPELINE_RISK_AIRPORT_GAP_MS, 1_500);
    this.scriptTimeoutMs = maxNumber(process.env.NIGHTLY_PIPELINE_SCRIPT_TIMEOUT_MS, 30 * 60 * 1000);
    this.airportStatus = (process.env.NIGHTLY_PIPELINE_AIRPORT_STATUS || '').trim();
    this.triggerWindowMinutes = maxNumber(process.env.NIGHTLY_PIPELINE_TRIGGER_WINDOW_MINUTES, 30);
  }

  start(): void {
    if (!this.enabled) {
      this.logger.log('[job] nightly maintenance disabled');
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollMs);

    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(now: Date = this.nowFn()): Promise<void> {
    if (!this.enabled || this.isRunning) {
      return;
    }

    const date = getDateInTimezone(SHANGHAI_TIMEZONE, now);
    const clock = formatClockInTimezone(now, SHANGHAI_TIMEZONE);
    if (!isWithinWindow(clock, this.startAt, this.triggerWindowMinutes) || this.lastAttemptDate === date) {
      return;
    }

    this.lastAttemptDate = date;
    this.isRunning = true;
    try {
      const results = await this.runPipeline(date);
      const failed = results.filter((item) => item.status === 'failed');
      if (failed.length === 0) {
        this.logger.log(`[job] nightly maintenance finished for ${date}`);
        return;
      }
      this.logger.warn(
        `[job] nightly maintenance finished for ${date} with failures: ${failed.map((item) => `${item.stage}:${item.detail}`).join('; ')}`,
      );
    } catch (error) {
      this.logger.error('[job] nightly maintenance crashed', error);
    } finally {
      this.isRunning = false;
    }
  }

  async runPipeline(date: string): Promise<NightlyStageResult[]> {
    const results: NightlyStageResult[] = [];
    this.logger.log(`[job] nightly maintenance started for ${date}`);

    results.push(await this.runScriptStage('stability', 'monitor_stability.py', 'nightly-stability'));
    await this.waitBetweenStages();

    results.push(await this.runScriptStage('performance', 'monitor_performance.py', 'nightly-performance'));
    await this.waitBetweenStages();

    results.push(await this.runRiskStage(date));
    await this.waitBetweenStages();

    results.push(await this.runAggregateStage(date));
    results.push(await this.runRecomputeStage(date));

    return results;
  }

  private async runScriptStage(
    stage: 'stability' | 'performance',
    scriptName: 'monitor_stability.py' | 'monitor_performance.py',
    source: string,
  ): Promise<NightlyStageResult> {
    if (!this.adminApiKey && !this.adminBearerToken) {
      return {
        stage,
        status: 'failed',
        detail: 'ADMIN_API_KEY / ADMIN_BEARER_TOKEN 未配置',
      };
    }

    const scriptPath = path.resolve(this.repoRoot, 'scripts', scriptName);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      API_BASE: this.apiBase,
      ADMIN_API_KEY: this.adminApiKey,
      ADMIN_BEARER_TOKEN: this.adminBearerToken,
      ALL_AIRPORTS: '1',
      SOURCE: source,
      SKIP_AGGREGATE: '1',
      SKIP_RECOMPUTE: '1',
    };
    if (this.airportStatus) {
      env.AIRPORT_STATUS = this.airportStatus;
    }

    try {
      const { stdout, stderr } = await this.execFileFn(this.pythonBin, [scriptPath], {
        cwd: this.repoRoot,
        env,
        maxBuffer: 10 * 1024 * 1024,
        timeout: this.scriptTimeoutMs,
      });
      const detail = summarizeScriptOutput(stdout, stderr);
      this.logger.log(`[job] ${stage} stage succeeded${detail ? `: ${detail}` : ''}`);
      return { stage, status: 'succeeded', detail: detail || 'ok' };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`[job] ${stage} stage failed`, error);
      return { stage, status: 'failed', detail };
    }
  }

  private async runRiskStage(date: string): Promise<NightlyStageResult> {
    try {
      const airports = await this.deps.airportRepository.listAll();
      const filtered = this.airportStatus
        ? airports.filter((airport) => airport.status === this.airportStatus)
        : airports;
      let successCount = 0;
      let failureCount = 0;

      for (let index = 0; index < filtered.length; index += 1) {
        const airport = filtered[index];
        try {
          await this.deps.riskCheckService.inspectAirportForDate(airport.id, date);
          successCount += 1;
        } catch (error) {
          failureCount += 1;
          this.logger.error(`[job] risk stage failed for airport ${airport.id}`, error);
        }

        if (index < filtered.length - 1 && this.riskAirportGapMs > 0) {
          await this.sleepFn(this.riskAirportGapMs);
        }
      }

      const detail = `${successCount} succeeded, ${failureCount} failed`;
      if (failureCount > 0) {
        return { stage: 'risk', status: 'failed', detail };
      }
      this.logger.log(`[job] risk stage succeeded: ${detail}`);
      return { stage: 'risk', status: 'succeeded', detail };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error('[job] risk stage crashed', error);
      return { stage: 'risk', status: 'failed', detail };
    }
  }

  private async runAggregateStage(date: string): Promise<NightlyStageResult> {
    try {
      const result = await this.deps.aggregationService.aggregateForDate(date);
      const detail = `aggregated ${result.aggregated}`;
      this.logger.log(`[job] aggregate stage succeeded: ${detail}`);
      return { stage: 'aggregate', status: 'succeeded', detail };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error('[job] aggregate stage failed', error);
      return { stage: 'aggregate', status: 'failed', detail };
    }
  }

  private async runRecomputeStage(date: string): Promise<NightlyStageResult> {
    try {
      const result = await this.deps.recomputeService.recomputeForDate(date);
      const detail = `recomputed ${result.recomputed}`;
      this.logger.log(`[job] recompute stage succeeded: ${detail}`);
      return { stage: 'recompute', status: 'succeeded', detail };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error('[job] recompute stage failed', error);
      return { stage: 'recompute', status: 'failed', detail };
    }
  }

  private async waitBetweenStages(): Promise<void> {
    if (this.stageGapMs > 0) {
      await this.sleepFn(this.stageGapMs);
    }
  }
}

function summarizeScriptOutput(stdout: string, stderr: string): string {
  const output = stdout.trim() || stderr.trim();
  if (!output) {
    return '';
  }
  try {
    const parsed = JSON.parse(output) as {
      success_count?: number;
      failure_count?: number;
      airport_count?: number;
    };
    const airportCount = Number(parsed.airport_count ?? 0);
    const successCount = Number(parsed.success_count ?? 0);
    const failureCount = Number(parsed.failure_count ?? 0);
    return `${successCount}/${airportCount} succeeded, ${failureCount} failed`;
  } catch {
    return output.split('\n').slice(-1)[0].slice(0, 240);
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatClockInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function normalizeClockTime(value: string): string {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return '00:00';
}

function isFalsey(value: string): boolean {
  return ['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

function maxNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function isWithinWindow(clock: string, startAt: string, windowMinutes: number): boolean {
  const currentMinutes = toMinutes(clock);
  const startMinutes = toMinutes(startAt);
  if (currentMinutes === null || startMinutes === null) {
    return false;
  }
  if (currentMinutes < startMinutes) {
    return false;
  }
  return currentMinutes - startMinutes <= windowMinutes;
}

function toMinutes(clock: string): number | null {
  const match = clock.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}
