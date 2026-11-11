import type { AppState, FocusSession } from './types';

const TOMBSTONE_TTL = 90 * 86_400_000; // lápides com mais de 90 dias são descartadas

type Stamped = { id: string; updatedAt?: number };

function stampOf(x: Stamped): number {
  return x.updatedAt ?? 0;
}

/** Entre duas versões do mesmo item, vence a editada por último (empate: a local). */
function newer<T extends Stamped>(local: T, remote: T): { win: T; lose: T } {
  return stampOf(remote) > stampOf(local) ? { win: remote, lose: local } : { win: local, lose: remote };
}

/** Merge dia a dia de um mapa (log/anotações): vence o lado com o carimbo mais recente. */
function mergeMap<V>(
  aVal: Record<string, V>, aAt: Record<string, number> = {},
  bVal: Record<string, V>, bAt: Record<string, number> = {},
): { value: Record<string, V>; at: Record<string, number> } {
  const value: Record<string, V> = {};
  const at: Record<string, number> = {};
  const keys = new Set([...Object.keys(aVal), ...Object.keys(aAt), ...Object.keys(bVal), ...Object.keys(bAt)]);
  for (const k of keys) {
    const ta = aAt[k] ?? 0;
    const tb = bAt[k] ?? 0;
    // empate (ex.: dados antigos sem carimbo): o valor presente vence a ausência
    const useB = tb > ta || (tb === ta && !(k in aVal) && k in bVal);
    const v = useB ? bVal[k] : aVal[k];
    const t = useB ? tb : ta;
    if (v !== undefined) value[k] = v;
    if (t > 0) at[k] = t;
  }
  return { value, at };
}

function mergeById<T extends Stamped>(
  local: T[], remote: T[], tombs: Record<string, number>, combine: (win: T, lose: T) => T = (w) => w,
): T[] {
  const map = new Map<string, T>();
  for (const x of local) map.set(x.id, x);
  for (const y of remote) {
    const x = map.get(y.id);
    if (!x) map.set(y.id, y);
    else {
      const { win, lose } = newer(x, y);
      map.set(y.id, combine(win, lose));
    }
  }
  return [...map.values()].filter((x) => !(tombs[x.id] !== undefined && tombs[x.id] >= stampOf(x)));
}

/**
 * Junta o estado local com o que veio do Drive. Campos específicos do aparelho
 * (timer, ajustes do Google, exclusões pendentes na agenda) ficam como estão.
 */
export function mergeStates(local: AppState, remote: Partial<AppState>, now = Date.now()): AppState {
  const tombs: Record<string, number> = { ...(remote.tombstones ?? {}) };
  for (const [id, t] of Object.entries(local.tombstones ?? {})) tombs[id] = Math.max(tombs[id] ?? 0, t);
  for (const [id, t] of Object.entries(tombs)) if (now - t > TOMBSTONE_TTL) delete tombs[id];

  const habits = mergeById(local.habits, remote.habits ?? [], tombs, (win, lose) => {
    const log = mergeMap(win.log, win.logAt, lose.log, lose.logAt);
    const notes = mergeMap(win.notes, win.notesAt, lose.notes, lose.notesAt);
    const nonEmpty = (m: Record<string, number>) => (Object.keys(m).length ? m : undefined);
    return { ...win, log: log.value, logAt: nonEmpty(log.at), notes: notes.value, notesAt: nonEmpty(notes.at), gcal: win.gcal ?? lose.gcal };
  });
  const tasks = mergeById(local.tasks, remote.tasks ?? [], tombs);
  const categories = mergeById(local.categories, remote.categories ?? [], tombs);

  const sessions = new Map<string, FocusSession>();
  for (const s of [...local.sessions, ...(remote.sessions ?? [])]) sessions.set(s.id, s);

  return {
    ...local,
    habits,
    tasks,
    categories: categories.length ? categories : local.categories,
    sessions: [...sessions.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 200),
    tombstones: tombs,
  };
}

/** Parte do estado que vai para o Drive. */
export function shareable(s: AppState) {
  return {
    version: 1 as const,
    habits: s.habits,
    tasks: s.tasks,
    categories: s.categories,
    sessions: s.sessions,
    tombstones: s.tombstones,
  };
}

/** JSON com chaves ordenadas, para comparar sem se enganar com a ordem das propriedades. */
export function canonical(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, sort(x)]));
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

/** Assinatura barata do que é compartilhável, para disparar a sincronização depois de edições. */
export function shareSignature(s: AppState): string {
  const h = s.habits.map((x) => {
    const at = x.logAt ? Object.values(x.logAt) : [];
    const na = x.notesAt ? Object.values(x.notesAt) : [];
    return `${x.id}:${x.updatedAt}:${at.length}:${at.length ? Math.max(...at) : 0}:${na.length ? Math.max(...na) : 0}`;
  });
  const t = s.tasks.map((x) => `${x.id}:${x.updatedAt}`);
  const c = s.categories.map((x) => `${x.id}:${x.updatedAt ?? 0}`);
  return [h.join('|'), t.join('|'), c.join('|'), Object.keys(s.tombstones).length, s.sessions.length].join('#');
}
