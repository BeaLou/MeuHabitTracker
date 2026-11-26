import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInitialState, makeHabit } from './defaults';
import { mergeStates, shareSignature } from './merge';
import { emotionSummary, finishedOn, readInYear, targetValue } from './reading';
import type { Book, ProgressEntry } from './types';
import { bestClue, byCategory, pagesRead, readingDays, weekDays } from './week';

const entry = (day: string, value: number, extra: Partial<ProgressEntry> = {}): ProgressEntry => ({
  id: `${day}-${value}`, at: new Date(`${day}T12:00:00`).getTime(), mode: 'pages', value, total: 200, emotions: [], comment: '', ...extra,
});
const book = (extra: Partial<Book>): Book => ({
  id: 'b', title: 'T', authors: '', year: null, isbn: null, coverUrl: null, status: 'reading', createdAt: 1,
  updatedAt: new Date('2025-05-05T12:00:00').getTime(), ...extra,
});
const week = weekDays('2026-11-26');

test('semana vai de domingo a sábado', () => {
  assert.equal(week[0], '2026-11-22');
  assert.equal(week[6], '2026-11-28');
});

test('páginas da semana contam só o avanço', () => {
  const b = book({ progress: [entry('2026-11-20', 50), entry('2026-11-23', 80), entry('2026-11-23', 90), entry('2026-11-25', 70), entry('2026-11-26', 100),
    entry('2026-11-24', 50, { mode: 'percent', total: 100 })] });
  assert.equal(pagesRead([b], week), 70);
  assert.equal(readingDays([b], week), 4);
});

test('data de término: campo, registro de 100%, última edição ou desconhecida', () => {
  const full = book({ status: 'read', progress: [entry('2026-03-01', 200)] });
  assert.equal(finishedOn(full), '2026-03-01');
  assert.equal(finishedOn(book({ status: 'read' })), '2025-05-05');
  assert.equal(finishedOn(book({ status: 'read', finishedAt: '' })), '');
  assert.equal(finishedOn(book({ finishedAt: '2026-01-01' })), '');
  assert.equal(readInYear([full, book({ status: 'read', finishedAt: '2026-07-01' }), book({ status: 'read' })], 2026).length, 2);
});

test('emoções do ano e gastos por categoria', () => {
  const b = book({ progress: [entry('2026-01-01', 1, { emotions: ['tensa', 'curiosa'] }), entry('2026-02-01', 2, { emotions: ['curiosa'] }), entry('2025-02-01', 3, { emotions: ['triste'] })] });
  assert.deepEqual(emotionSummary([b], 2026), [{ name: 'curiosa', count: 2 }, { name: 'tensa', count: 1 }]);
  const e = (category: string, amountCents: number) => ({ id: category + amountCents, date: '2026-11-23', category, amountCents, note: '', createdAt: 1, updatedAt: 1 });
  assert.deepEqual(byCategory([e('Casa', 100), e('Lazer', 500), e('Casa', 50)]), [{ category: 'Lazer', cents: 500 }, { category: 'Casa', cents: 150 }]);
});

test('melhor pista considera dias previstos e meta semanal', () => {
  const daily = makeHabit({ name: 'a', startDate: week[0], log: { '2026-11-22': 'done', '2026-11-23': 'done' } });
  const weekly = makeHabit({ name: 'b', startDate: week[0], weeklyTimes: 2, log: { '2026-11-22': 'done', '2026-11-23': 'done' } });
  const best = bestClue([daily, weekly], week, '2026-11-26')!;
  assert.equal(best.habit.name, 'b');
  assert.equal(best.total, 2);
  assert.equal(bestClue([makeHabit({ startDate: week[0] })], week, '2026-11-26'), null);
});

test('metas sincronizam: vence a mais recente e mudam a assinatura', () => {
  const local = { ...createInitialState(), targets: [{ id: 'reading:2026', value: 10, updatedAt: 1 }] };
  const merged = mergeStates(local, { targets: [{ id: 'reading:2026', value: 24, updatedAt: 2 }] });
  assert.equal(targetValue(merged.targets, 'reading:2026'), 24);
  assert.notEqual(shareSignature(local), shareSignature(merged));
  assert.equal(mergeStates(local, {}).targets.length, 1);
});
