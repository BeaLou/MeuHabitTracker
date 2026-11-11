import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeHabit } from '../core/defaults';
import type { GEvent } from './calendar';
import { eligibleForSync, eventToFields, habitToNewEvent, habitToPatch, HABIT_PROP } from './mapping';

const TZ = 'America/Sao_Paulo';

test('hábito vira evento recorrente com marca de vínculo', () => {
  const h = makeHabit({
    id: 'h1', name: 'Pilates', time: '09:00', durationMin: 60, startDate: '2026-11-06',
    frequency: { type: 'weekdays', days: [1, 3] }, reminderMinutes: 30,
  });
  const ev = habitToNewEvent(h, TZ);
  assert.equal(ev.summary, 'Pilates');
  // 06/11 é sexta; primeira ocorrência real é segunda, 09/11
  assert.equal(ev.start?.dateTime, '2026-11-09T09:00:00');
  assert.equal(ev.end?.dateTime, '2026-11-09T10:00:00');
  assert.deepEqual(ev.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE']);
  assert.deepEqual(ev.reminders, { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] });
  assert.equal(ev.extendedProperties?.private?.[HABIT_PROP], 'h1');
});

test('duração que atravessa a meia-noite vira o dia seguinte', () => {
  const h = makeHabit({ id: 'h2', time: '23:30', durationMin: 60, startDate: '2026-11-06' });
  const ev = habitToNewEvent(h, TZ);
  assert.equal(ev.end?.dateTime, '2026-11-07T00:30:00');
});

test('sem lembrete próprio usa o padrão da agenda', () => {
  const h = makeHabit({ id: 'h3', time: '08:00' });
  assert.deepEqual(habitToNewEvent(h, TZ).reminders, { useDefault: true });
});

test('atualização preserva a data de início original da série', () => {
  const h = makeHabit({ id: 'h4', time: '18:30', durationMin: 45, startDate: '2026-11-06' });
  const remote: GEvent = { id: 'e1', start: { dateTime: '2024-03-04T09:00:00-03:00', timeZone: TZ }, end: { dateTime: '2024-03-04T10:00:00-03:00', timeZone: TZ } };
  const patch = habitToPatch(h, remote, TZ);
  assert.equal(patch.start?.dateTime, '2024-03-04T18:30:00');
  assert.equal(patch.end?.dateTime, '2024-03-04T19:15:00');
});

test('evento da agenda vira campos de hábito (ida e volta)', () => {
  const ev: GEvent = {
    id: 'e2',
    summary: 'Psicoterapia',
    start: { dateTime: '2026-11-04T17:00:00-03:00' },
    end: { dateTime: '2026-11-04T18:00:00-03:00' },
    recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=WE'],
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] },
  };
  const f = eventToFields(ev)!;
  assert.equal(f.name, 'Psicoterapia');
  assert.equal(f.time, '17:00');
  assert.equal(f.durationMin, 60);
  assert.equal(f.reminderMinutes, 15);
  assert.deepEqual(f.frequency, { type: 'weekdays', days: [3] });
});

test('evento de dia inteiro não vira hábito; regra desconhecida não troca a frequência', () => {
  assert.equal(eventToFields({ id: 'e3', summary: 'Banco de horas', start: { date: '2026-12-20' }, end: { date: '2026-12-27' } }), null);
  const f = eventToFields({
    id: 'e4', summary: 'Mensal', start: { dateTime: '2026-11-05T10:00:00-03:00' }, end: { dateTime: '2026-11-05T10:30:00-03:00' },
    recurrence: ['RRULE:FREQ=MONTHLY'],
  })!;
  assert.equal('frequency' in f, false);
});

test('elegibilidade: precisa de horário, ligar a sincronização e não estar arquivado', () => {
  assert.equal(eligibleForSync(makeHabit({ syncToCalendar: true, time: '09:00' })), true);
  assert.equal(eligibleForSync(makeHabit({ syncToCalendar: true, time: null })), false);
  assert.equal(eligibleForSync(makeHabit({ syncToCalendar: false, time: '09:00' })), false);
  assert.equal(eligibleForSync(makeHabit({ syncToCalendar: true, time: '09:00', archived: true })), false);
});

import { eventToAgenda } from './mapping';

test('eventToAgenda: dia inteiro tem fim exclusivo no Google (vira inclusivo)', () => {
  const a = eventToAgenda({ id: 'a', summary: 'Banco de horas', start: { date: '2026-12-20' }, end: { date: '2026-12-27' } })!;
  assert.equal(a.allDay, true);
  assert.equal(a.startDate, '2026-12-20');
  assert.equal(a.endDate, '2026-12-26');
  const one = eventToAgenda({ id: 'b', start: { date: '2026-11-05' }, end: { date: '2026-11-06' } })!;
  assert.equal(one.endDate, '2026-11-05');
  assert.equal(one.title, '(sem título)');
});

test('eventToAgenda: com horário, cancelado e vínculo', () => {
  const t = eventToAgenda({
    id: 'c', summary: 'Pilates', start: { dateTime: '2026-11-09T09:00:00-03:00' }, end: { dateTime: '2026-11-09T10:00:00-03:00' },
    extendedProperties: { private: { ritmoHabitId: 'h1' } },
  })!;
  assert.deepEqual([t.allDay, t.start, t.end, t.startDate, t.endDate, t.linkedHabitId], [false, '09:00', '10:00', '2026-11-09', '2026-11-09', 'h1']);
  assert.equal(eventToAgenda({ id: 'd', status: 'cancelled', start: { date: '2026-11-05' } }), null);
});
