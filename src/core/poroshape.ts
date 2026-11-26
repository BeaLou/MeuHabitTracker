import { addDays, type DateKey } from './dates';
import { amountOf, applyStatus } from './goals';
import type { Habit, PoSource } from './types';

export const PO_SOURCES: { id: PoSource; label: string }[] = [
  { id: 'workout', label: 'Treino registrado' },
  { id: 'cardio', label: 'Cardio (minutos)' },
  { id: 'photo', label: 'Foto salva no dia' },
  { id: 'water', label: 'Check-in: água em dia' },
  { id: 'protein', label: 'Check-in: proteína em todas as refeições' },
  { id: 'sleep', label: 'Check-in: sono de 7 a 8 h' },
  { id: 'meals', label: 'Check-in: refeições conforme o plano' },
  { id: 'move', label: 'Check-in: caminhada ou bike além do treino' },
  { id: 'steps', label: 'Passos' },
];

/** Dias (contando hoje) que são conferidos a cada leitura. */
export const PO_WINDOW = 7;
/** Sem meta em quantidade, "Passos" conclui a partir daqui (a referência do Por o Shape é 7 a 10 mil). */
const MIN_STEPS = 7000;

/** Séries de cada treino. Cópia de js/plan.js do Por o Shape: atualizar se o plano mudar. */
const TOTAL_SETS: Record<string, number> = { A: 20, B: 16, C: 16, D: 11 };

/** Registro do banco do Por o Shape (coleção, id e dados). */
export interface PoRecord {
  col: string;
  id: string;
  data: {
    date?: string;
    day?: string;
    min?: unknown;
    ex?: Record<string, { done?: unknown[] }>;
    [key: string]: unknown;
  };
}

/** Mesmo critério do Por o Shape: versão mínima ou pelo menos metade das séries. */
function counted(s: PoRecord['data']): boolean {
  if (s.min) return true;
  const total = TOTAL_SETS[s.day ?? ''];
  if (!total) return false;
  const done = Object.values(s.ex ?? {}).reduce((n, r) => n + (r.done ?? []).filter(Boolean).length, 0);
  return done / total >= 0.5;
}

/** Valor da fonte no dia: minutos de cardio, passos, ou 1/0 para o resto. */
export function poValue(records: PoRecord[], source: PoSource, key: DateKey): number {
  const of = (col: string) => records.filter((r) => r.col === col);
  if (source === 'workout') return of('sessions').some((r) => r.data.date === key && counted(r.data)) ? 1 : 0;
  if (source === 'photo') return of('photos').some((r) => r.data.date === key) ? 1 : 0;
  if (source === 'cardio') return of('cardio').filter((r) => r.data.date === key).reduce((n, r) => n + (Number(r.data.min) || 0), 0);
  const checkin = of('days').find((r) => r.id === key)?.data[source];
  return source === 'steps' ? Number(checkin) || 0 : checkin ? 1 : 0;
}

function importDay(h: Habit, source: PoSource, key: DateKey, value: number, now: number): Habit {
  const seenKey = `${source}:${key}`;
  // só age quando há novidade; assim, o que for desmarcado no Ritmo continua desmarcado
  if (value <= (h.linkSeen?.[seenKey] ?? 0) || h.log[key] === 'skipped') return h;
  const measured = source === 'cardio' || source === 'steps';
  const seen = { ...h.linkSeen, [seenKey]: value };
  if (h.goal && measured) {
    const amount = Math.max(amountOf(h, key), Math.min(value, h.goal.target));
    const next: Habit = { ...h, linkSeen: seen };
    if (amount === amountOf(h, key)) return next;
    const withAmount = { ...next, amounts: { ...h.amounts, [key]: amount }, amountsAt: { ...h.amountsAt, [key]: now } };
    return amount >= h.goal.target ? applyStatus(withAmount, key, 'done', now) : withAmount;
  }
  if (source === 'steps' && value < MIN_STEPS) return h;
  const next: Habit = { ...h, linkSeen: seen };
  return h.log[key] === 'done' ? next : applyStatus(next, key, 'done', now);
}

/** Aplica os registros aos hábitos vinculados. Só marca, nunca desmarca. Devolve a mesma lista se nada mudar. */
export function importFromPo(habits: Habit[], records: PoRecord[], today: DateKey, now: number): Habit[] {
  let changed = false;
  const out = habits.map((habit) => {
    const source = habit.link;
    if (!source || habit.archived) return habit;
    let h = habit;
    for (let i = PO_WINDOW - 1; i >= 0; i--) {
      const key = addDays(today, -i);
      if (key < h.startDate || (h.targetDate && key > h.targetDate)) continue;
      h = importDay(h, source, key, poValue(records, source, key), now);
    }
    if (h !== habit) changed = true;
    return h;
  });
  return changed ? out : habits;
}
