import { addDays, diffDays, eachDay, startOfWeek, weekday, type DateKey } from './dates';
import type { DayStatus, Frequency, Habit } from './types';

export type CellStatus = 'done' | 'skipped' | 'missed' | 'pending' | 'off';

export interface HabitStats {
  /** 0–100, média exponencial (hábitos recentes pesam mais). */
  score: number;
  /** 0–100, concluídos / (concluídos + perdidos) desde o início. */
  rate: number;
  currentStreak: number;
  bestStreak: number;
  doneWeek: number;
  doneMonth: number;
  doneYear: number;
  doneTotal: number;
}

export function frequencyIncludes(freq: Frequency, day: number): boolean {
  return freq.type === 'daily' || freq.days.includes(day);
}

export function frequencyLabel(freq: Frequency): string {
  if (freq.type === 'daily') return 'Todos os dias';
  const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  return [...freq.days].sort((a, b) => a - b).map((d) => names[d]).join(', ') || 'Nenhum dia';
}

/** O hábito está previsto para esse dia? (considera início, meta final e frequência) */
export function isDue(h: Habit, key: DateKey): boolean {
  if (key < h.startDate) return false;
  if (h.targetDate && key > h.targetDate) return false;
  return frequencyIncludes(h.frequency, weekday(key));
}

export function cellStatus(h: Habit, key: DateKey, today: DateKey): CellStatus {
  const logged = h.log[key];
  if (logged) return logged;
  if (!isDue(h, key)) return 'off';
  return key < today ? 'missed' : 'pending';
}

/** Ciclo do toque: nada → concluído → pulado → nada */
export function nextStatus(current: DayStatus | undefined): DayStatus | null {
  if (!current) return 'done';
  if (current === 'done') return 'skipped';
  return null;
}

export function computeStats(h: Habit, today: DateKey): HabitStats {
  const m = Math.pow(0.5, 1 / 13); // meia-vida de ~13 ocorrências
  const logKeys = Object.keys(h.log).sort();
  let from = h.startDate;
  if (logKeys.length && logKeys[0] < from) from = logKeys[0];

  const weekStart = startOfWeek(today);
  const monthPrefix = today.slice(0, 7);
  const yearPrefix = today.slice(0, 4);

  let score = 0;
  let current = 0;
  let best = 0;
  let done = 0;
  let missed = 0;
  let doneWeek = 0;
  let doneMonth = 0;
  let doneYear = 0;

  if (from <= today) {
    for (const key of eachDay(from, today)) {
      const st = h.log[key];
      if (st === 'done') {
        done++;
        current++;
        if (current > best) best = current;
        score = score * m + (1 - m);
        if (key >= weekStart) doneWeek++;
        if (key.startsWith(monthPrefix)) doneMonth++;
        if (key.startsWith(yearPrefix)) doneYear++;
      } else if (st === 'skipped') {
        // neutro: não quebra a sequência nem mexe na pontuação
      } else if (isDue(h, key) && key < today) {
        missed++;
        current = 0;
        score = score * m;
      }
      // hoje pendente: ainda não penaliza
    }
  }

  const total = done + missed;
  return {
    score: Math.round(score * 100),
    rate: total === 0 ? 0 : Math.round((done / total) * 100),
    currentStreak: current,
    bestStreak: best,
    doneWeek,
    doneMonth,
    doneYear,
    doneTotal: done,
  };
}

/** Os 7 dias terminando em `endKey` (ordem cronológica). */
export function lastSevenDays(endKey: DateKey): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(endKey, i - 6));
}

export function daysSinceStart(h: Habit, today: DateKey): number {
  return Math.max(0, diffDays(h.startDate, today));
}

export const diasLabel = (n: number): string => `${n} ${n === 1 ? 'dia' : 'dias'}`;
