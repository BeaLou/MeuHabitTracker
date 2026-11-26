import type { DateKey } from './dates';
import type { DayStatus, Habit } from './types';

/** Quantidade do dia. Dias concluídos antes de o hábito ter meta contam como meta cheia. */
export function amountOf(h: Habit, key: DateKey): number {
  return h.amounts?.[key] ?? (h.log[key] === 'done' ? h.goal?.target ?? 0 : 0);
}

function withStatus(h: Habit, key: DateKey, status: DayStatus | null, now: number): Habit {
  const log = { ...h.log };
  if (status) log[key] = status;
  else delete log[key];
  return { ...h, log, logAt: { ...h.logAt, [key]: now } };
}

const withAmount = (h: Habit, key: DateKey, amount: number, now: number): Habit => ({
  ...h,
  amounts: { ...h.amounts, [key]: amount },
  amountsAt: { ...h.amountsAt, [key]: now },
});

/** Marca o dia; em hábitos com meta, a quantidade acompanha (concluir completa, desmarcar zera). */
export function applyStatus(h: Habit, key: DateKey, status: DayStatus | null, now: number): Habit {
  const next = withStatus(h, key, status, now);
  if (!h.goal) return next;
  if (status === 'done') return withAmount(next, key, Math.max(amountOf(h, key), h.goal.target), now);
  return status === null ? withAmount(next, key, 0, now) : next;
}

/** Um toque no hábito com meta: soma um passo; se já estava concluído, desfaz um passo. */
export function tapGoal(h: Habit, key: DateKey, now: number): Habit {
  if (!h.goal) return h;
  const { target, step } = h.goal;
  const current = Math.min(amountOf(h, key), target);
  const amount = h.log[key] === 'done' ? Math.max(0, current - step) : Math.min(target, current + step);
  return withStatus(withAmount(h, key, amount, now), key, amount >= target ? 'done' : null, now);
}
