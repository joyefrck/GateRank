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
