import { toKey, type DateKey } from './dates';
import { percentOf } from './progress';
import type { Book, Target } from './types';

/** Dia em que o livro foi terminado. Livros marcados antes deste campo usam o registro de 100% ou a última edição. */
export function finishedOn(b: Book): DateKey | '' {
  if (b.status !== 'read') return '';
  if (b.finishedAt !== undefined) return b.finishedAt;
  const full = (b.progress ?? []).filter((e) => percentOf(e) === 100).map((e) => e.at);
  return toKey(new Date(full.length ? Math.min(...full) : b.updatedAt));
}

export const readInYear = (books: Book[], year: number): Book[] =>
  books.filter((b) => finishedOn(b).startsWith(`${year}-`));

/** Livros lidos, do término mais recente para o mais antigo. */
export const recentReads = (books: Book[], limit = 3): Book[] =>
  books.filter((b) => b.status === 'read').sort((a, b) => finishedOn(b).localeCompare(finishedOn(a))).slice(0, limit);

/** Emoções registradas no ano, da mais frequente para a menos. */
export function emotionSummary(books: Book[], year: number, limit = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of books.flatMap((b) => b.progress ?? [])) {
    if (new Date(e.at).getFullYear() !== year) continue;
    for (const name of e.emotions) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
}

export const targetValue = (targets: Target[], id: string): number => targets.find((t) => t.id === id)?.value ?? 0;

export const formatRating = (n: number): string => `${n.toLocaleString('pt-BR')} de 5`;
