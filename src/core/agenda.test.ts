import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayItems, eventsOnDay, type AgendaEvent } from './agenda';
import { makeHabit, makeTask } from './defaults';

const TODAY = '2026-11-11'; // quarta
const ev = (p: Partial<AgendaEvent>): AgendaEvent => ({
  id: 'e', title: 'Evento', allDay: false, startDate: '2026-11-11', endDate: '2026-11-11', start: '10:00', end: '11:00', linkedHabitId: null, ...p,
});

test('evento de vários dias aparece em todos os dias do intervalo', () => {
  const e = ev({ allDay: true, startDate: '2026-11-08', endDate: '2026-11-14', start: null, end: null });
  assert.equal(eventsOnDay([e], '2026-11-08').length, 1);
  assert.equal(eventsOnDay([e], '2026-11-14').length, 1);
  assert.equal(eventsOnDay([e], '2026-11-15').length, 0);
  assert.equal(eventsOnDay([e], '2026-11-07').length, 0);
});

test('ordem do dia: dia inteiro, itens com horário misturados, hábitos sem horário, tarefas', () => {
  const allDay = ev({ id: 'a', title: 'Banco de horas', allDay: true, start: null, end: null });
  const noon = ev({ id: 'n', title: 'Almoço', start: '12:00' });
  const morning = makeHabit({ id: 'h1', name: 'Pilates', time: '09:00', startDate: '2026-01-01' });
  const anytime = makeHabit({ id: 'h2', name: 'Água', time: null, startDate: '2026-01-01' });
  const task = makeTask({ id: 't', title: 'Pão', dueDate: '2026-11-11' });
  const items = dayItems('2026-11-11', TODAY, [noon, allDay], [anytime, morning], [task]);
  assert.deepEqual(
    items.map((i) => (i.kind === 'event' ? `e:${i.event.id}` : i.kind === 'habit' ? `h:${i.habit.id}` : `t:${i.task.id}`)),
    ['e:a', 'h:h1', 'e:n', 'h:h2', 't:t'],
  );
});

test('evento vinculado a hábito existente não duplica; vinculado a hábito apagado aparece', () => {
  const h = makeHabit({ id: 'h1', time: '09:00', startDate: '2026-01-01' });
  const linked = ev({ id: 'x', linkedHabitId: 'h1', start: '09:00' });
  const orphan = ev({ id: 'y', linkedHabitId: 'apagado', start: '15:00' });
  const items = dayItems('2026-11-11', TODAY, [linked, orphan], [h], []);
  assert.deepEqual(items.map((i) => (i.kind === 'event' ? i.event.id : 'habit')), ['habit', 'y']);
});

test('hábito aparece só nos dias previstos e com o status certo; arquivado some', () => {
  const h = makeHabit({ id: 'h1', startDate: '2026-11-02', frequency: { type: 'weekdays', days: [3] }, log: { '2026-11-04': 'done' } });
  const arch = makeHabit({ id: 'h2', archived: true });
  const at = (k: string) => dayItems(k, TODAY, [], [h, arch], []);
  assert.equal(at('2026-11-10').length, 0); // terça
  const wed4 = at('2026-11-04')[0];
  assert.ok(wed4.kind === 'habit' && wed4.status === 'done');
  const wed11 = at('2026-11-11')[0];
  assert.ok(wed11.kind === 'habit' && wed11.status === 'pending');
  const wed18 = at('2026-11-18')[0];
  assert.ok(wed18.kind === 'habit' && wed18.status === 'pending');
  const missed = dayItems('2026-11-04', TODAY, [], [makeHabit({ id: 'm', startDate: '2026-11-02', frequency: { type: 'weekdays', days: [3] } })], []);
  assert.ok(missed[0].kind === 'habit' && missed[0].status === 'missed');
});
