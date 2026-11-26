import { challengeHabits } from './core/challenge';
import { todayKey, toKey, type DateKey } from './core/dates';
import { createInitialState, exampleHabits, makeHabit, makeTask, newId } from './core/defaults';
import { applyStatus, tapGoal } from './core/goals';
import { nextStatus } from './core/habits';
import type { BookInfo } from './core/books';
import { importFromPo, type PoRecord } from './core/poroshape';
import { percentOf } from './core/progress';
import { finishedOn } from './core/reading';
import type { AppState, Book, BookStatus, Category, DayStatus, Expense, Habit, ProgressEntry, Task } from './core/types';
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

// marcar um dia não é "edição do hábito": não mexe em updatedAt (não dispara a agenda),
// mas o carimbo do dia permite juntar com outros aparelhos, inclusive ao desmarcar
const changeDay = (id: string, change: (h: Habit) => Habit) =>
  store.update((s) => ({ ...s, habits: s.habits.map((h) => (h.id === id ? change(h) : h)) }));

export function setDayStatus(id: string, key: DateKey, status: DayStatus | null) {
  changeDay(id, (h) => applyStatus(h, key, status, Date.now()));
}

export function syncPorOShape(records: PoRecord[]) {
  const habits = importFromPo(store.get().habits, records, todayKey(), Date.now());
  if (habits !== store.get().habits) store.update((s) => ({ ...s, habits }));
}

export function addAmount(id: string, key: DateKey) {
  changeDay(id, (h) => tapGoal(h, key, Date.now()));
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

export function addChallenge(startDate: DateKey) {
  store.update((s) => ({ ...s, habits: [...s.habits, ...challengeHabits(startDate)] }));
}

export function endChallenge(ids: string[]) {
  for (const id of ids) updateHabit(id, { archived: true });
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

/* ---------- gastos ---------- */

export type ExpenseInput = Pick<Expense, 'date' | 'category' | 'amountCents' | 'note'>;

export function addExpense(input: ExpenseInput) {
  const now = Date.now();
  store.update((s) => ({ ...s, expenses: [...s.expenses, { ...input, id: newId(), createdAt: now, updatedAt: now }] }));
}

export function updateExpense(id: string, patch: ExpenseInput) {
  store.update((s) => ({ ...s, expenses: s.expenses.map((e) => (e.id === id ? touch(e, patch) : e)) }));
}

export function removeExpense(id: string) {
  store.update((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id), tombstones: { ...s.tombstones, [id]: Date.now() } }));
}

/* ---------- livros ---------- */

export function addBook(info: BookInfo, status: BookStatus) {
  const now = Date.now();
  // salvo direto como lido: não se sabe quando terminou, até a data ser informada
  const finished = status === 'read' ? { finishedAt: '' as const } : {};
  store.update((s) => ({ ...s, books: [...s.books, { ...info, ...finished, status, id: newId(), createdAt: now, updatedAt: now }] }));
}

export function setBookStatus(id: string, status: BookStatus) {
  store.update((s) => ({ ...s, books: s.books.map((b) => {
    if (b.id !== id) return b;
    return touch(b, { status, finishedAt: status === 'read' ? todayKey() : undefined });
  }) }));
}

export function updateBook(id: string, patch: Partial<Pick<Book, 'rating' | 'finishedAt'>>) {
  // grava a data de término junto, para avaliar um livro antigo não mudar quando ele foi lido
  store.update((s) => ({ ...s, books: s.books.map((b) => (b.id === id ? touch(b, { finishedAt: finishedOn(b), ...patch }) : b)) }));
}

export function setTarget(id: string, value: number) {
  store.update((s) => ({ ...s, targets: [...s.targets.filter((t) => t.id !== id), { id, value, updatedAt: Date.now() }] }));
}

export function removeBook(id: string) {
  store.update((s) => ({ ...s, books: s.books.filter((b) => b.id !== id), tombstones: { ...s.tombstones, [id]: Date.now() } }));
}

export function addProgress(bookId: string, input: Omit<ProgressEntry, 'id'>) {
  const entry = { ...input, id: newId() };
  store.update((s) => ({
    ...s,
    books: s.books.map((b) => {
      if (b.id !== bookId) return b;
      const progress = [...(b.progress ?? []), entry];
      // registrar leitura tira de "Quero ler"; chegar ao fim marca como lido
      const status: BookStatus = percentOf(entry) === 100 ? 'read' : b.status === 'want' ? 'reading' : b.status;
      const finished = status === 'read' && b.status !== 'read' ? { finishedAt: toKey(new Date(entry.at)) } : {};
      return touch(b, { progress, status, ...finished });
    }),
  }));
}

export function removeProgress(bookId: string, entryId: string) {
  store.update((s) => ({
    ...s,
    books: s.books.map((b) => (b.id === bookId ? touch(b, { progress: (b.progress ?? []).filter((e) => e.id !== entryId) }) : b)),
    tombstones: { ...s.tombstones, [entryId]: Date.now() },
  }));
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
    const keep = new Set([...parsed.habits!, ...parsed.tasks!, ...(parsed.expenses ?? []), ...(parsed.books ?? [])].map((x) => x.id));
    const tombstones = { ...cur.tombstones, ...(parsed.tombstones ?? {}) };
    for (const x of [...cur.habits, ...cur.tasks, ...cur.expenses, ...cur.books]) if (!keep.has(x.id)) tombstones[x.id] = now;
    return {
      ...initial,
      ...parsed,
      version: 1,
      // o backup restaurado vale como a edição mais recente das metas; as que não estão nele são zeradas
      targets: [
        ...(parsed.targets ?? []),
        ...cur.targets.filter((t) => !(parsed.targets ?? []).some((x) => x.id === t.id)).map((t) => ({ ...t, value: 0 })),
      ].map((t) => ({ ...t, updatedAt: now })),
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
    for (const x of [...cur.habits, ...cur.tasks, ...cur.expenses, ...cur.books]) tombstones[x.id] = now;
    return {
      ...initial,
      targets: cur.targets.map((t) => ({ ...t, value: 0, updatedAt: now })),
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
