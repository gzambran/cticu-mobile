import {
  formatDate,
  getCalendarDays,
  getMultiMonthBounds,
  isToday,
  parseDate,
} from '@/utils/date';

describe('formatDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 9, 15))).toBe('2026-10-15');
  });

  it('zero-pads single-digit months and days', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('parseDate', () => {
  it('parses YYYY-MM-DD into a local-time date, not UTC', () => {
    const parsed = parseDate('2026-10-15');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(9);
    expect(parsed.getDate()).toBe(15);
  });

  it('round-trips with formatDate', () => {
    expect(formatDate(parseDate('2026-10-15'))).toBe('2026-10-15');
  });
});

describe('getCalendarDays', () => {
  it('always returns 42 cells', () => {
    expect(getCalendarDays(2026, 9)).toHaveLength(42);
  });

  it('pads leading nulls up to the starting weekday, Sunday-first', () => {
    // 1 Oct 2026 is a Thursday, getDay() === 4
    const days = getCalendarDays(2026, 9);
    expect(days.slice(0, 4)).toEqual([null, null, null, null]);
    expect(formatDate(days[4] as Date)).toBe('2026-10-01');
  });

  it('includes every day of the month', () => {
    const days = getCalendarDays(2026, 9).filter(Boolean) as Date[];
    expect(days).toHaveLength(31);
    expect(formatDate(days[30])).toBe('2026-10-31');
  });

  it('shifts the padding when the week starts on Monday', () => {
    // 1 Feb 2026 is a Sunday, so Monday-first pushes it to the 7th cell
    const days = getCalendarDays(2026, 1, true);
    expect(days.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(formatDate(days[6] as Date)).toBe('2026-02-01');
  });
});

describe('isToday', () => {
  it('is true for now', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('is false for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isToday(tomorrow)).toBe(false);
  });
});

describe('getMultiMonthBounds', () => {
  it('spans the first of the month to the last day of the final month', () => {
    expect(getMultiMonthBounds(2026, 9, 4)).toEqual({
      start: '2026-10-01',
      end: '2027-01-31',
    });
  });

  it('defaults to a four-month window', () => {
    expect(getMultiMonthBounds(2026, 9)).toEqual({
      start: '2026-10-01',
      end: '2027-01-31',
    });
  });
});
