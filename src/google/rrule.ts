import { addDays, fromKey, toKey, weekday, type DateKey } from '../core/dates';
import { frequencyIncludes } from '../core/habits';
import type { Frequency } from '../core/types';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Frequência do hábito -> linha RRULE do Google Agenda. */
export function frequencyToRRule(freq: Frequency, targetDate: DateKey | null): string {
  let rule = freq.type === 'daily'
    ? 'RRULE:FREQ=DAILY'
    : `RRULE:FREQ=WEEKLY;BYDAY=${[...freq.days].sort((a, b) => a - b).map((d) => BYDAY[d]).join(',')}`;
  if (targetDate) {
    // UNTIL de evento com horário precisa estar em UTC: usamos o fim do dia local
    const end = fromKey(targetDate);
    end.setHours(23, 59, 59, 0);
    rule += `;UNTIL=${utcStamp(end)}`;
  }
  return rule;
}

/** Primeiro dia (a partir de `from`) em que a frequência cai — usado como início do evento. */
export function firstOccurrence(freq: Frequency, from: DateKey): DateKey {
  for (let i = 0; i < 7; i++) {
    const k = addDays(from, i);
    if (frequencyIncludes(freq, weekday(k))) return k;
  }
  return from;
}

export interface ParsedRule {
  frequency: Frequency;
  targetDate: DateKey | null;
}

/**
 * RRULE do Google -> frequência do app. Só entende o que o app consegue representar
 * (diário, ou semanal em dias fixos, sem INTERVAL > 1). Retorna null no resto.
 */
export function parseRRule(recurrence: string[] | undefined, eventStartKey: DateKey): ParsedRule | null {
  const line = recurrence?.find((r) => r.startsWith('RRULE:'));
  if (!line) return null;
  const parts = Object.fromEntries(
    line.slice('RRULE:'.length).split(';').map((kv) => {
      const [k, v] = kv.split('=');
      return [k, v ?? ''];
    }),
  ) as Record<string, string>;

  if (parts.INTERVAL && parts.INTERVAL !== '1') return null;
  if (parts.COUNT) return null;

  let targetDate: DateKey | null = null;
  if (parts.UNTIL) {
    const u = parts.UNTIL;
    if (/^\d{8}T\d{6}Z$/.test(u)) {
      const iso = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}T${u.slice(9, 11)}:${u.slice(11, 13)}:${u.slice(13, 15)}Z`;
      targetDate = toKey(new Date(iso));
    } else if (/^\d{8}$/.test(u)) {
      targetDate = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`;
    }
  }

  if (parts.FREQ === 'DAILY') return { frequency: { type: 'daily' }, targetDate };
  if (parts.FREQ === 'WEEKLY') {
    const days = parts.BYDAY
      ? parts.BYDAY.split(',').map((d) => BYDAY.indexOf(d.replace(/^[-+]?\d+/, '')))
      : [weekday(eventStartKey)];
    if (days.some((d) => d < 0)) return null;
    return { frequency: { type: 'weekdays', days: [...new Set(days)].sort((a, b) => a - b) }, targetDate };
  }
  return null;
}
