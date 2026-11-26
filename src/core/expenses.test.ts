import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInitialState } from './defaults';
import { expensesOfMonth, parseAmount, totalCents } from './expenses';
import { mergeStates, shareable, shareSignature } from './merge';
import type { Expense } from './types';

const gasto = (id: string, date: string, amountCents: number, updatedAt = 1000): Expense =>
  ({ id, date, amountCents, category: 'Outros', note: '', createdAt: updatedAt, updatedAt });

test('valor em formato brasileiro ou com ponto', () => {
  assert.equal(parseAmount('1.234,56'), 123456);
  assert.equal(parseAmount('12,5'), 1250);
  assert.equal(parseAmount('12.50'), 1250);
  assert.equal(parseAmount('1.234'), 123400);
  assert.equal(parseAmount('R$ 30'), 3000);
  for (const bad of ['', '0', '-5', 'abc', '1,234.56', '12,345']) assert.equal(parseAmount(bad), null, bad);
});

test('total considera só o mês escolhido', () => {
  const list = [gasto('a', '2026-11-01', 1000), gasto('b', '2026-11-30', 250), gasto('c', '2026-10-31', 999)];
  assert.deepEqual(expensesOfMonth(list, '2026-11').map((e) => e.id), ['b', 'a']);
  assert.equal(totalCents(expensesOfMonth(list, '2026-11')), 1250);
});

test('merge: junta gastos, respeita edição mais nova e exclusão', () => {
  const now = Date.now();
  const local = { ...createInitialState(), expenses: [gasto('a', '2026-11-01', 100, now - 10), gasto('x', '2026-11-02', 5, now - 10)] };
  const merged = mergeStates(local, { expenses: [gasto('a', '2026-11-01', 200, now), gasto('b', '2026-11-03', 300, now)], tombstones: { x: now } }, now);
  assert.deepEqual(merged.expenses.map((e) => [e.id, e.amountCents]), [['a', 200], ['b', 300]]);
  assert.equal(shareable(merged).expenses.length, 2);
  assert.notEqual(shareSignature(merged), shareSignature(local));
});

test('merge: arquivo antigo do Drive, sem gastos, não apaga os locais', () => {
  const local = { ...createInitialState(), expenses: [gasto('a', '2026-11-01', 100)] };
  assert.equal(mergeStates(local, { habits: [], tasks: [] }).expenses.length, 1);
});
