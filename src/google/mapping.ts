import type { AgendaEvent } from '../core/agenda';
import { addDays, fromKey, toKey, type DateKey } from '../core/dates';
import type { Habit } from '../core/types';
import type { GEvent } from './calendar';
import { firstOccurrence, frequencyToRRule, parseRRule } from './rrule';

export const HABIT_PROP = 'ritmoHabitId';

const pad = (n: number) => String(n).padStart(2, '0');

/** Só hábitos com horário, marcados para sincronizar e não arquivados vão para a agenda. */
export function eligibleForSync(h: Habit): boolean {
  return h.syncToCalendar && !!h.time && !h.archived;
}

function localDateTime(date: DateKey, time: string, addMinutes = 0): string {
  const d = fromKey(date);
  const [hh, mm] = time.split(':').map(Number);
  d.setHours(hh, mm + addMinutes, 0, 0);
  return `${toKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function remindersFor(h: Habit): GEvent['reminders'] {
  return h.reminderMinutes == null
    ? { useDefault: true }
    : { useDefault: false, overrides: [{ method: 'popup', minutes: h.reminderMinutes }] };
}

/** Corpo para criar o evento recorrente de um hábito novo na agenda. */
export function habitToNewEvent(h: Habit, tz: string): Partial<GEvent> {
  const date = firstOccurrence(h.frequency, h.startDate);
  const time = h.time!;
  return {
    summary: h.name,
    description: h.description || undefined,
    start: { dateTime: localDateTime(date, time), timeZone: tz },
    end: { dateTime: localDateTime(date, time, h.durationMin), timeZone: tz },
    recurrence: [frequencyToRRule(h.frequency, h.targetDate)],
    reminders: remindersFor(h),
    extendedProperties: { private: { [HABIT_PROP]: h.id } },
  };
}

/**
 * Corpo para atualizar um evento já existente. Mantém a DATA de início original do evento
 * (para não apagar o histórico de uma série antiga) e só troca horário, título, regra e lembrete.
 */
export function habitToPatch(h: Habit, remote: GEvent, tz: string): Partial<GEvent> {
  const originalDate = (remote.start?.dateTime ?? remote.start?.date ?? h.startDate).slice(0, 10);
  const time = h.time!;
  return {
    summary: h.name,
    description: h.description,
    start: { dateTime: localDateTime(originalDate, time), timeZone: remote.start?.timeZone ?? tz },
    end: { dateTime: localDateTime(originalDate, time, h.durationMin), timeZone: remote.end?.timeZone ?? tz },
    recurrence: [frequencyToRRule(h.frequency, h.targetDate)],
    reminders: remindersFor(h),
    extendedProperties: { private: { [HABIT_PROP]: h.id } },
  };
}

export interface EventFields {
  name: string;
  description: string;
  time: string | null;
  durationMin: number;
  reminderMinutes: number | null;
  frequency?: Habit['frequency'];
  targetDate?: DateKey | null;
}

/** Lê um evento da agenda no formato do hábito. Campos que o app não entende ficam de fora. */
export function eventToFields(ev: GEvent): EventFields | null {
  const startStr = ev.start?.dateTime;
  const endStr = ev.end?.dateTime;
  if (!startStr) return null; // eventos de dia inteiro não viram hábitos
  const durationMin = endStr ? Math.max(5, Math.round((Date.parse(endStr) - Date.parse(startStr)) / 60000)) : 30;
  const popup = ev.reminders?.overrides?.find((o) => o.method === 'popup');
  const rule = parseRRule(ev.recurrence, startStr.slice(0, 10));
  return {
    name: ev.summary?.trim() || 'Sem título',
    description: ev.description ?? '',
    time: startStr.slice(11, 16),
    durationMin,
    reminderMinutes: ev.reminders?.useDefault === false && popup ? popup.minutes : null,
    ...(rule ? { frequency: rule.frequency, targetDate: rule.targetDate } : {}),
  };
}

/** Evento do Google -> item de exibição na Agenda do app. */
export function eventToAgenda(ev: GEvent): AgendaEvent | null {
  if (ev.status === 'cancelled') return null;
  const title = ev.summary?.trim() || '(sem título)';
  const linkedHabitId = ev.extendedProperties?.private?.[HABIT_PROP] ?? null;
  if (ev.start?.dateTime) {
    const startDate = ev.start.dateTime.slice(0, 10);
    return {
      id: ev.id, title, allDay: false, startDate, endDate: startDate, linkedHabitId,
      start: ev.start.dateTime.slice(11, 16), end: ev.end?.dateTime ? ev.end.dateTime.slice(11, 16) : null,
    };
  }
  if (ev.start?.date) {
    const startDate = ev.start.date;
    // no Google, o fim de eventos de dia inteiro é exclusivo
    const last = ev.end?.date ? addDays(ev.end.date, -1) : startDate;
    return { id: ev.id, title, allDay: true, startDate, endDate: last < startDate ? startDate : last, start: null, end: null, linkedHabitId };
  }
  return null;
}
