const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function calculateObservationDays(
  onboardedAt: string | null | undefined,
  targetDate: string | null | undefined,
): number | null {
  const start = parseDateOnly(onboardedAt);
  const end = parseDateOnly(targetDate);
  if (start === null || end === null) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS) + 1);
}

function parseDateOnly(value: string | null | undefined): number | null {
  const dateOnly = String(value || '').slice(0, 10);
  if (!DATE_ONLY_PATTERN.test(dateOnly)) return null;
  const parsed = Date.parse(`${dateOnly}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== dateOnly) return null;
  return parsed;
}
