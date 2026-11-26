import { addDays, startOfWeek, toKey, type DateKey } from './dates';
import { doneInWeek, isDue } from './habits';
import type { Book, Expense, Habit } from './types';

/** Os 7 dias (domingo a sábado) da semana de `key`. */
export const weekDays = (key: DateKey): DateKey[] => {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/**
 * Páginas lidas nos dias informados: avanço em relação ao registro anterior em páginas do mesmo livro.
 * O primeiro registro de um livro conta desde a página 0. Porcentagem e minutagem não entram na soma.
 */
export function pagesRead(books: Book[], days: DateKey[]): number {
  let sum = 0;
  for (const b of books) {
    let previous = 0;
    for (const e of [...(b.progress ?? [])].sort((a, c) => a.at - c.at)) {
      if (e.mode !== 'pages') continue;
      if (days.includes(toKey(new Date(e.at)))) sum += Math.max(0, e.value - previous);
      previous = e.value;
    }
  }
  return sum;
}

export function readingDays(books: Book[], days: DateKey[]): number {
  const read = new Set(books.flatMap((b) => b.progress ?? []).map((e) => toKey(new Date(e.at))));
  return days.filter((d) => read.has(d)).length;
}

export const expensesOfDays = (list: Expense[], days: DateKey[]): Expense[] => list.filter((e) => days.includes(e.date));

export function byCategory(list: Expense[]): { category: string; cents: number }[] {
  const sums = new Map<string, number>();
  for (const e of list) sums.set(e.category, (sums.get(e.category) ?? 0) + e.amountCents);
  return [...sums].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents);
}

export interface Clue {
  habit: Habit;
  done: number;
  total: number;
}

/** O hábito com melhor aproveitamento na semana até hoje. null se nada foi feito. */
export function bestClue(habits: Habit[], days: DateKey[], today: DateKey): Clue | null {
  let best: Clue | null = null;
  for (const habit of habits) {
    const past = days.filter((d) => d <= today);
    const done = habit.weeklyTimes
      ? doneInWeek(habit, days[0])
      : past.filter((d) => habit.log[d] === 'done' && isDue(habit, d)).length;
    const total = habit.weeklyTimes
      ?? past.filter((d) => isDue(habit, d) && habit.log[d] !== 'skipped').length;
    if (!done || !total) continue;
    const shown = { habit, done: Math.min(done, total), total };
    const ratio = shown.done / total;
    const top = best ? best.done / best.total : -1;
    if (ratio > top || (ratio === top && total > best!.total)) best = shown;
  }
  return best;
}
