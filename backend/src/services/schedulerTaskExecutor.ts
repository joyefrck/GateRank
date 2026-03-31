import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  augmentPathWithCommonBinaryDirs,
  normalizeSingBoxError,
  resolveBinaryPath,
} from '../utils/runtimeBinary';
import { getAdminAuthConfig } from '../utils/adminAuthConfig';
import type { SchedulerTaskKey } from '../types/domain';
import { signAdminToken } from '../utils/token';

const execFileAsync = promisify(execFile);

interface LoggerLike {
  log(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

interface SchedulerTaskExecutorDeps {
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
}

export interface SchedulerTaskExecutionResult {
  status: 'succeeded' | 'failed';
  message: string;
  detail: Record<string, unknown>;
}

export class SchedulerTaskExecutor {
  private readonly logger: LoggerLike;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly execFileFn: NonNullable<SchedulerTaskExecutorDeps['execFileAsync']>;
  private readonly repoRoot: string;
  private readonly pythonBin: string;
  private readonly apiBase: string;
  private readonly adminApiKey: string;
  private readonly adminBearerToken: string;
  private readonly scriptTimeoutMs: number;
  private readonly airportStatus: string;
  private readonly riskAirportGapMs: number;
  private readonly singBoxBin: string;
  private readonly runtimePath: string;

  constructor(private readonly deps: SchedulerTaskExecutorDeps) {
    const authConfig = getAdminAuthConfig();
    this.logger = deps.logger || console;
    this.sleepFn = deps.sleep || defaultSleep;
    this.execFileFn = deps.execFileAsync || execFileAsync;
    this.repoRoot = process.cwd();
    this.pythonBin = process.env.PYTHON_BIN || 'python3';
    this.apiBase = (process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 8787}`).replace(/\/+$/, '');
    this.adminApiKey = process.env.ADMIN_API_KEY || authConfig.apiKey || '';
    this.adminBearerToken = process.env.ADMIN_BEARER_TOKEN
      || (authConfig.jwtSecret ? signAdminToken(authConfig.jwtSecret, authConfig.tokenTtlHours).token : '');
    this.scriptTimeoutMs = maxNumber(process.env.NIGHTLY_PIPELINE_SCRIPT_TIMEOUT_MS, 30 * 60 * 1000);
    this.airportStatus = (process.env.NIGHTLY_PIPELINE_AIRPORT_STATUS || '').trim();
    this.riskAirportGapMs = maxNumber(process.env.NIGHTLY_PIPELINE_RISK_AIRPORT_GAP_MS, 1_500);
    this.singBoxBin = resolveBinaryPath('sing-box', process.env.SING_BOX_BIN);
    this.runtimePath = augmentPathWithCommonBinaryDirs(process.env.PATH);
  }

  async runTask(taskKey: SchedulerTaskKey, date: string): Promise<SchedulerTaskExecutionResult> {
    if (taskKey === 'stability') {
      return this.runStabilityCollection(date);
    }
    if (taskKey === 'performance') {
      return this.runPerformanceCollection(date);
    }
    if (taskKey === 'risk') {
      return this.runRiskInspection(date);
    }
    return this.runAggregateRecompute(date);
  }

  async runStabilityCollection(date: string): Promise<SchedulerTaskExecutionResult> {
    const result = await this.runScriptStage('stability', 'monitor_stability.py', 'scheduler-stability');
    return {
      status: result.status,
      message: result.status === 'succeeded' ? `稳定性采集完成：${result.detail}` : `稳定性采集失败：${result.detail}`,
      detail: {
        stage: 'stability',
        summary: result.detail,
      },
    };
  }

  async runPerformanceCollection(date: string): Promise<SchedulerTaskExecutionResult> {
    const result = await this.runScriptStage('performance', 'monitor_performance.py', 'scheduler-performance');
    return {
      status: result.status,
      message: result.status === 'succeeded' ? `性能采集完成：${result.detail}` : `性能采集失败：${result.detail}`,
      detail: {
        stage: 'performance',
        summary: result.detail,
      },
    };
  }

  async runRiskInspection(date: string): Promise<SchedulerTaskExecutionResult> {
    const result = await this.runRiskStage(date);
    return {
      status: result.status,
      message: result.status === 'succeeded' ? `风险体检完成：${result.detail}` : `风险体检失败：${result.detail}`,
      detail: {
        stage: 'risk',
        summary: result.detail,
      },
    };
  }

  async runAggregateRecompute(date: string): Promise<SchedulerTaskExecutionResult> {
    const aggregate = await this.runAggregateStage(date);
    const recompute = await this.runRecomputeStage(date);
    const status = aggregate.status === 'succeeded' && recompute.status === 'succeeded' ? 'succeeded' : 'failed';
    const message = status === 'succeeded'
      ? `聚合重算完成：${aggregate.detail}，${recompute.detail}`
      : `聚合重算失败：聚合=${aggregate.detail}；重算=${recompute.detail}`;
    return {
      status,
      message,
      detail: {
        aggregate,
        recompute,
      },
    };
  }

  private async runScriptStage(
    stage: 'stability' | 'performance',
    scriptName: 'monitor_stability.py' | 'monitor_performance.py',
    source: string,
  ): Promise<{ stage: string; status: 'succeeded' | 'failed'; detail: string }> {
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
      PATH: this.runtimePath,
      API_BASE: this.apiBase,
      ADMIN_API_KEY: this.adminApiKey,
      ADMIN_BEARER_TOKEN: this.adminBearerToken,
      ALL_AIRPORTS: '1',
      SOURCE: source,
      SING_BOX_BIN: this.singBoxBin,
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
      this.logger.log(`[scheduler] ${stage} stage succeeded${detail ? `: ${detail}` : ''}`);
      return { stage, status: 'succeeded', detail: detail || 'ok' };
    } catch (error) {
      const detail = normalizeSingBoxError(
        error instanceof Error ? error.message : String(error),
        this.singBoxBin,
      );
      this.logger.error(`[scheduler] ${stage} stage failed`, error);
      return { stage, status: 'failed', detail };
    }
  }

  private async runRiskStage(date: string): Promise<{ stage: string; status: 'succeeded' | 'failed'; detail: string }> {
    try {
      const airports = await this.deps.airportRepository.listAll();
      const filtered = airports.filter((airport) => {
        if (airport.status === 'down') {
          return false;
        }
        return this.airportStatus ? airport.status === this.airportStatus : true;
      });
      let successCount = 0;
      let failureCount = 0;

      for (let index = 0; index < filtered.length; index += 1) {
        const airport = filtered[index];
        try {
          await this.deps.riskCheckService.inspectAirportForDate(airport.id, date);
          successCount += 1;
        } catch (error) {
          failureCount += 1;
          this.logger.error(`[scheduler] risk stage failed for airport ${airport.id}`, error);
        }

        if (index < filtered.length - 1 && this.riskAirportGapMs > 0) {
          await this.sleepFn(this.riskAirportGapMs);
        }
      }

      const detail = `${successCount} succeeded, ${failureCount} failed`;
      if (failureCount > 0) {
        return { stage: 'risk', status: 'failed', detail };
      }
      this.logger.log(`[scheduler] risk stage succeeded: ${detail}`);
      return { stage: 'risk', status: 'succeeded', detail };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error('[scheduler] risk stage crashed', error);
      return { stage: 'risk', status: 'failed', detail };
    }
  }

  private async runAggregateStage(date: string): Promise<{ stage: string; status: 'succeeded' | 'failed'; detail: string }> {
    try {
      const result = await this.deps.aggregationService.aggregateForDate(date);
      const detail = `aggregated ${result.aggregated}`;
      this.logger.log(`[scheduler] aggregate stage succeeded: ${detail}`);
      return { stage: 'aggregate', status: 'succeeded', detail };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error('[scheduler] aggregate stage failed', error);
      return { stage: 'aggregate', status: 'failed', detail };
    }
  }

  private async runRecomputeStage(date: string): Promise<{ stage: string; status: 'succeeded' | 'failed'; detail: string }> {
    try {
      const result = await this.deps.recomputeService.recomputeForDate(date);
      const detail = `recomputed ${result.recomputed}`;
      this.logger.log(`[scheduler] recompute stage succeeded: ${detail}`);
      return { stage: 'recompute', status: 'succeeded', detail };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error('[scheduler] recompute stage failed', error);
      return { stage: 'recompute', status: 'failed', detail };
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

function maxNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}
