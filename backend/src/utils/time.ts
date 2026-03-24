import { SHANGHAI_TIMEZONE } from '../config/scoring';

export function getDateInTimezone(timeZone: string = SHANGHAI_TIMEZONE, date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function dateDaysAgo(baseDateStr: string, days: number): string {
  const date = new Date(`${baseDateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function dateDaysAfter(baseDateStr: string, days: number): string {
  const date = new Date(`${baseDateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function diffDays(startDateStr: string, endDateStr: string): number {
  const start = Date.parse(`${startDateStr}T00:00:00.000Z`);
  const end = Date.parse(`${endDateStr}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

export function formatDateTimeInTimezoneIso(
  input: Date = new Date(),
  timeZone: string = SHANGHAI_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(input)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  const utcDate = new Date(input.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(input.toLocaleString('en-US', { timeZone }));
  const offsetMinutes = Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const remainderMinutes = String(absMinutes % 60).padStart(2, '0');

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${offsetHours}:${remainderMinutes}`;
}

export function formatRelativeTimeFromNow(
  input: string | Date | null,
  now: Date = new Date(),
): string {
  if (!input) {
    return '暂无更新';
  }

  const target = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(target.getTime())) {
    return '暂无更新';
  }

  const diffMs = Math.max(0, now.getTime() - target.getTime());
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 1) {
    return '刚刚';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDaysCount = Math.floor(diffHours / 24);
  return `${diffDaysCount} 天前`;
}

export function formatSqlDateTimeInTimezone(
  input: string | Date,
  timeZone: string = SHANGHAI_TIMEZONE,
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return String(input);
  }

  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function sqlDateTimeToTimezoneIso(
  value: unknown,
  utcOffset: string = '+08:00',
): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
    if (match) {
      return `${match[1]}T${match[2]}${utcOffset}`;
    }
  }
  if (value instanceof Date) {
    return formatDateTimeInTimezoneIso(value);
  }
  return String(value);
}

export function formatDateOnly(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const plainMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (plainMatch) {
      return plainMatch[1];
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return String(value);
}
