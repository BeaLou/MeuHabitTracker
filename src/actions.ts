import { todayKey, type DateKey } from './core/dates';
import { createInitialState, exampleHabits, makeHabit, makeTask, newId } from './core/defaults';
import { nextStatus } from './core/habits';
import type { AppState, Category, DayStatus, Habit, Task } from './core/types';
import { store } from './store';

const touch = <T extends { updatedAt: number }>(x: T, patch: Partial<T>): T => ({ ...x, ...patch, updatedAt: Date.now() });

/* ---------- hábitos ---------- */

export function addHabit(input: Partial<Habit>): Habit {
  const habit = makeHabit(input);
  store.update((s) => ({ ...s, habits: [...s.habits, habit] }));
  return habit;
}

export function updateHabit(id: string, patch: Partial<Habit>) {
  store.update((s) => ({ ...s, habits: s.habits.map((h) => (h.id === id ? touch(h, patch) : h)) }));
}

export function removeHabit(id: string) {
  store.update((s) => {
    const h = s.habits.find((x) => x.id === id);
    // só apaga da agenda o que o próprio app criou; eventos "adotados" continuam na sua agenda
    const pending = h?.gcal?.origin === 'app' ? [...s.pendingEventDeletes, h.gcal.eventId] : s.pendingEventDeletes;
    return {
      ...s,
      habits: s.habits.filter((x) => x.id !== id),
      pendingEventDeletes: pending,
      tombstones: { ...s.tombstones, [id]: Date.now() },
    };
  });
}

export function setDayStatus(id: string, key: DateKey, status: DayStatus | null) {
  store.update((s) => ({
    ...s,
    habits: s.habits.map((h) => {
      if (h.id !== id) return h;
      const log = { ...h.log };
      if (status) log[key] = status;
      else delete log[key];
      // marcar um dia não é "edição do hábito": não mexe em updatedAt (não dispara a agenda),
      // mas o carimbo do dia permite juntar com outros aparelhos, inclusive ao desmarcar
      return { ...h, log, logAt: { ...h.logAt, [key]: Date.now() } };
    }),
  }));
}

export function cycleDay(id: string, key: DateKey) {
  const h = store.get().habits.find((x) => x.id === id);
  if (!h) return;
  setDayStatus(id, key, nextStatus(h.log[key]));
}

export function setNote(id: string, key: DateKey, text: string) {
  store.update((s) => ({
    ...s,
    habits: s.habits.map((h) => {
      if (h.id !== id) return h;
      const notes = { ...h.notes };
      if (text.trim()) notes[key] = text;
      else delete notes[key];
      return { ...h, notes, notesAt: { ...h.notesAt, [key]: Date.now() } };
    }),
  }));
}

export function addExamples() {
  store.update((s) => ({ ...s, habits: [...s.habits, ...exampleHabits()] }));
}

/* ---------- tarefas ---------- */

export function addTask(input: Partial<Task>): Task {
  const task = makeTask(input);
  store.update((s) => ({ ...s, tasks: [...s.tasks, task] }));
  return task;
}

export function updateTask(id: string, patch: Partial<Task>) {
  store.update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? touch(t, patch) : t)) }));
}

export function toggleTask(id: string) {
  const t = store.get().tasks.find((x) => x.id === id);
  if (!t) return;
  updateTask(id, { done: !t.done, doneAt: t.done ? null : Date.now() });
}

export function removeTask(id: string) {
  store.update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id), tombstones: { ...s.tombstones, [id]: Date.now() } }));
}

/* ---------- categorias ---------- */

export function addCategory(input: Omit<Category, 'id'>): Category {
  const cat = { ...input, id: newId(), updatedAt: Date.now() };
  store.update((s) => ({ ...s, categories: [...s.categories, cat] }));
  return cat;
}

export function updateCategory(id: string, patch: Partial<Omit<Category, 'id'>>) {
  store.update((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)) }));
}

/** Remove a categoria e move seus hábitos/tarefas para a primeira categoria restante. */
export function removeCategory(id: string): boolean {
  const s = store.get();
  if (s.categories.length <= 1) return false;
  const fallback = s.categories.find((c) => c.id !== id)!.id;
  const now = Date.now();
  store.update((st) => ({
    ...st,
    categories: st.categories.filter((c) => c.id !== id),
    habits: st.habits.map((h) => (h.categoryId === id ? { ...h, categoryId: fallback, updatedAt: now } : h)),
    tasks: st.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: fallback, updatedAt: now } : t)),
    tombstones: { ...st.tombstones, [id]: now },
  }));
  return true;
}

/* ---------- timer de foco ---------- */

export function startTimer(totalSec: number, habitId: string | null, markDoneOnFinish: boolean) {
  store.update((s) => ({
    ...s,
    timer: { status: 'running', totalSec, endsAt: Date.now() + totalSec * 1000, remainingSec: null, habitId, markDoneOnFinish },
  }));
}

export function pauseTimer() {
  store.update((s) => {
    const t = s.timer;
    if (t.status !== 'running' || t.endsAt == null) return s;
    const remaining = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
    return { ...s, timer: { ...t, status: 'paused', endsAt: null, remainingSec: remaining } };
  });
}

export function resumeTimer() {
  store.update((s) => {
    const t = s.timer;
    if (t.status !== 'paused' || t.remainingSec == null) return s;
    return { ...s, timer: { ...t, status: 'running', endsAt: Date.now() + t.remainingSec * 1000, remainingSec: null } };
  });
}

export function resetTimer() {
  store.update((s) => ({ ...s, timer: { ...s.timer, status: 'idle', endsAt: null, remainingSec: null } }));
}

/** Chamada quando o contador chega a zero: registra a sessão e (opcionalmente) conclui o hábito de hoje. */
export function finishTimer() {
  const s = store.get();
  const t = s.timer;
  if (t.status !== 'running') return;
  const session = { id: newId(), startedAt: Date.now() - t.totalSec * 1000, seconds: t.totalSec, habitId: t.habitId };
  store.update((st) => ({
    ...st,
    sessions: [session, ...st.sessions].slice(0, 200),
    timer: { ...st.timer, status: 'idle', endsAt: null, remainingSec: null },
  }));
  if (t.markDoneOnFinish && t.habitId) setDayStatus(t.habitId, todayKey(), 'done');
}

/* ---------- agenda / backup ---------- */

export function setGoogleState(patch: Partial<AppState['google']>) {
  store.update((s) => ({ ...s, google: { ...s.google, ...patch } }));
}

export function exportJson(): string {
  return JSON.stringify(store.get(), null, 2);
}

export function importJson(text: string): void {
  const parsed = JSON.parse(text) as Partial<AppState>;
  if (!parsed || !Array.isArray(parsed.habits) || !Array.isArray(parsed.tasks)) {
    throw new Error('Arquivo inválido: esperado um backup do Ritmo.');
  }
  const initial = createInitialState();
  const now = Date.now();
  store.update((cur) => {
    // o que existe hoje e não está no backup vira "excluído", para o sync com o Drive não trazer de volta
    const keep = new Set([...parsed.habits!.map((h) => h.id), ...parsed.tasks!.map((t) => t.id)]);
    const tombstones = { ...cur.tombstones, ...(parsed.tombstones ?? {}) };
    for (const x of [...cur.habits, ...cur.tasks]) if (!keep.has(x.id)) tombstones[x.id] = now;
    return {
      ...initial,
      ...parsed,
      version: 1,
      timer: { ...initial.timer, ...(parsed.timer ?? {}), status: 'idle', endsAt: null, remainingSec: null },
      // ajustes do Google são do aparelho: o backup não os sobrescreve
      google: cur.google,
      pendingEventDeletes: cur.pendingEventDeletes,
      categories: parsed.categories?.length ? parsed.categories : initial.categories,
      tombstones,
    };
  });
}

export function resetAll() {
  const now = Date.now();
  store.update((cur) => {
    const initial = createInitialState();
    const tombstones = { ...cur.tombstones };
    for (const x of [...cur.habits, ...cur.tasks]) tombstones[x.id] = now;
    return {
      ...initial,
      categories: initial.categories.map((c) => ({ ...c, updatedAt: now })),
      google: cur.google,
      pendingEventDeletes: [
        ...cur.pendingEventDeletes,
        ...cur.habits.filter((h) => h.gcal?.origin === 'app').map((h) => h.gcal!.eventId),
      ],
      tombstones,
    };
  });
}
