import { addDays, diffDays, type DateKey } from './dates';
import { makeHabit, newId } from './defaults';
import type { Habit } from './types';

export const CHALLENGE_DAYS = 75;

const SLOTS: Pick<Habit, 'name' | 'emoji' | 'categoryId' | 'durationMin' | 'description'>[] = [
  { name: 'Dieta', emoji: '🥗', categoryId: 'alimentacao', durationMin: 10, description: 'Sem refeição livre e sem álcool.' },
  { name: 'Água (meta do dia)', emoji: '💧', categoryId: 'saude', durationMin: 5, description: 'Defina uma meta segura para você. Muita água em pouco tempo é perigoso.' },
  { name: 'Leitura: 10 páginas', emoji: '📚', categoryId: 'estudos', durationMin: 20, description: 'Livro de não ficção.' },
  { name: 'Treino 1', emoji: '💪', categoryId: 'saude', durationMin: 45, description: '' },
  { name: 'Treino 2 (ao ar livre)', emoji: '🏃', categoryId: 'saude', durationMin: 45, description: '' },
  { name: 'Foto de progresso', emoji: '✅', categoryId: 'saude', durationMin: 5, description: '' },
];

export function challengeHabits(startDate: DateKey): Habit[] {
  const id = newId();
  const targetDate = addDays(startDate, CHALLENGE_DAYS - 1);
  return SLOTS.map((slot, order) =>
    makeHabit({ ...slot, startDate, targetDate, priority: 10 - order, challenge: { id, order } }));
}

/** Hábitos do desafio ativo mais recente, na ordem das linhas. Vazio se não houver. */
export function activeChallenge(habits: Habit[]): Habit[] {
  const mine = habits.filter((h) => h.challenge && !h.archived);
  if (!mine.length) return [];
  const latest = mine.reduce((a, b) => (b.createdAt > a.createdAt ? b : a)).challenge!.id;
  return mine.filter((h) => h.challenge!.id === latest).sort((a, b) => a.challenge!.order - b.challenge!.order);
}

export const challengeDates = (habits: Habit[]): DateKey[] =>
  Array.from({ length: CHALLENGE_DAYS }, (_, i) => addDays(habits[0].startDate, i));

export const doneCount = (habits: Habit[], key: DateKey): number =>
  habits.filter((h) => h.log[key] === 'done').length;

/** Número (1–75) do dia de hoje no desafio, limitado às pontas. */
export const challengeDayNumber = (start: DateKey, today: DateKey): number =>
  Math.min(CHALLENGE_DAYS, Math.max(1, diffDays(start, today) + 1));
