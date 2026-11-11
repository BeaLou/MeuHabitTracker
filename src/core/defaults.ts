import { todayKey } from './dates';
import type { AppState, Category, Habit, Task } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'saude', name: 'Saúde', emoji: '💚', color: '#3ddc84' },
  { id: 'estudos', name: 'Estudos', emoji: '📚', color: '#7c5cff' },
  { id: 'trabalho', name: 'Trabalho', emoji: '💼', color: '#4da3ff' },
  { id: 'alimentacao', name: 'Alimentação', emoji: '🍽️', color: '#ff9f43' },
  { id: 'espiritual', name: 'Espiritual', emoji: '🙏', color: '#c084fc' },
  { id: 'casa', name: 'Casa', emoji: '🏠', color: '#2dd4bf' },
  { id: 'lazer', name: 'Lazer', emoji: '🎮', color: '#ff6b9d' },
];

export const CATEGORY_COLORS = [
  '#3ddc84', '#7c5cff', '#4da3ff', '#ff9f43', '#c084fc', '#2dd4bf', '#ff6b9d', '#ffd23f', '#ff5c5c', '#9aa0b4',
];

export const EMOJI_CHOICES = [
  '✅', '💪', '🏃', '🧘', '🤸', '🚴', '📚', '✍️', '💧', '🥗', '🍎', '💊', '😴', '🧠', '🙏', '🎸',
  '🎮', '🧹', '🐶', '🪥', '☀️', '📵', '💻', '🛒', '🧾', '🎯',
];

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeHabit(partial: Partial<Habit> = {}): Habit {
  const now = Date.now();
  return {
    id: newId(),
    name: 'Novo hábito',
    description: '',
    emoji: '✅',
    categoryId: DEFAULT_CATEGORIES[0].id,
    priority: 5,
    frequency: { type: 'daily' },
    startDate: todayKey(),
    targetDate: null,
    time: null,
    durationMin: 30,
    reminderMinutes: null,
    syncToCalendar: false,
    archived: false,
    log: {},
    notes: {},
    gcal: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function makeTask(partial: Partial<Task> = {}): Task {
  const now = Date.now();
  return {
    id: newId(),
    title: '',
    categoryId: DEFAULT_CATEGORIES[0].id,
    dueDate: null,
    priority: 5,
    done: false,
    doneAt: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function createInitialState(): AppState {
  return {
    version: 1,
    habits: [],
    tasks: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    sessions: [],
    timer: { status: 'idle', totalSec: 25 * 60, endsAt: null, remainingSec: null, habitId: null, markDoneOnFinish: true },
    google: { connected: false, lastSyncAt: null, lastSyncMessage: null, driveSync: false, lastDriveSyncAt: null, lastDriveMessage: null },
    pendingEventDeletes: [],
    tombstones: {},
  };
}

export function exampleHabits(): Habit[] {
  return [
    makeHabit({ name: 'Pilates', emoji: '🤸', categoryId: 'saude', time: '09:00', durationMin: 60, frequency: { type: 'weekdays', days: [1, 3] }, priority: 9, reminderMinutes: 30 }),
    makeHabit({ name: 'Beber 2 L de água', emoji: '💧', categoryId: 'saude', priority: 8 }),
    makeHabit({ name: '30 min de leitura técnica', emoji: '📚', categoryId: 'estudos', time: '21:00', durationMin: 30, priority: 7, reminderMinutes: 10 }),
    makeHabit({ name: 'Medicação e suplementos', emoji: '💊', categoryId: 'saude', time: '08:00', durationMin: 10, priority: 10, reminderMinutes: 0 }),
  ];
}
