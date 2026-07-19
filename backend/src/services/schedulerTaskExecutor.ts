import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  augmentPathWithCommonBinaryDirs,
  normalizeSingBoxError,
  resolveBinaryPath,
} from '../utils/runtimeBinary';
import { getAdminAuthConfig } from '../utils/adminAuthConfig';
import type { AirportScoreDaily, SchedulerTaskKey } from '../types/domain';
import { signAdminToken } from '../utils/token';
import type { BillingMailNotificationEvent } from '../repositories/applicantBillingRepository';
import { sendBillingMailNotificationsSafely, type BillingMailService } from './billingMailNotificationService';
import {
  sendUserTelegramBotBillingNotificationsSafely,
  type UserTelegramBotBillingNotificationService,
} from './userTelegramBotMessageService';
import { dateDaysAgo } from '../utils/time';

const execFileAsync = promisify(execFile);
const SCHEDULER_PERFORMANCE_ENV_DEFAULTS: Readonly<Record<string, string>> = {
  LATENCY_ATTEMPTS: '3',
  LATENCY_SAMPLE_INTERVAL_SECONDS: '1',
  REQUEST_LOSS_ATTEMPTS: '10',
  REQUEST_LOSS_SAMPLE_INTERVAL_SECONDS: '0.5',
  SPEED_TIMEOUT: '10',
  SPEED_CONNECTIONS: '2',
  NODE_AVAILABILITY_CHECK: 'tcp',
};

interface LoggerLike {
  log(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

interface SchedulerTaskExecutorDeps {
  airportRepository: {
    listAll(): Promise<Array<{ id: number; status?: string; is_listed?: boolean }>>;
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
  scoreRepository: {
    getLatestAvailableDate(onOrBefore: string): Promise<string | null>;
    getByDate(date: string): Promise<Array<Pick<AirportScoreDaily, 'airport_id' | 's'>>>;
  };
  applicantBillingRepository: {
    syncListingStatusByBalance(clickChargeAmount: number): Promise<{
      checked: number;
      restored: number;
      unlisted: number;
      unchanged: number;
      skipped: number;
      notification_events?: BillingMailNotificationEvent[];
    }>;
  };
  marketingSettingsService: {
    getConfig(): Promise<{ click_charge_amount: number }>;
  };
  mailService?: BillingMailService;
  userTelegramBotMessageService?: UserTelegramBotBillingNotificationService;
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
    if (taskKey === 'subscription_node_refresh') {
      return this.runSubscriptionNodeRefresh();
    }
    if (taskKey === 'performance') {
      return this.runPerformanceCollection(date);
    }
    if (taskKey === 'risk') {
      return this.runRiskInspection(date);
    }
    if (taskKey === 'billing_listing_sync') {
      return this.runBillingListingSync();
    }
    if (taskKey === 'stability_resample_guard') {
      return this.runStabilityResampleGuard(date);
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

  async runSubscriptionNodeRefresh(): Promise<SchedulerTaskExecutionResult> {
    if (!this.adminApiKey && !this.adminBearerToken) {
      return {
        status: 'failed',
        message: '订阅节点更新失败：ADMIN_API_KEY / ADMIN_BEARER_TOKEN 未配置',
        detail: {
          stage: 'subscription_node_refresh',
          summary: 'ADMIN_API_KEY / ADMIN_BEARER_TOKEN 未配置',
        },
      };
    }

    const scriptPath = path.resolve(this.repoRoot, 'scripts', 'capture_subscription_nodes.py');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: this.runtimePath,
      API_BASE: this.apiBase,
      ADMIN_API_KEY: this.adminApiKey,
      ADMIN_BEARER_TOKEN: this.adminBearerToken,
      ALL_AIRPORTS: '1',
      SOURCE: 'scheduler-subscription-node-refresh',
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
      const summary = parseSubscriptionRefreshSummary(stdout, stderr);
      if (!summary) {
        return {
          status: 'failed',
          message: '订阅节点更新失败：脚本未返回有效汇总',
          detail: {
            stage: 'subscription_node_refresh',
            summary: 'invalid_script_summary',
          },
        };
      }
      const status = summary.failure_count > 0 ? 'failed' : 'succeeded';
      return buildSubscriptionRefreshResult(status, summary);
    } catch (error) {
      const execError = asExecFailure(error);
      const summary = parseSubscriptionRefreshSummary(execError?.stdout, execError?.stderr);
      if (summary) {
        return buildSubscriptionRefreshResult('failed', summary);
      }
      const detail = sanitizeSchedulerDetail(
        summarizeScriptFailure(error, this.singBoxBin, this.scriptTimeoutMs),
      );
      return {
        status: 'failed',
        message: `订阅节点更新失败：${detail}`,
        detail: {
          stage: 'subscription_node_refresh',
          summary: detail,
        },
      };
    }
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

  async runBillingListingSync(): Promise<SchedulerTaskExecutionResult> {
    const config = await this.deps.marketingSettingsService.getConfig();
    const result = await this.deps.applicantBillingRepository.syncListingStatusByBalance(
      Number(config.click_charge_amount),
    );
    await sendBillingMailNotificationsSafely(this.deps.mailService, result.notification_events, this.logger);
    await sendUserTelegramBotBillingNotificationsSafely(
      this.deps.userTelegramBotMessageService,
      result.notification_events,
      this.logger,
    );
    const message = `余额展示同步完成：检查 ${result.checked}，恢复公开总分 ${result.restored}，总分暂不公开 ${result.unlisted}，未变化 ${result.unchanged}，跳过 ${result.skipped}`;
    return {
      status: 'succeeded',
      message,
      detail: {
        stage: 'billing_listing_sync',
        click_charge_amount: Number(config.click_charge_amount),
        ...result,
      },
    };
  }

  async runStabilityResampleGuard(date: string): Promise<SchedulerTaskExecutionResult> {
    const threshold = 20;
    const previousDate = await this.deps.scoreRepository.getLatestAvailableDate(dateDaysAgo(date, 1));
    if (!previousDate) {
      return {
        status: 'succeeded',
        message: '稳定性复测保护完成：没有上一期分数，跳过复测',
        detail: {
          stage: 'stability_resample_guard',
          threshold,
          date,
          previous_date: null,
          checked_count: 0,
          flagged_count: 0,
          retested_count: 0,
          failures: [],
          flagged_airports: [],
        },
      };
    }

    const [currentScores, previousScores] = await Promise.all([
      this.deps.scoreRepository.getByDate(date),
      this.deps.scoreRepository.getByDate(previousDate),
    ]);
    const previousByAirport = new Map<number, number>();
    for (const score of previousScores) {
      const s = Number(score.s);
      if (Number.isFinite(s)) {
        previousByAirport.set(score.airport_id, s);
      }
    }

    const flaggedAirports: Array<{
      airport_id: number;
      current_s: number;
      previous_s: number;
      delta: number;
    }> = [];
    let checkedCount = 0;
    for (const score of currentScores) {
      const currentS = Number(score.s);
      const previousS = previousByAirport.get(score.airport_id);
      if (!Number.isFinite(currentS) || previousS === undefined || !Number.isFinite(previousS)) {
        continue;
      }
      checkedCount += 1;
      const delta = round2(Math.abs(currentS - previousS));
      if (delta >= threshold) {
        flaggedAirports.push({
          airport_id: score.airport_id,
          current_s: round2(currentS),
          previous_s: round2(previousS),
          delta,
        });
      }
    }

    const failures: Array<{ airport_id: number; error: string }> = [];
    let retestedCount = 0;
    const retestedAirports: number[] = [];
    for (const airport of flaggedAirports) {
      try {
        await this.runStabilityResampleForAirport(airport.airport_id);
        retestedCount += 1;
        retestedAirports.push(airport.airport_id);
      } catch (error) {
        failures.push({
          airport_id: airport.airport_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    let aggregate: { stage: string; status: 'succeeded' | 'failed'; detail: string } | null = null;
    let recompute: { stage: string; status: 'succeeded' | 'failed'; detail: string } | null = null;
    if (retestedCount > 0) {
      aggregate = await this.runAggregateStage(date);
      recompute = await this.runRecomputeStage(date);
    }

    const aggregateFailed = aggregate?.status === 'failed';
    const recomputeFailed = recompute?.status === 'failed';
    const status = failures.length > 0 || aggregateFailed || recomputeFailed ? 'failed' : 'succeeded';
    const message =
      status === 'succeeded'
        ? `稳定性复测保护完成：检查 ${checkedCount}，触发复测 ${flaggedAirports.length}，成功 ${retestedCount}`
        : `稳定性复测保护失败：检查 ${checkedCount}，触发复测 ${flaggedAirports.length}，成功 ${retestedCount}，失败 ${failures.length}`;

    return {
      status,
      message,
      detail: {
        stage: 'stability_resample_guard',
        threshold,
        date,
        previous_date: previousDate,
        checked_count: checkedCount,
        flagged_count: flaggedAirports.length,
        retested_count: retestedCount,
        flagged_airports: flaggedAirports,
        retested_airports: retestedAirports,
        failures,
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
    if (stage === 'performance') {
      applyMissingEnvDefaults(env, SCHEDULER_PERFORMANCE_ENV_DEFAULTS);
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
      const detail = summarizeScriptFailure(error, this.singBoxBin, this.scriptTimeoutMs);
      this.logger.error(`[scheduler] ${stage} stage failed`, error);
      return { stage, status: 'failed', detail };
    }
  }

  private async runStabilityResampleForAirport(airportId: number): Promise<void> {
    if (!this.adminApiKey && !this.adminBearerToken) {
      throw new Error('ADMIN_API_KEY / ADMIN_BEARER_TOKEN 未配置');
    }

    const scriptPath = path.resolve(this.repoRoot, 'scripts', 'monitor_stability.py');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: this.runtimePath,
      API_BASE: this.apiBase,
      ADMIN_API_KEY: this.adminApiKey,
      ADMIN_BEARER_TOKEN: this.adminBearerToken,
      AIRPORT_ID: String(airportId),
      SOURCE: 'scheduler-stability-resample',
      SING_BOX_BIN: this.singBoxBin,
      SKIP_AGGREGATE: '1',
      SKIP_RECOMPUTE: '1',
    };

    try {
      await this.execFileFn(this.pythonBin, [scriptPath], {
        cwd: this.repoRoot,
        env,
        maxBuffer: 10 * 1024 * 1024,
        timeout: this.scriptTimeoutMs,
      });
      this.logger.log(`[scheduler] stability resample succeeded for airport ${airportId}`);
    } catch (error) {
      const detail = summarizeScriptFailure(error, this.singBoxBin, this.scriptTimeoutMs);
      this.logger.error(`[scheduler] stability resample failed for airport ${airportId}`, error);
      throw new Error(detail);
    }
  }

  private async runRiskStage(date: string): Promise<{ stage: string; status: 'succeeded' | 'failed'; detail: string }> {
    try {
      const airports = await this.deps.airportRepository.listAll();
      const filtered = airports.filter((airport) => {
        if (!isRunnableAirport(airport)) {
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

interface SubscriptionRefreshSummary {
  airport_count: number;
  target_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  results: unknown[];
  failures: Array<{ airport_id?: number; airport_name?: string; error?: string }>;
  skipped: unknown[];
}

function parseSubscriptionRefreshSummary(stdout?: string, stderr?: string): SubscriptionRefreshSummary | null {
  const output = stdout?.trim() || stderr?.trim();
  if (!output) {
    return null;
  }
  try {
    const parsed = JSON.parse(output) as Partial<SubscriptionRefreshSummary>;
    const airportCount = Number(parsed.airport_count ?? 0);
    return {
      airport_count: airportCount,
      target_count: Number(parsed.target_count ?? airportCount),
      success_count: Number(parsed.success_count ?? 0),
      failure_count: Number(parsed.failure_count ?? 0),
      skipped_count: Number(parsed.skipped_count ?? 0),
      results: Array.isArray(parsed.results) ? parsed.results : [],
      failures: Array.isArray(parsed.failures)
        ? parsed.failures.map((failure) => ({
          airport_id: failure.airport_id,
          airport_name: failure.airport_name,
          error: sanitizeSchedulerDetail(String(failure.error || '')),
        }))
        : [],
      skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
    };
  } catch {
    return null;
  }
}

function buildSubscriptionRefreshResult(
  status: 'succeeded' | 'failed',
  summary: SubscriptionRefreshSummary,
): SchedulerTaskExecutionResult {
  const firstFailure = summary.failures[0];
  const firstFailureLabel = firstFailure
    ? [firstFailure.airport_name, firstFailure.airport_id ? `#${firstFailure.airport_id}` : null]
      .filter(Boolean)
      .join(' ')
    : '';
  const failureDetail = firstFailure?.error
    ? `；${firstFailureLabel ? `${firstFailureLabel}: ` : ''}${firstFailure.error}`
    : '';
  const action = status === 'succeeded' ? '完成' : '失败';
  return {
    status,
    message: `订阅节点更新${action}：目标 ${summary.target_count}，成功 ${summary.success_count}，失败 ${summary.failure_count}，跳过 ${summary.skipped_count}${failureDetail}`,
    detail: {
      stage: 'subscription_node_refresh',
      ...summary,
    },
  };
}

function sanitizeSchedulerDetail(value: string): string {
  return value.replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]').slice(0, 500);
}

function summarizeScriptFailure(error: unknown, singBoxBin: string, timeoutMs: number): string {
  if (isScriptTimeoutFailure(error)) {
    return `超时：超过 ${formatTimeoutDuration(timeoutMs)}`;
  }
  const execError = asExecFailure(error);
  const scriptDetail = summarizeScriptFailureOutput(execError?.stdout, execError?.stderr);
  if (scriptDetail) {
    return scriptDetail;
  }
  return normalizeSingBoxError(
    error instanceof Error ? error.message : String(error),
    singBoxBin,
  );
}

function summarizeScriptFailureOutput(stdout?: string, stderr?: string): string {
  const output = stdout?.trim() || stderr?.trim();
  if (!output) {
    return '';
  }

  try {
    const parsed = JSON.parse(output) as {
      airport_count?: number;
      success_count?: number;
      failure_count?: number;
      failures?: Array<{ airport_id?: number; airport_name?: string; error?: string }>;
    };
    const airportCount = Number(parsed.airport_count ?? 0);
    const successCount = Number(parsed.success_count ?? 0);
    const failureCount = Number(parsed.failure_count ?? 0);
    const firstFailure = Array.isArray(parsed.failures) ? parsed.failures[0] : null;
    const firstFailureLabel = firstFailure
      ? [firstFailure.airport_name, firstFailure.airport_id ? `#${firstFailure.airport_id}` : null]
        .filter(Boolean)
        .join(' ')
      : '';
    const firstFailureError = firstFailure?.error?.trim() || '';
    const failureSummary = firstFailureError
      ? `${firstFailureLabel ? `${firstFailureLabel}: ` : ''}${firstFailureError}`
      : '';
    const countSummary = `${successCount}/${airportCount} succeeded, ${failureCount} failed`;
    return failureSummary ? `${countSummary}; ${failureSummary}` : countSummary;
  } catch {
    return output.split('\n').slice(-1)[0].slice(0, 240);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function asExecFailure(error: unknown): { stdout?: string; stderr?: string } | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as { stdout?: unknown; stderr?: unknown };
  return {
    stdout: typeof candidate.stdout === 'string' ? candidate.stdout : undefined,
    stderr: typeof candidate.stderr === 'string' ? candidate.stderr : undefined,
  };
}

function isScriptTimeoutFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    killed?: unknown;
    message?: unknown;
    signal?: unknown;
    timedOut?: unknown;
  };
  if (candidate.timedOut === true || candidate.code === 'ETIMEDOUT') {
    return true;
  }
  if (candidate.killed === true && candidate.signal === 'SIGTERM') {
    return true;
  }
  return typeof candidate.message === 'string' && /timed out|timeout/i.test(candidate.message);
}

function formatTimeoutDuration(timeoutMs: number): string {
  if (timeoutMs >= 60_000) {
    return `${(timeoutMs / 60_000).toFixed(1)} min`;
  }
  return `${(timeoutMs / 1_000).toFixed(1)} s`;
}

function applyMissingEnvDefaults(env: NodeJS.ProcessEnv, defaults: Readonly<Record<string, string>>): void {
  for (const [key, value] of Object.entries(defaults)) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRunnableAirport(airport: { status?: string; is_listed?: boolean }): boolean {
  return airport.status !== 'down' && airport.is_listed !== false;
}

function maxNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}
