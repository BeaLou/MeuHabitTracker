import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInitialState } from './defaults';
import { mergeStates } from './merge';
import { isValidProgress, latestProgress, percentOf } from './progress';
import type { Book, ProgressEntry } from './types';

const entry = (id: string, at: number, value: number, total = 200): ProgressEntry =>
  ({ id, at, mode: 'pages', value, total, emotions: [], comment: '' });
const book = (updatedAt: number, progress: ProgressEntry[]): Book =>
  ({ id: 'l1', title: 'T', authors: '', year: null, isbn: null, coverUrl: null, status: 'reading', progress, createdAt: 1, updatedAt });

test('porcentagem e validação', () => {
  assert.equal(percentOf({ value: 118, total: 200 }), 59);
  assert.equal(percentOf({ value: 5, total: 0 }), 0);
  assert.equal(isValidProgress(200, 200), true);
  assert.equal(isValidProgress(201, 200), false);
  assert.equal(isValidProgress(1.5, 200), false);
});

test('o progresso atual é o da leitura mais recente, mesmo registrada fora de ordem', () => {
  assert.equal(latestProgress(book(1, [entry('b', 20, 90), entry('a', 10, 40)]))!.value, 90);
});

test('merge: junta registros dos dois aparelhos e respeita exclusão', () => {
  const now = Date.now();
  const local = { ...createInitialState(), books: [book(now - 10, [entry('a', 1, 10)])] };
  const remote = { books: [book(now, [entry('b', 2, 20)])] };
  assert.deepEqual(mergeStates(local, remote, now).books[0].progress!.map((e) => e.id).sort(), ['a', 'b']);
  assert.deepEqual(mergeStates(local, { ...remote, tombstones: { a: now } }, now).books[0].progress!.map((e) => e.id), ['b']);
});
