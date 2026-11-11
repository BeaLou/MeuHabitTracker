/** Datas locais como chave "YYYY-MM-DD" (sem fuso, sem surpresas de horário de verão). */
export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(k: DateKey): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = (): DateKey => toKey(new Date());

export function addDays(k: DateKey, n: number): DateKey {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** Quantidade de dias de a até b (b - a). */
export function diffDays(a: DateKey, b: DateKey): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/** 0 = domingo … 6 = sábado */
export function weekday(k: DateKey): number {
  return fromKey(k).getDay();
}

export function startOfWeek(k: DateKey): DateKey {
  return addDays(k, -weekday(k));
}

export function maxKey(a: DateKey, b: DateKey): DateKey {
  return a >= b ? a : b;
}

/** Dias de `from` até `to`, inclusive. */
export function eachDay(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

/** Grade de 6 semanas (42 dias) começando no domingo, para o mês informado (month0 = 0..11). */
export function monthGrid(year: number, month0: number): DateKey[] {
  const first = toKey(new Date(year, month0, 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function addMonths(year: number, month0: number, delta: number): { year: number; month0: number } {
  const d = new Date(year, month0 + delta, 1);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

export function dayNumber(k: DateKey): number {
  return Number(k.slice(8, 10));
}

export function formatLong(k: DateKey): string {
  const d = fromKey(k);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;
}

export function formatBR(k: DateKey): string {
  const [y, m, d] = k.split('-');
  return `${d}/${m}/${y}`;
}

export function nowTimeKey(d = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "HH:mm" -> minutos desde 00:00 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
