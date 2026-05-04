import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  augmentPathWithCommonBinaryDirs,
  normalizeSingBoxError,
  resolveBinaryPath,
} from '../utils/runtimeBinary';
import { getAdminAuthConfig } from '../utils/adminAuthConfig';
import { getDateInTimezone } from '../utils/time';
import { signAdminToken } from '../utils/token';
import type { ManualJob, ManualJobKind } from '../types/domain';

const execFileAsync = promisify(execFile);

interface ManualJobServiceDeps {
  manualJobRepository: {
    create(input: {
      airport_id: number;
      date: string;
      kind: ManualJobKind;
      created_by: string;
      request_id: string;
    }): Promise<ManualJob>;
    getById(id: number): Promise<ManualJob | null>;
    findActive(airportId: number, date: string, kind: ManualJobKind): Promise<ManualJob | null>;
    markRunning(id: number, message?: string | null): Promise<void>;
    markFinished(id: number, status: 'succeeded' | 'failed', message: string | null): Promise<void>;
    failActiveJobs(message: string): Promise<void>;
  };
  aggregationService: {
    aggregateAirportForDate(airportId: number, date: string): Promise<{ aggregated: number }>;
  };
  recomputeService: {
    recomputeAirportForDate(date: string, airportId: number): Promise<{ recomputed: number }>;
  };
  riskCheckService: {
    inspectAirportForDate(airportId: number, date: string): Promise<{ domain_ok: boolean; ssl_days_left: number | null }>;
  };
  auditRepository: {
    log(action: string, actor: string, requestId: string, payload: unknown): Promise<void>;
  };
}

export class ManualJobService {
  private readonly apiBase: string;
  private readonly adminApiKey: string;
  private readonly adminBearerToken: string;
  private readonly pythonBin: string;
  private readonly repoRoot: string;
  private readonly singBoxBin: string;
  private readonly runtimePath: string;

  constructor(private readonly deps: ManualJobServiceDeps) {
    this.apiBase = (process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 8787}`).replace(/\/+$/, '');
    const authConfig = getAdminAuthConfig();
    this.adminApiKey = process.env.ADMIN_API_KEY || authConfig.apiKey || '';
    this.adminBearerToken = authConfig.jwtSecret
      ? signAdminToken(authConfig.jwtSecret, authConfig.tokenTtlHours).token
      : '';
    this.pythonBin = process.env.PYTHON_BIN || 'python3';
    this.repoRoot = process.cwd();
    this.singBoxBin = resolveBinaryPath('sing-box', process.env.SING_BOX_BIN);
    this.runtimePath = augmentPathWithCommonBinaryDirs(process.env.PATH);
  }

  async initialize(): Promise<void> {
    await this.deps.manualJobRepository.failActiveJobs('任务在服务重启时中断，请重新发起');
  }

  async createJob(input: {
    airportId: number;
    date: string;
    kind: ManualJobKind;
    createdBy: string;
    requestId: string;
  }): Promise<ManualJob> {
    const existing = await this.deps.manualJobRepository.findActive(input.airportId, input.date, input.kind);
    if (existing) {
      throw new Error('同一机场、日期和任务类型已有执行中的任务');
    }

    const job = await this.deps.manualJobRepository.create({
      airport_id: input.airportId,
      date: input.date,
      kind: input.kind,
      created_by: input.createdBy,
      request_id: input.requestId,
    });
    await this.deps.auditRepository.log('create_manual_job', input.createdBy, input.requestId, {
      job_id: job.id,
      airport_id: input.airportId,
      date: input.date,
      kind: input.kind,
    });

    setTimeout(() => {
      void this.runJob(job.id);
    }, 0);

    return job;
  }

  async getJob(jobId: number): Promise<ManualJob | null> {
    return this.deps.manualJobRepository.getById(jobId);
  }

  private async runJob(jobId: number): Promise<void> {
    const job = await this.deps.manualJobRepository.getById(jobId);
    if (!job) {
      return;
    }

    try {
      await this.deps.manualJobRepository.markRunning(job.id, '任务执行中');
      const message = await this.executeJob(job);
      await this.deps.manualJobRepository.markFinished(job.id, 'succeeded', message);
      await this.deps.auditRepository.log('finish_manual_job', job.created_by, job.request_id, {
        job_id: job.id,
        airport_id: job.airport_id,
        date: job.date,
        kind: job.kind,
        status: 'succeeded',
        message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '任务执行失败';
      await this.deps.manualJobRepository.markFinished(job.id, 'failed', message);
      await this.deps.auditRepository.log('finish_manual_job', job.created_by, job.request_id, {
        job_id: job.id,
        airport_id: job.airport_id,
        date: job.date,
        kind: job.kind,
        status: 'failed',
        message,
      });
    }
  }

  private async executeJob(job: ManualJob): Promise<string> {
    const isToday = job.date === getDateInTimezone();

    if (job.kind === 'full') {
      const stageFailures: string[] = [];
      if (isToday) {
        const stabilityFailure = await this.captureStageFailure('稳定性采集', async () => {
          await this.runStabilityScript(job.airport_id);
        });
        if (stabilityFailure) {
          stageFailures.push(stabilityFailure);
        }

        const performanceFailure = await this.captureStageFailure('性能采集', async () => {
          await this.runPerformanceScript(job.airport_id);
        });
        if (performanceFailure) {
          stageFailures.push(performanceFailure);
        }

        const riskFailure = await this.captureStageFailure('风险体检', async () => {
          await this.deps.riskCheckService.inspectAirportForDate(job.airport_id, job.date);
        });
        if (riskFailure) {
          stageFailures.push(riskFailure);
        }
      }

      let aggregatedCount: number | null = null;
      let recomputedCount: number | null = null;

      const aggregateFailure = await this.captureStageFailure('聚合', async () => {
        const result = await this.deps.aggregationService.aggregateAirportForDate(job.airport_id, job.date);
        aggregatedCount = result.aggregated;
      });
      if (aggregateFailure) {
        stageFailures.push(aggregateFailure);
      }

      const recomputeFailure = await this.captureStageFailure('时间维度重算', async () => {
        const result = await this.deps.recomputeService.recomputeAirportForDate(job.date, job.airport_id);
        recomputedCount = result.recomputed;
      });
      if (recomputeFailure) {
        stageFailures.push(recomputeFailure);
      }

      if (stageFailures.length > 0) {
        const successParts: string[] = [];
        if (aggregatedCount !== null) {
          successParts.push(`聚合 ${aggregatedCount} 条`);
        }
        if (recomputedCount !== null) {
          successParts.push(`重算 ${recomputedCount} 条`);
        }
        const successSummary =
          successParts.length > 0 ? `已完成 ${successParts.join('，')}。` : '没有成功完成的阶段。';
        throw new Error(`全链路未完全成功。${successSummary} 失败阶段：${stageFailures.join('；')}`);
      }

      return `全链路完成：聚合 ${aggregatedCount ?? 0} 条，重算 ${recomputedCount ?? 0} 条`;
    }

    if (job.kind === 'stability') {
      if (isToday) {
        await this.runStabilityScript(job.airport_id);
      }
      const aggregateResult = await this.deps.aggregationService.aggregateAirportForDate(job.airport_id, job.date);
      const recomputeResult = await this.deps.recomputeService.recomputeAirportForDate(job.date, job.airport_id);
      return isToday
        ? `稳定性采集完成：聚合 ${aggregateResult.aggregated} 条，重算 ${recomputeResult.recomputed} 条`
        : `历史日期仅重算稳定性相关数据：聚合 ${aggregateResult.aggregated} 条，重算 ${recomputeResult.recomputed} 条`;
    }

    if (job.kind === 'performance') {
      if (isToday) {
        await this.runPerformanceScript(job.airport_id);
      }
      const aggregateResult = await this.deps.aggregationService.aggregateAirportForDate(job.airport_id, job.date);
      const recomputeResult = await this.deps.recomputeService.recomputeAirportForDate(job.date, job.airport_id);
      return isToday
        ? `性能采集完成：聚合 ${aggregateResult.aggregated} 条，重算 ${recomputeResult.recomputed} 条`
        : `历史日期仅重算性能相关数据：聚合 ${aggregateResult.aggregated} 条，重算 ${recomputeResult.recomputed} 条`;
    }

    if (job.kind === 'risk') {
      if (isToday) {
        const result = await this.deps.riskCheckService.inspectAirportForDate(job.airport_id, job.date);
        const recomputeResult = await this.deps.recomputeService.recomputeAirportForDate(job.date, job.airport_id);
        return `风险体检完成：domain_ok=${String(result.domain_ok)}，ssl_days_left=${result.ssl_days_left ?? '-'}，重算 ${recomputeResult.recomputed} 条`;
      }
      const recomputeResult = await this.deps.recomputeService.recomputeAirportForDate(job.date, job.airport_id);
      return `历史日期仅重算风险相关数据：重算 ${recomputeResult.recomputed} 条`;
    }

    const recomputeResult = await this.deps.recomputeService.recomputeAirportForDate(job.date, job.airport_id);
    return `时间衰减分重算完成：重算 ${recomputeResult.recomputed} 条`;
  }

  private async captureStageFailure(stageName: string, runner: () => Promise<void>): Promise<string | null> {
    try {
      await runner();
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `${stageName}失败（${message}）`;
    }
  }

  private async runStabilityScript(airportId: number): Promise<void> {
    await this.runPythonScript('monitor_stability.py', airportId, 'manual-stability');
  }

  private async runPerformanceScript(airportId: number): Promise<void> {
    await this.runPythonScript('monitor_performance.py', airportId, 'manual-performance');
  }

  private async runPythonScript(scriptName: 'monitor_stability.py' | 'monitor_performance.py', airportId: number, source: string): Promise<void> {
    if (!this.adminApiKey) {
      throw new Error('ADMIN_API_KEY 未配置，无法执行手动采集任务');
    }

    const scriptPath = path.resolve(this.repoRoot, 'scripts', scriptName);
    try {
      const { stdout, stderr } = await execFileAsync(this.pythonBin, [scriptPath], {
        cwd: this.repoRoot,
        env: {
          ...process.env,
          PATH: this.runtimePath,
          API_BASE: this.apiBase,
          ADMIN_API_KEY: this.adminApiKey,
          ADMIN_BEARER_TOKEN: this.adminBearerToken,
          AIRPORT_ID: String(airportId),
          SOURCE: source,
          SING_BOX_BIN: this.singBoxBin,
          SKIP_AGGREGATE: '1',
          SKIP_RECOMPUTE: '1',
        },
        maxBuffer: 10 * 1024 * 1024,
      });

      if (stderr && stderr.trim()) {
        const stderrText = stderr.trim();
        if (stdout && stdout.trim()) {
          return;
        }
        throw new Error(normalizeSingBoxError(stderrText, this.singBoxBin));
      }
    } catch (error) {
      const message = summarizeManualJobScriptFailure(error);
      throw new Error(normalizeSingBoxError(message, this.singBoxBin));
    }
  }
}

export function summarizeManualJobScriptFailure(error: unknown): string {
  const output = getExecOutput(error);
  if (output) {
    const summarized = summarizeScriptOutput(output);
    if (summarized) {
      return summarized;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

function getExecOutput(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '';
  }
  const candidate = error as { stdout?: unknown; stderr?: unknown };
  return [candidate.stdout, candidate.stderr]
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .join('\n')
    .trim();
}

function summarizeScriptOutput(output: string): string {
  const trimmed = output.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmed) as {
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
    const countSummary = `${successCount}/${airportCount} succeeded, ${failureCount} failed`;
    return firstFailureError
      ? `${countSummary}; ${firstFailureLabel ? `${firstFailureLabel}: ` : ''}${firstFailureError}`
      : countSummary;
  } catch {
    return trimmed.split('\n').slice(-1)[0].slice(0, 240);
  }
}
