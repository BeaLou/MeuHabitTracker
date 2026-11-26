import { addDays, startOfWeek, type DateKey } from './dates';
import { amountOf } from './goals';
import { isDue } from './habits';
import type { Habit } from './types';

export interface HeatDay {
  key: DateKey;
  /** 0 (nada) a 4 (tudo); null = dia futuro. */
  level: number | null;
}

/** Colunas de semanas (domingo a sábado), terminando na semana de hoje. */
export function heatWeeks(today: DateKey, level: (key: DateKey) => number, weeks = 17): HeatDay[][] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const key = addDays(first, w * 7 + d);
      return { key, level: key > today ? null : level(key) };
    }),
  );
}

/** Fração dos hábitos do dia que foram feitos. Os de meta semanal só entram no dia em que são feitos. */
export function overallLevel(habits: Habit[], key: DateKey): number {
  let due = 0;
  let done = 0;
  for (const h of habits) {
    if (h.archived) continue;
    const isDone = h.log[key] === 'done';
    if (!isDone && (h.weeklyTimes || h.log[key] === 'skipped' || !isDue(h, key))) continue;
    due++;
    if (isDone) done++;
  }
  return due === 0 ? 0 : Math.ceil((done / due) * 4);
}

export function habitLevel(h: Habit, key: DateKey): number {
  if (h.log[key] === 'done') return 4;
  return h.goal ? Math.ceil(Math.min(1, amountOf(h, key) / h.goal.target) * 3) : 0;
}
