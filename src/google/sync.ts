import { setGoogleState } from '../actions';
import { eventsOnDay, type AgendaEvent } from '../core/agenda';
import { addDays, fromKey, maxKey, todayKey, type DateKey } from '../core/dates';
import { makeHabit, newId } from '../core/defaults';
import type { CalendarLink, Frequency, Habit } from '../core/types';
import { store } from '../store';
import {
  CalendarError, deleteEvent, getEvent, insertEvent, listEvents, patchEvent, timeZone, type GEvent,
} from './calendar';
import { eligibleForSync, eventToAgenda, eventToFields, habitToNewEvent, habitToPatch, HABIT_PROP } from './mapping';

export interface SyncReport {
  created: number;
  pushed: number;
  pulled: number;
  unlinked: number;
  deleted: number;
  errors: string[];
}

const gone = (e: unknown) => e instanceof CalendarError && (e.status === 404 || e.status === 410);
const msgOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ms = (iso: string | undefined) => (iso ? Date.parse(iso) || 0 : 0);

function setLink(id: string, link: CalendarLink | null, extra: Partial<Habit> = {}) {
  store.update((s) => ({ ...s, habits: s.habits.map((h) => (h.id === id ? { ...h, ...extra, gcal: link } : h)) }));
}

async function syncHabit(h: Habit, tz: string, r: SyncReport): Promise<void> {
  /* 1) hábito ainda sem evento: cria na agenda */
  if (!h.gcal) {
    if (!eligibleForSync(h)) return;
    const ev = await insertEvent(habitToNewEvent(h, tz));
    setLink(h.id, { eventId: ev.id, origin: 'app', remoteUpdated: ms(ev.updated), syncedAt: h.updatedAt });
    r.created++;
    return;
  }

  /* 2) hábito já vinculado: compara os dois lados */
  const link = h.gcal;
  let remote: GEvent | null;
  try {
    remote = await getEvent(link.eventId);
  } catch (e) {
    if (!gone(e)) throw e;
    remote = null;
  }

  // apagado na agenda -> desfaz o vínculo (o hábito e o histórico continuam no app)
  if (!remote || remote.status === 'cancelled') {
    setLink(h.id, null, { syncToCalendar: false });
    r.unlinked++;
    return;
  }

  // sincronização desligada, sem horário ou arquivado -> solta o vínculo
  if (!eligibleForSync(h)) {
    if (link.origin === 'app') {
      await deleteEvent(link.eventId).catch((e) => { if (!gone(e)) throw e; });
      r.deleted++;
    } else {
      r.unlinked++; // evento que já existia na sua agenda nunca é apagado pelo app
    }
    setLink(h.id, null);
    return;
  }

  const remoteUpdated = ms(remote.updated);
  const remoteDirty = remoteUpdated > link.remoteUpdated;
  const localDirty = h.updatedAt > link.syncedAt;

  if (remoteDirty && (!localDirty || remoteUpdated >= h.updatedAt)) {
    // agenda -> app (quem mexeu por último vence)
    const fields = eventToFields(remote);
    if (!fields) return;
    const now = Date.now();
    store.update((s) => ({
      ...s,
      habits: s.habits.map((cur) =>
        // se o usuário editou o hábito durante a sincronização, deixa para a próxima rodada
        cur.id === h.id && cur.updatedAt === h.updatedAt
          ? { ...cur, ...fields, updatedAt: now, gcal: { ...link, remoteUpdated, syncedAt: now } }
          : cur,
      ),
    }));
    r.pulled++;
  } else if (localDirty) {
    // app -> agenda
    const res = await patchEvent(link.eventId, habitToPatch(h, remote, tz));
    setLink(h.id, { ...link, remoteUpdated: ms(res.updated), syncedAt: h.updatedAt });
    r.pushed++;
  }
}

let running: Promise<SyncReport> | null = null;

/** Sincroniza nos dois sentidos. Chamadas simultâneas compartilham a mesma execução. */
export function syncNow(): Promise<SyncReport> {
  running ??= doSync().finally(() => {
    running = null;
  });
  return running;
}

async function doSync(): Promise<SyncReport> {
  const r: SyncReport = { created: 0, pushed: 0, pulled: 0, unlinked: 0, deleted: 0, errors: [] };
  const tz = timeZone();

  // eventos de hábitos excluídos no app
  const handled: string[] = [];
  for (const id of store.get().pendingEventDeletes) {
    try {
      await deleteEvent(id);
      r.deleted++;
      handled.push(id);
    } catch (e) {
      if (gone(e)) handled.push(id);
      else r.errors.push(`Excluir evento: ${msgOf(e)}`);
    }
  }
  if (handled.length) {
    store.update((s) => ({ ...s, pendingEventDeletes: s.pendingEventDeletes.filter((x) => !handled.includes(x)) }));
  }

  for (const h of store.get().habits) {
    try {
      await syncHabit(h, tz, r);
    } catch (e) {
      r.errors.push(`${h.name}: ${msgOf(e)}`);
    }
  }

  const parts = [
    r.created && `${r.created} criado(s)`,
    r.pushed && `${r.pushed} enviado(s)`,
    r.pulled && `${r.pulled} atualizado(s) pela agenda`,
    r.deleted && `${r.deleted} removido(s)`,
    r.unlinked && `${r.unlinked} desvinculado(s)`,
  ].filter(Boolean);
  setGoogleState({
    lastSyncAt: Date.now(),
    lastSyncMessage: r.errors.length
      ? `Concluído com ${r.errors.length} erro(s): ${r.errors[0]}`
      : parts.length ? parts.join(', ') : 'Tudo em dia',
  });
  return r;
}

/* ---------- importar da agenda ---------- */

export interface ImportCandidate {
  eventId: string;
  title: string;
  time: string;
  durationMin: number;
  frequency: Frequency | null;
  targetDate: DateKey | null;
  startDate: DateKey;
  reminderMinutes: number | null;
  description: string;
}

/** Eventos recorrentes com horário que ainda não são hábitos (ex.: Pilates, Psicoterapia). */
export async function listImportCandidates(): Promise<ImportCandidate[]> {
  const now = new Date();
  const events = await listEvents({
    timeMin: now.toISOString(),
    timeMax: fromKey(addDays(todayKey(), 90)).toISOString(),
    singleEvents: 'false',
  });
  const out: ImportCandidate[] = [];
  for (const ev of events) {
    if (ev.status === 'cancelled' || ev.recurringEventId || !ev.recurrence?.length) continue;
    if (ev.extendedProperties?.private?.[HABIT_PROP]) continue;
    const f = eventToFields(ev);
    if (!f || !f.time) continue;
    out.push({
      eventId: ev.id,
      title: f.name,
      time: f.time,
      durationMin: f.durationMin,
      frequency: f.frequency ?? null,
      targetDate: f.targetDate ?? null,
      startDate: ev.start!.dateTime!.slice(0, 10),
      reminderMinutes: f.reminderMinutes,
      description: f.description,
    });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/** Cria um hábito a partir de um evento e marca o evento como vinculado (sem alterar o resto dele). */
export async function adoptCandidate(c: ImportCandidate, categoryId: string): Promise<Habit> {
  const id = newId();
  const res = await patchEvent(c.eventId, { extendedProperties: { private: { [HABIT_PROP]: id } } });
  const base = makeHabit({
    id,
    name: c.title,
    description: c.description,
    categoryId,
    time: c.time,
    durationMin: c.durationMin,
    frequency: c.frequency ?? { type: 'daily' },
    targetDate: c.targetDate,
    // o histórico começa hoje: não cria "faltas" retroativas de uma série antiga
    startDate: maxKey(c.startDate, todayKey()),
    reminderMinutes: c.reminderMinutes,
    syncToCalendar: true,
  });
  const habit: Habit = { ...base, gcal: { eventId: c.eventId, origin: 'adopted', remoteUpdated: ms(res.updated), syncedAt: base.updatedAt } };
  store.update((s) => ({ ...s, habits: [...s.habits, habit] }));
  return habit;
}

/* ---------- agenda (dia e mês) ---------- */

/** Eventos entre duas datas (inclusive), já expandidos (recorrências viram uma linha por dia). */
export async function listRangeEvents(from: DateKey, to: DateKey): Promise<AgendaEvent[]> {
  const events = await listEvents({
    timeMin: fromKey(from).toISOString(),
    timeMax: fromKey(addDays(to, 1)).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  return events.map(eventToAgenda).filter((e): e is AgendaEvent => e !== null);
}

export interface DayEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  linkedHabitId: string | null;
}

export async function listDayEvents(day: DateKey): Promise<DayEvent[]> {
  const events = eventsOnDay(await listRangeEvents(day, day), day);
  return events.map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end, linkedHabitId: e.linkedHabitId }));
}
