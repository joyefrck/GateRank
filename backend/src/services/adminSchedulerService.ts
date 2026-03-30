import { SHANGHAI_TIMEZONE } from '../config/scoring';
import { HttpError } from '../middleware/errorHandler';
import type {
  SchedulerRunStatus,
  SchedulerTask,
  SchedulerTaskKey,
  SchedulerTriggerSource,
} from '../types/domain';
import { dateDaysAgo, formatDateTimeInTimezoneIso, getDateInTimezone } from '../utils/time';
import type { SchedulerDailyStat, SchedulerRunQuery } from '../repositories/schedulerRunRepository';
import type { SchedulerTaskExecutionResult } from './schedulerTaskExecutor';

interface LoggerLike {
  log(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

type TimerRef = ReturnType<typeof setTimeout>;

interface RuntimeState {
  timer: TimerRef | null;
  nextRunAt: Date | null;
  isRunning: boolean;
}

interface AdminSchedulerServiceDeps {
  schedulerTaskRepository: {
    listAll(): Promise<SchedulerTask[]>;
    getByKey(taskKey: SchedulerTaskKey): Promise<SchedulerTask | null>;
    update(taskKey: SchedulerTaskKey, patch: { enabled?: boolean; schedule_time?: string; updated_by: string }): Promise<void>;
    markRestarted(taskKey: SchedulerTaskKey, actor: string): Promise<void>;
  };
  schedulerRunRepository: {
    createRunning(input: {
      taskKey: SchedulerTaskKey;
      runDate: string;
      triggerSource: SchedulerTriggerSource;
      message?: string | null;
      detailJson?: Record<string, unknown> | null;
    }): Promise<{ id: number }>;
    markFinished(input: {
      id: number;
      status: Extract<SchedulerRunStatus, 'succeeded' | 'failed'>;
      durationMs: number;
      message?: string | null;
      detailJson?: Record<string, unknown> | null;
    }): Promise<void>;
    listLatestByTaskKeys(taskKeys: SchedulerTaskKey[]): Promise<Record<SchedulerTaskKey, unknown | null>>;
    listByQuery(query: SchedulerRunQuery): Promise<{ items: unknown[]; total: number }>;
    getDailyStats(query: { taskKey?: SchedulerTaskKey; dateFrom: string; dateTo: string }): Promise<SchedulerDailyStat[]>;
  };
  schedulerTaskExecutor: {
    runTask(taskKey: SchedulerTaskKey, date: string): Promise<SchedulerTaskExecutionResult>;
  };
  logger?: LoggerLike;
  now?: () => Date;
  setTimeoutFn?: (callback: () => void, ms: number) => TimerRef;
  clearTimeoutFn?: (timer: TimerRef) => void;
}

export interface SchedulerTaskView extends SchedulerTask {
  description: string;
  next_run_at: string | null;
  is_running: boolean;
  latest_run: unknown | null;
}

const TASK_DESCRIPTIONS: Record<SchedulerTaskKey, string> = {
  stability: '调用 monitor_stability.py 批量采集稳定性样本，不重复触发聚合和重算。',
  performance: '调用 monitor_performance.py 批量采集性能样本，不重复触发聚合和重算。',
  risk: '逐机场串行执行风险体检，刷新官网可用性与 SSL 检查结果。',
  aggregate_recompute: '执行全量聚合和时间衰减重算，统一刷新每日分数与榜单。',
};

export class AdminSchedulerService {
  private readonly logger: LoggerLike;
  private readonly nowFn: () => Date;
  private readonly setTimeoutFn: (callback: () => void, ms: number) => TimerRef;
  private readonly clearTimeoutFn: (timer: TimerRef) => void;
  private readonly runtime = new Map<SchedulerTaskKey, RuntimeState>();
  private started = false;

  constructor(private readonly deps: AdminSchedulerServiceDeps) {
    this.logger = deps.logger || console;
    this.nowFn = deps.now || (() => new Date());
    this.setTimeoutFn = deps.setTimeoutFn || setTimeout;
    this.clearTimeoutFn = deps.clearTimeoutFn || clearTimeout;
  }

  async startAll(): Promise<void> {
    this.started = true;
    await this.reloadConfig();
  }

  stopAll(): void {
    for (const taskKey of this.runtime.keys()) {
      this.stopTask(taskKey);
    }
    this.started = false;
  }

  stopTask(taskKey: SchedulerTaskKey): void {
    const state = this.runtime.get(taskKey);
    if (!state) {
      return;
    }
    if (state.timer) {
      this.clearTimeoutFn(state.timer);
    }
    this.runtime.set(taskKey, {
      ...state,
      timer: null,
      nextRunAt: null,
    });
  }

  async reloadConfig(taskKey?: SchedulerTaskKey): Promise<void> {
    if (taskKey) {
      const task = await this.deps.schedulerTaskRepository.getByKey(taskKey);
      if (!task) {
        throw new Error(`scheduler task ${taskKey} not found`);
      }
      this.applyTask(task);
      return;
    }

    const tasks = await this.deps.schedulerTaskRepository.listAll();
    for (const task of tasks) {
      this.applyTask(task);
    }
  }

  async restartTask(taskKey: SchedulerTaskKey, actor: string): Promise<SchedulerTaskView> {
    const task = await this.deps.schedulerTaskRepository.getByKey(taskKey);
    if (!task) {
      throw new HttpError(404, 'SCHEDULER_TASK_NOT_FOUND', `scheduler task ${taskKey} not found`);
    }
    if (!task.enabled) {
      throw new HttpError(409, 'SCHEDULER_TASK_DISABLED', '任务已关闭，请先开启调度');
    }
    const state = this.runtime.get(taskKey);
    if (state?.isRunning) {
      throw new HttpError(409, 'SCHEDULER_TASK_RUNNING', '任务执行中，请稍后再试');
    }

    await this.deps.schedulerTaskRepository.markRestarted(taskKey, actor);
    await this.reloadConfig(taskKey);
    await this.executeTask(taskKey, 'restart');
    const taskView = await this.getTaskView(taskKey);
    if (!taskView) {
      throw new Error(`scheduler task ${taskKey} not found`);
    }
    return taskView;
  }

  async updateTask(
    taskKey: SchedulerTaskKey,
    patch: {
      enabled?: boolean;
      schedule_time?: string;
      updated_by: string;
    },
  ): Promise<SchedulerTaskView> {
    await this.deps.schedulerTaskRepository.update(taskKey, patch);
    await this.reloadConfig(taskKey);
    const task = await this.getTaskView(taskKey);
    if (!task) {
      throw new Error(`scheduler task ${taskKey} not found`);
    }
    return task;
  }

  async listTasks(): Promise<SchedulerTaskView[]> {
    const tasks = await this.deps.schedulerTaskRepository.listAll();
    const latestRuns = await this.deps.schedulerRunRepository.listLatestByTaskKeys(tasks.map((task) => task.task_key));
    return tasks.map((task) => this.toTaskView(task, latestRuns[task.task_key]));
  }

  async getTaskView(taskKey: SchedulerTaskKey): Promise<SchedulerTaskView | null> {
    const task = await this.deps.schedulerTaskRepository.getByKey(taskKey);
    if (!task) {
      return null;
    }
    const latestRuns = await this.deps.schedulerRunRepository.listLatestByTaskKeys([taskKey]);
    return this.toTaskView(task, latestRuns[taskKey]);
  }

  async listRuns(query: SchedulerRunQuery): Promise<{ items: unknown[]; total: number; page: number; page_size: number }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const result = await this.deps.schedulerRunRepository.listByQuery({
      ...query,
      page,
      pageSize,
    });
    return {
      ...result,
      page,
      page_size: pageSize,
    };
  }

  async getDailyStats(query: { taskKey?: SchedulerTaskKey; dateFrom?: string; dateTo?: string }): Promise<{
    date_from: string;
    date_to: string;
    items: SchedulerDailyStat[];
  }> {
    const dateTo = query.dateTo || getDateInTimezone(SHANGHAI_TIMEZONE, this.nowFn());
    const dateFrom = query.dateFrom || dateDaysAgo(dateTo, 6);
    const items = await this.deps.schedulerRunRepository.getDailyStats({
      taskKey: query.taskKey,
      dateFrom,
      dateTo,
    });
    return {
      date_from: dateFrom,
      date_to: dateTo,
      items,
    };
  }

  async triggerTick(taskKey?: SchedulerTaskKey, now: Date = this.nowFn()): Promise<void> {
    const taskKeys = taskKey ? [taskKey] : Array.from(this.runtime.keys());
    for (const key of taskKeys) {
      const state = this.runtime.get(key);
      if (!state?.nextRunAt || state.isRunning) {
        continue;
      }
      if (state.nextRunAt.getTime() <= now.getTime()) {
        await this.executeTask(key, 'schedule');
      }
    }
  }

  private applyTask(task: SchedulerTask): void {
    const existing = this.runtime.get(task.task_key);
    if (existing?.timer) {
      this.clearTimeoutFn(existing.timer);
    }

    if (!this.started || !task.enabled) {
      this.runtime.set(task.task_key, {
        timer: null,
        nextRunAt: null,
        isRunning: existing?.isRunning || false,
      });
      return;
    }

    const nextRunAt = computeNextRunAt(task.schedule_time, this.nowFn(), task.timezone);
    const delayMs = Math.max(0, nextRunAt.getTime() - this.nowFn().getTime());
    const timer = this.setTimeoutFn(() => {
      void this.executeTask(task.task_key, 'schedule');
    }, delayMs);

    this.runtime.set(task.task_key, {
      timer,
      nextRunAt,
      isRunning: existing?.isRunning || false,
    });
    this.logger.log(`[scheduler] task ${task.task_key} scheduled for ${nextRunAt.toISOString()}`);
  }

  private async executeTask(taskKey: SchedulerTaskKey, triggerSource: SchedulerTriggerSource): Promise<void> {
    const task = await this.deps.schedulerTaskRepository.getByKey(taskKey);
    if (!task || !task.enabled) {
      this.applyTask(task || {
        task_key: taskKey,
        name: taskKey,
        enabled: false,
        schedule_time: '00:00',
        timezone: SHANGHAI_TIMEZONE,
        last_restarted_at: null,
        last_restarted_by: null,
        updated_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return;
    }

    const state = this.runtime.get(taskKey);
    if (state?.isRunning) {
      this.logger.warn(`[scheduler] task ${taskKey} skipped because another run is still active`);
      return;
    }
    if (state?.timer) {
      this.clearTimeoutFn(state.timer);
    }

    this.runtime.set(taskKey, {
      timer: null,
      nextRunAt: null,
      isRunning: true,
    });

    const startedAt = this.nowFn();
    const runDate = getDateInTimezone(task.timezone || SHANGHAI_TIMEZONE, startedAt);
    const run = await this.deps.schedulerRunRepository.createRunning({
      taskKey,
      runDate,
      triggerSource,
      message: '任务执行中',
      detailJson: {
        task_key: taskKey,
        trigger_source: triggerSource,
      },
    });

    try {
      const result = await this.deps.schedulerTaskExecutor.runTask(taskKey, runDate);
      await this.deps.schedulerRunRepository.markFinished({
        id: run.id,
        status: result.status,
        durationMs: Math.max(0, this.nowFn().getTime() - startedAt.getTime()),
        message: result.message,
        detailJson: result.detail,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.deps.schedulerRunRepository.markFinished({
        id: run.id,
        status: 'failed',
        durationMs: Math.max(0, this.nowFn().getTime() - startedAt.getTime()),
        message,
        detailJson: {
          error: message,
        },
      });
    } finally {
      this.runtime.set(taskKey, {
        timer: null,
        nextRunAt: null,
        isRunning: false,
      });
      if (this.started) {
        const latestTask = await this.deps.schedulerTaskRepository.getByKey(taskKey);
        if (latestTask) {
          this.applyTask(latestTask);
        }
      }
    }
  }

  private toTaskView(task: SchedulerTask, latestRun: unknown | null): SchedulerTaskView {
    const state = this.runtime.get(task.task_key);
    return {
      ...task,
      description: TASK_DESCRIPTIONS[task.task_key],
      next_run_at: state?.nextRunAt ? formatDateTimeInTimezoneIso(state.nextRunAt, task.timezone || SHANGHAI_TIMEZONE) : null,
      is_running: Boolean(state?.isRunning),
      latest_run: latestRun,
    };
  }
}

export function computeNextRunAt(scheduleTime: string, now: Date, timezone: string): Date {
  const date = getDateInTimezone(timezone || SHANGHAI_TIMEZONE, now);
  const target = parseShanghaiDateTime(date, scheduleTime);
  if (target.getTime() > now.getTime()) {
    return target;
  }
  return parseShanghaiDateTime(dateDaysAgo(date, -1), scheduleTime);
}

function parseShanghaiDateTime(date: string, scheduleTime: string): Date {
  return new Date(`${date}T${scheduleTime}:00+08:00`);
}
