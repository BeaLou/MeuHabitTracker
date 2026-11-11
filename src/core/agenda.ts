import type { DateKey } from './dates';
import { cellStatus, isDue, type CellStatus } from './habits';
import type { Habit, Task } from './types';

/** Evento do Google Agenda já simplificado para exibição. */
export interface AgendaEvent {
  id: string;
  title: string;
  allDay: boolean;
  startDate: DateKey;
  /** Último dia do evento (inclusive). Eventos com horário ficam no dia em que começam. */
  endDate: DateKey;
  /** "HH:mm" ou null (dia inteiro) */
  start: string | null;
  end: string | null;
  linkedHabitId: string | null;
}

export type DayItem =
  | { kind: 'event'; event: AgendaEvent }
  | { kind: 'habit'; habit: Habit; status: CellStatus }
  | { kind: 'task'; task: Task };

/** Eventos que acontecem em `key` (inclui os de vários dias). */
export function eventsOnDay(events: AgendaEvent[], key: DateKey): AgendaEvent[] {
  return events.filter((e) => e.startDate <= key && key <= e.endDate);
}

/**
 * Tudo o que aparece num dia do calendário, em ordem:
 * eventos de dia inteiro, depois itens com horário (eventos e hábitos misturados por hora),
 * depois hábitos sem horário e, por fim, tarefas com data nesse dia.
 * Eventos vinculados a um hábito existente não aparecem (o hábito já representa o evento).
 */
export function dayItems(key: DateKey, today: DateKey, events: AgendaEvent[], habits: Habit[], tasks: Task[]): DayItem[] {
  const habitIds = new Set(habits.map((h) => h.id));
  const evs = eventsOnDay(events, key).filter((e) => !(e.linkedHabitId && habitIds.has(e.linkedHabitId)));

  const allDay: DayItem[] = evs.filter((e) => e.allDay).map((event) => ({ kind: 'event', event }));

  const timed: { sort: string; item: DayItem }[] = [];
  for (const event of evs.filter((e) => !e.allDay)) timed.push({ sort: event.start ?? '99:99', item: { kind: 'event', event } });

  const untimed: DayItem[] = [];
  const dueHabits = habits.filter((h) => !h.archived && isDue(h, key)).sort((a, b) => b.priority - a.priority);
  for (const habit of dueHabits) {
    const item: DayItem = { kind: 'habit', habit, status: cellStatus(habit, key, today) };
    if (habit.time) timed.push({ sort: habit.time, item });
    else untimed.push(item);
  }
  timed.sort((a, b) => a.sort.localeCompare(b.sort));

  const dayTasks: DayItem[] = tasks
    .filter((t) => t.dueDate === key)
    .sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority)
    .map((task) => ({ kind: 'task', task }));

  return [...allDay, ...timed.map((t) => t.item), ...untimed, ...dayTasks];
}

/** Janela de datas que a grade do mês precisa carregar. */
export function gridRange(grid: DateKey[]): { from: DateKey; to: DateKey } {
  return { from: grid[0], to: grid[grid.length - 1] };
}
