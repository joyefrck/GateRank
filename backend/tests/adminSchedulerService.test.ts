import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/middleware/errorHandler';
import { AdminSchedulerService } from '../src/services/adminSchedulerService';
import type { SchedulerTask } from '../src/types/domain';

function createTask(overrides: Partial<SchedulerTask> = {}): SchedulerTask {
  return {
    task_key: 'stability',
    name: '稳定性采集',
    enabled: true,
    schedule_time: '23:00',
    timezone: 'Asia/Shanghai',
    last_restarted_at: null,
    last_restarted_by: null,
    updated_by: 'system',
    created_at: '2026-03-30T00:00:00+08:00',
    updated_at: '2026-03-30T00:00:00+08:00',
    ...overrides,
  };
}

test('AdminSchedulerService.startAll only schedules enabled tasks', async () => {
  const tasks = [
    createTask({ task_key: 'stability', enabled: true }),
    createTask({ task_key: 'performance', enabled: true, name: '性能采集', schedule_time: '23:10' }),
    createTask({ task_key: 'risk', enabled: false, name: '风险体检', schedule_time: '23:20' }),
    createTask({ task_key: 'aggregate_recompute', enabled: true, name: '聚合重算', schedule_time: '23:30' }),
  ];
  const scheduled: number[] = [];

  const service = new AdminSchedulerService({
    schedulerTaskRepository: {
      listAll: async () => tasks,
      getByKey: async (taskKey) => tasks.find((task) => task.task_key === taskKey) || null,
      update: async () => {},
      markRestarted: async () => {},
    },
    schedulerRunRepository: {
      createRunning: async () => ({ id: 1 }),
      markFinished: async () => {},
      listLatestByTaskKeys: async () => ({
        stability: null,
        performance: null,
        risk: null,
        aggregate_recompute: null,
      }),
      listByQuery: async () => ({ items: [], total: 0 }),
      getDailyStats: async () => [],
    },
    schedulerTaskExecutor: {
      runTask: async () => ({ status: 'succeeded', message: 'ok', detail: {} }),
    },
    now: () => new Date('2026-03-30T13:00:00.000Z'),
    setTimeoutFn: ((callback: () => void, ms: number) => {
      scheduled.push(ms);
      return { callback, ms } as never;
    }) as never,
    clearTimeoutFn: () => {},
  });

  await service.startAll();

  assert.equal(scheduled.length, 3);
});

test('AdminSchedulerService.updateTask reloads next run time', async () => {
  const tasks = [createTask()];

  const service = new AdminSchedulerService({
    schedulerTaskRepository: {
      listAll: async () => tasks,
      getByKey: async (taskKey) => tasks.find((task) => task.task_key === taskKey) || null,
      update: async (taskKey, patch) => {
        const task = tasks.find((item) => item.task_key === taskKey);
        if (task) {
          if (patch.enabled !== undefined) task.enabled = patch.enabled;
          if (patch.schedule_time !== undefined) task.schedule_time = patch.schedule_time;
          task.updated_by = patch.updated_by;
        }
      },
      markRestarted: async () => {},
    },
    schedulerRunRepository: {
      createRunning: async () => ({ id: 1 }),
      markFinished: async () => {},
      listLatestByTaskKeys: async () => ({
        stability: null,
        performance: null,
        risk: null,
        aggregate_recompute: null,
      }),
      listByQuery: async () => ({ items: [], total: 0 }),
      getDailyStats: async () => [],
    },
    schedulerTaskExecutor: {
      runTask: async () => ({ status: 'succeeded', message: 'ok', detail: {} }),
    },
    now: () => new Date('2026-03-30T13:00:00.000Z'),
    setTimeoutFn: ((callback: () => void, ms: number) => ({ callback, ms } as never)) as never,
    clearTimeoutFn: () => {},
  });

  await service.startAll();
  const updated = await service.updateTask('stability', {
    schedule_time: '22:00',
    updated_by: 'tester',
  });

  assert.equal(tasks[0]?.schedule_time, '22:00');
  assert.ok(updated.next_run_at?.includes('22:00:00+08:00'));
});

test('AdminSchedulerService.restartTask executes task body with restart trigger', async () => {
  const tasks = [createTask()];
  let createRunningCount = 0;
  let markFinishedCount = 0;
  let runTaskCount = 0;
  let restartedBy: string | null = null;
  const triggerSources: string[] = [];

  const service = new AdminSchedulerService({
    schedulerTaskRepository: {
      listAll: async () => tasks,
      getByKey: async (taskKey) => tasks.find((task) => task.task_key === taskKey) || null,
      update: async () => {},
      markRestarted: async (_taskKey, actor) => {
        restartedBy = actor;
      },
    },
    schedulerRunRepository: {
      createRunning: async ({ triggerSource }) => {
        createRunningCount += 1;
        triggerSources.push(triggerSource);
        return { id: 1 };
      },
      markFinished: async () => {
        markFinishedCount += 1;
      },
      listLatestByTaskKeys: async () => ({
        stability: null,
        performance: null,
        risk: null,
        aggregate_recompute: null,
      }),
      listByQuery: async () => ({ items: [], total: 0 }),
      getDailyStats: async () => [],
    },
    schedulerTaskExecutor: {
      runTask: async () => {
        runTaskCount += 1;
        return { status: 'succeeded', message: 'ok', detail: {} };
      },
    },
    now: () => new Date('2026-03-30T13:00:00.000Z'),
    setTimeoutFn: ((callback: () => void, ms: number) => ({ callback, ms } as never)) as never,
    clearTimeoutFn: () => {},
  });

  await service.startAll();
  await service.restartTask('stability', 'alice');

  assert.equal(restartedBy, 'alice');
  assert.equal(createRunningCount, 1);
  assert.equal(markFinishedCount, 1);
  assert.equal(runTaskCount, 1);
  assert.deepEqual(triggerSources, ['restart']);
});

test('AdminSchedulerService.restartTask rejects disabled task', async () => {
  const tasks = [createTask({ enabled: false })];

  const service = new AdminSchedulerService({
    schedulerTaskRepository: {
      listAll: async () => tasks,
      getByKey: async (taskKey) => tasks.find((task) => task.task_key === taskKey) || null,
      update: async () => {},
      markRestarted: async () => {},
    },
    schedulerRunRepository: {
      createRunning: async () => ({ id: 1 }),
      markFinished: async () => {},
      listLatestByTaskKeys: async () => ({
        stability: null,
        performance: null,
        risk: null,
        aggregate_recompute: null,
      }),
      listByQuery: async () => ({ items: [], total: 0 }),
      getDailyStats: async () => [],
    },
    schedulerTaskExecutor: {
      runTask: async () => ({ status: 'succeeded', message: 'ok', detail: {} }),
    },
    now: () => new Date('2026-03-30T13:00:00.000Z'),
    setTimeoutFn: ((callback: () => void, ms: number) => ({ callback, ms } as never)) as never,
    clearTimeoutFn: () => {},
  });

  await assert.rejects(() => service.restartTask('stability', 'alice'), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 409);
    assert.equal(error.code, 'SCHEDULER_TASK_DISABLED');
    return true;
  });
});

test('AdminSchedulerService.restartTask rejects when task is already running', async () => {
  const tasks = [createTask({ schedule_time: '21:01' })];
  let releaseRun!: () => void;
  const runBlocked = new Promise<void>((resolve) => {
    releaseRun = resolve;
  });

  const service = new AdminSchedulerService({
    schedulerTaskRepository: {
      listAll: async () => tasks,
      getByKey: async (taskKey) => tasks.find((task) => task.task_key === taskKey) || null,
      update: async () => {},
      markRestarted: async () => {},
    },
    schedulerRunRepository: {
      createRunning: async () => ({ id: 1 }),
      markFinished: async () => {},
      listLatestByTaskKeys: async () => ({
        stability: null,
        performance: null,
        risk: null,
        aggregate_recompute: null,
      }),
      listByQuery: async () => ({ items: [], total: 0 }),
      getDailyStats: async () => [],
    },
    schedulerTaskExecutor: {
      runTask: async () => {
        await runBlocked;
        return { status: 'succeeded', message: 'ok', detail: {} };
      },
    },
    now: () => new Date('2026-03-30T13:00:00.000Z'),
    setTimeoutFn: ((callback: () => void) => ({ callback } as never)) as never,
    clearTimeoutFn: () => {},
  });

  await service.startAll();
  const firstRun = service.triggerTick('stability', new Date('2026-03-30T13:01:00.000Z'));
  await new Promise((resolve) => setTimeout(resolve, 0));

  await assert.rejects(() => service.restartTask('stability', 'alice'), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 409);
    assert.equal(error.code, 'SCHEDULER_TASK_RUNNING');
    return true;
  });

  releaseRun();
  await firstRun;
});

test('AdminSchedulerService scheduled execution writes run record and finishes it', async () => {
  const tasks = [createTask({ schedule_time: '21:01' })];
  const scheduledCallbacks: Array<() => void> = [];
  const runIds: number[] = [];
  const finishedStatuses: string[] = [];

  const service = new AdminSchedulerService({
    schedulerTaskRepository: {
      listAll: async () => tasks,
      getByKey: async (taskKey) => tasks.find((task) => task.task_key === taskKey) || null,
      update: async () => {},
      markRestarted: async () => {},
    },
    schedulerRunRepository: {
      createRunning: async () => {
        runIds.push(1);
        return { id: 1 };
      },
      markFinished: async ({ status }) => {
        finishedStatuses.push(status);
      },
      listLatestByTaskKeys: async () => ({
        stability: null,
        performance: null,
        risk: null,
        aggregate_recompute: null,
      }),
      listByQuery: async () => ({ items: [], total: 0 }),
      getDailyStats: async () => [],
    },
    schedulerTaskExecutor: {
      runTask: async () => ({ status: 'succeeded', message: 'ok', detail: { stage: 'stability' } }),
    },
    now: () => new Date('2026-03-30T13:00:00.000Z'),
    setTimeoutFn: ((callback: () => void) => {
      scheduledCallbacks.push(callback);
      return { callback } as never;
    }) as never,
    clearTimeoutFn: () => {},
  });

  await service.startAll();
  await scheduledCallbacks[0]?.();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(runIds.length, 1);
  assert.deepEqual(finishedStatuses, ['succeeded']);
});

test('AdminSchedulerService scheduled midnight execution uses scheduled slot date for run_date', async () => {
  const tasks = [createTask({ schedule_time: '00:00' })];
  const scheduledCallbacks: Array<() => void> = [];
  const runDates: string[] = [];

  const service = new AdminSchedulerService({
    schedulerTaskRepository: {
      listAll: async () => tasks,
      getByKey: async (taskKey) => tasks.find((task) => task.task_key === taskKey) || null,
      update: async () => {},
      markRestarted: async () => {},
    },
    schedulerRunRepository: {
      createRunning: async ({ runDate }) => {
        runDates.push(runDate);
        return { id: 1 };
      },
      markFinished: async () => {},
      listLatestByTaskKeys: async () => ({
        stability: null,
        performance: null,
        risk: null,
        aggregate_recompute: null,
      }),
      listByQuery: async () => ({ items: [], total: 0 }),
      getDailyStats: async () => [],
    },
    schedulerTaskExecutor: {
      runTask: async () => ({ status: 'succeeded', message: 'ok', detail: {} }),
    },
    now: () => new Date('2026-03-30T15:59:59.900Z'),
    setTimeoutFn: ((callback: () => void) => {
      scheduledCallbacks.push(callback);
      return { callback } as never;
    }) as never,
    clearTimeoutFn: () => {},
  });

  await service.startAll();
  await scheduledCallbacks[0]?.();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(runDates, ['2026-03-31']);
});

test('AdminSchedulerService scheduled risk execution auto-triggers aggregate_recompute', async () => {
  const tasks = [
    createTask({ task_key: 'risk', name: '风险体检', schedule_time: '00:20' }),
    createTask({ task_key: 'aggregate_recompute', name: '聚合重算', schedule_time: '00:30' }),
  ];
  const scheduledCallbacks: Array<() => void> = [];
  const runOrder: string[] = [];

  const service = new AdminSchedulerService({
    schedulerTaskRepository: {
      listAll: async () => tasks,
      getByKey: async (taskKey) => tasks.find((task) => task.task_key === taskKey) || null,
      update: async () => {},
      markRestarted: async () => {},
    },
    schedulerRunRepository: {
      createRunning: async ({ taskKey }) => {
        runOrder.push(`create:${taskKey}`);
        return { id: runOrder.length };
      },
      markFinished: async ({ id, status }) => {
        runOrder.push(`finish:${id}:${status}`);
      },
      listLatestByTaskKeys: async () => ({
        stability: null,
        performance: null,
        risk: null,
        aggregate_recompute: null,
      }),
      listByQuery: async () => ({ items: [], total: 0 }),
      getDailyStats: async () => [],
    },
    schedulerTaskExecutor: {
      runTask: async (taskKey) => {
        runOrder.push(`run:${taskKey}`);
        return { status: 'succeeded', message: 'ok', detail: {} };
      },
    },
    now: () => new Date('2026-03-30T16:19:59.000Z'),
    setTimeoutFn: ((callback: () => void) => {
      scheduledCallbacks.push(callback);
      return { callback } as never;
    }) as never,
    clearTimeoutFn: () => {},
  });

  await service.startAll();
  await scheduledCallbacks[0]?.();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(runOrder, [
    'create:risk',
    'run:risk',
    'finish:1:succeeded',
    'create:aggregate_recompute',
    'run:aggregate_recompute',
    'finish:4:succeeded',
  ]);
});
