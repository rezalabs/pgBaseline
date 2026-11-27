const MB_PER_GB = 1024;
const numberFormat = new Intl.NumberFormat('en-US');
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Formats a whole number of megabytes as GB when the value is exact. */
export function formatMemory(mb: number): string {
  if (mb >= MB_PER_GB && mb % MB_PER_GB === 0) {
    return `${mb / MB_PER_GB}GB`;
  }
  return `${mb}MB`;
}

/** Rounds large memory values to one decimal place for summary prose. */
export function formatMemoryApprox(mb: number): string {
  if (mb >= MB_PER_GB) {
    return `${Math.round((mb / MB_PER_GB) * 10) / 10}GB`;
  }
  return `${mb}MB`;
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function dayWord(days: number): string {
  return days === 1 ? 'day' : 'days';
}
