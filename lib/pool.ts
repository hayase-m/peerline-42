export const POOL_MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

export const POOL_MONTH_LABELS: Record<string, string> = {
  january: '1月',
  february: '2月',
  march: '3月',
  april: '4月',
  may: '5月',
  june: '6月',
  july: '7月',
  august: '8月',
  september: '9月',
  october: '10月',
  november: '11月',
  december: '12月',
};

const FIRST_POOL_YEAR = 2019;

export interface CohortPool {
  year: string;
  month: string;
}

export interface PoolMonthOption {
  month: string;
  count: number;
}

export function poolMonthLabel(month: string): string {
  return POOL_MONTH_LABELS[month.toLowerCase()] ?? month;
}

export function poolCohortLabel(year: string, month: string): string {
  return year + '年' + poolMonthLabel(month);
}

export function normalizePoolMonth(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();

  return POOL_MONTHS.includes(normalized as (typeof POOL_MONTHS)[number])
    ? normalized
    : null;
}

export function normalizePoolYear(
  value: string | null | undefined,
): string | null {
  if (!value || !/^\d{4}$/.test(value)) {
    return null;
  }

  const year = Number(value);
  const lastYear = new Date().getUTCFullYear() + 1;

  return year >= FIRST_POOL_YEAR && year <= lastYear ? value : null;
}

export function poolYearOptions(includeYear?: string | null): string[] {
  const lastYear = new Date().getUTCFullYear();
  const years: string[] = [];

  for (let year = lastYear; year >= FIRST_POOL_YEAR; year -= 1) {
    years.push(String(year));
  }

  if (includeYear && !years.includes(includeYear)) {
    years.push(includeYear);
    years.sort((left, right) => Number(right) - Number(left));
  }

  return years;
}
