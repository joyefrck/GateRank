import type { SchedulerTask, SchedulerTaskKey } from '../types/domain';

// Both scheduler tables must use this catalog, including startup enum upgrades.
export const DEFAULT_SCHEDULER_TASKS: Array<Pick<SchedulerTask, 'task_key' | 'name' | 'schedule_time'> & { enabled_by_default?: boolean }> = [
  { task_key: 'stability', name: '稳定性采集', schedule_time: '00:00' },
  { task_key: 'subscription_node_refresh', name: '订阅节点更新', schedule_time: '01:00', enabled_by_default: true },
  { task_key: 'performance', name: '性能采集', schedule_time: '00:10' },
  { task_key: 'network_coverage', name: '网络覆盖采集', schedule_time: '00:20' },
  { task_key: 'risk', name: '风险体检', schedule_time: '00:30' },
  { task_key: 'aggregate_recompute', name: '聚合重算', schedule_time: '04:00' },
  { task_key: 'billing_listing_sync', name: '余额展示同步', schedule_time: '03:00' },
  { task_key: 'stability_resample_guard', name: '稳定性复测保护', schedule_time: '06:00' },
  { task_key: 'ad_expiry_reminder', name: '广告到期提醒', schedule_time: '09:00', enabled_by_default: true },
];

export const SCHEDULER_TASK_KEYS: SchedulerTaskKey[] = DEFAULT_SCHEDULER_TASKS.map((task) => task.task_key);
export const SCHEDULER_TASK_ORDER = SCHEDULER_TASK_KEYS.map((key) => `'${key}'`).join(', ');
export const SCHEDULER_TASK_ENUM = `ENUM(${SCHEDULER_TASK_ORDER})`;
