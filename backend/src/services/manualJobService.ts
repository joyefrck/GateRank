import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
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

  constructor(private readonly deps: ManualJobServiceDeps) {
    this.apiBase = (process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 8787}`).replace(/\/+$/, '');
    const authConfig = getAdminAuthConfig();
    this.adminApiKey = process.env.ADMIN_API_KEY || authConfig.apiKey || '';
    this.adminBearerToken = authConfig.jwtSecret
      ? signAdminToken(authConfig.jwtSecret, authConfig.tokenTtlHours).token
      : '';
    this.pythonBin = process.env.PYTHON_BIN || 'python3';
    this.repoRoot = process.cwd();
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
      if (isToday) {
        await this.runStabilityScript(job.airport_id);
        await this.runPerformanceScript(job.airport_id);
        await this.deps.riskCheckService.inspectAirportForDate(job.airport_id, job.date);
      }
      const aggregateResult = await this.deps.aggregationService.aggregateAirportForDate(job.airport_id, job.date);
      const recomputeResult = await this.deps.recomputeService.recomputeAirportForDate(job.date, job.airport_id);
      return `全链路完成：聚合 ${aggregateResult.aggregated} 条，重算 ${recomputeResult.recomputed} 条`;
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
    const { stdout, stderr } = await execFileAsync(this.pythonBin, [scriptPath], {
      cwd: this.repoRoot,
      env: {
        ...process.env,
        API_BASE: this.apiBase,
        ADMIN_API_KEY: this.adminApiKey,
        ADMIN_BEARER_TOKEN: this.adminBearerToken,
        AIRPORT_ID: String(airportId),
        SOURCE: source,
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
      throw new Error(stderrText);
    }
  }
}
