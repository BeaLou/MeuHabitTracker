import { useSyncExternalStore } from 'react';
import { createInitialState } from './core/defaults';
import type { AppState } from './core/types';

const KEY = 'ritmo:v1';

function load(): AppState {
  const initial = createInitialState();
  try {
    if (typeof localStorage === 'undefined') return initial;
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...initial,
      ...parsed,
      timer: { ...initial.timer, ...(parsed.timer ?? {}) },
      google: { ...initial.google, ...(parsed.google ?? {}) },
      categories: parsed.categories?.length ? parsed.categories : initial.categories,
    };
  } catch {
    return initial;
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* armazenamento cheio ou bloqueado: o app continua em memória */
  }
}

export const store = {
  get: () => state,
  update(fn: (s: AppState) => AppState) {
    state = fn(state);
    persist();
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.get);
}
