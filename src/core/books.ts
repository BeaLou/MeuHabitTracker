import type { Book, BookStatus } from './types';

export const BOOK_STATUS: { id: BookStatus; label: string }[] = [
  { id: 'want', label: 'Quero ler' },
  { id: 'reading', label: 'Lendo' },
  { id: 'read', label: 'Lido' },
];

export type BookInfo = Pick<Book, 'title' | 'authors' | 'year' | 'isbn' | 'coverUrl'>;

/** ISBN-10 ou ISBN-13 sem hífens, ou null se o texto não parecer um ISBN. */
export function asIsbn(text: string): string | null {
  const t = text.replace(/[\s-]/g, '').toUpperCase();
  return /^(97[89]\d{10}|\d{9}[\dX])$/.test(t) ? t : null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const names = (v: unknown): string => (Array.isArray(v) ? v.map(str).filter(Boolean).join(', ') : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function fromOpenLibrary(data: unknown): BookInfo[] {
  const docs = (data as { docs?: unknown } | null)?.docs;
  if (!Array.isArray(docs)) throw new Error('Resposta inesperada da busca de livros.');
  return docs.filter((d) => str(d?.title)).map((d) => ({
    title: str(d.title),
    authors: names(d.author_name),
    year: num(d.first_publish_year),
    isbn: null,
    coverUrl: num(d.cover_i) ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
  }));
}

export function fromBrasilApi(data: unknown, isbn: string): BookInfo[] {
  const d = data as Record<string, unknown> | null;
  if (!str(d?.title)) throw new Error('Resposta inesperada da busca por ISBN.');
  const cover = str(d!.cover_url);
  return [{
    title: [str(d!.title), str(d!.subtitle)].filter(Boolean).join(': '),
    authors: names(d!.authors),
    year: num(d!.year),
    isbn,
    coverUrl: cover.startsWith('https://') ? cover : null,
  }];
}

/** ISBN vai para a BrasilAPI; qualquer outro texto, para a Open Library. */
export async function searchBooks(query: string, fetcher: typeof fetch = fetch): Promise<BookInfo[]> {
  const isbn = asIsbn(query);
  const url = isbn
    ? `https://brasilapi.com.br/api/isbn/v1/${isbn}`
    : `https://openlibrary.org/search.json?${new URLSearchParams({ q: query.trim(), limit: '15', fields: 'title,author_name,first_publish_year,cover_i' })}`;
  const res = await fetcher(url);
  if (isbn && res.status === 404) return [];
  if (!res.ok) throw new Error(`A busca falhou (erro ${res.status}).`);
  const data: unknown = await res.json();
  return isbn ? fromBrasilApi(data, isbn) : fromOpenLibrary(data);
}
