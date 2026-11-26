import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asIsbn, searchBooks } from './books';
import { createInitialState } from './defaults';
import { mergeStates, shareable } from './merge';
import type { Book } from './types';

const fake = (status: number, body: unknown, urls: string[] = []) =>
  (async (url: string) => { urls.push(String(url)); return new Response(JSON.stringify(body), { status }); }) as unknown as typeof fetch;

test('reconhece ISBN com e sem hífen', () => {
  assert.equal(asIsbn('978-85-359-1484-9'), '9788535914849');
  assert.equal(asIsbn('853591484x'), '853591484X');
  assert.equal(asIsbn('dom casmurro'), null);
  assert.equal(asIsbn('1984'), null);
});

test('busca por nome usa a Open Library e tolera campos ausentes', async () => {
  const urls: string[] = [];
  const r = await searchBooks('dom casmurro', fake(200, { docs: [{ title: 'Dom Casmurro', cover_i: 7 }, { cover_i: 8 }] }, urls));
  assert.match(urls[0], /openlibrary\.org\/search\.json/);
  assert.equal(r.length, 1);
  assert.equal(r[0].authors, '');
  assert.match(r[0].coverUrl!, /\/7-M\.jpg$/);
});

test('busca por ISBN usa a BrasilAPI; 404 vira lista vazia; outros erros aparecem', async () => {
  const urls: string[] = [];
  const r = await searchBooks('9788535914849', fake(200, { title: 'Título', authors: ['A', 'B'], year: 2008, cover_url: null }, urls));
  assert.match(urls[0], /brasilapi\.com\.br/);
  assert.equal(r[0].authors, 'A, B');
  assert.deepEqual(await searchBooks('9788535914849', fake(404, {})), []);
  await assert.rejects(searchBooks('qualquer', fake(500, {})), /erro 500/);
});

test('merge: livros entram na sincronização e exclusão vale', () => {
  const now = Date.now();
  const b: Book = { id: 'l1', title: 'T', authors: '', year: null, isbn: null, coverUrl: null, status: 'want', createdAt: now - 10, updatedAt: now - 10 };
  const local = { ...createInitialState(), books: [b] };
  assert.equal(shareable(mergeStates(local, {}, now)).books.length, 1);
  assert.equal(mergeStates(local, { books: [{ ...b, status: 'read', updatedAt: now }] }, now).books[0].status, 'read');
  assert.equal(mergeStates(local, { tombstones: { l1: now } }, now).books.length, 0);
});
