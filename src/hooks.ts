import { useEffect, useRef, useState } from 'react';
import { finishTimer, setGoogleState } from './actions';
import { nowTimeKey, timeToMinutes, todayKey } from './core/dates';
import { cellStatus, isDue } from './core/habits';
import { shareSignature } from './core/merge';
import type { AppState } from './core/types';
import { googleConfigured } from './google/auth';
import { driveSyncNow } from './google/drive';
import { syncNow } from './google/sync';
import { notify } from './notify';
import { store, useAppState } from './store';

/** Re-renderiza a cada `ms`. */
export function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Detecta o fim do timer mesmo com outra aba do app aberta, e avisa. */
export function useTimerWatcher() {
  useEffect(() => {
    const id = setInterval(() => {
      const t = store.get().timer;
      if (t.status === 'running' && t.endsAt != null && Date.now() >= t.endsAt) {
        const habit = store.get().habits.find((h) => h.id === t.habitId);
        finishTimer();
        void notify('Foco concluído 🎉', habit ? `${habit.name} marcado como feito.` : 'Hora de uma pausa.');
      }
    }, 500);
    return () => clearInterval(id);
  }, []);
}

const FIRED_KEY = 'ritmo:fired';

function readFired(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}') as Record<string, true>;
  } catch {
    return {};
  }
}

/**
 * Lembretes enquanto o app está aberto (ou em segundo plano na aba).
 * Navegadores não permitem agendar notificações com o app fechado sem um servidor de push;
 * para isso, hábitos sincronizados com o Google Agenda usam o lembrete nativo da agenda.
 */
export function useReminders() {
  useEffect(() => {
    const tick = () => {
      const s = store.get();
      const today = todayKey();
      const nowMin = timeToMinutes(nowTimeKey());
      const fired = readFired();
      let changed = false;
      for (const h of s.habits) {
        if (h.archived || !h.time || h.reminderMinutes == null || !isDue(h, today)) continue;
        const st = cellStatus(h, today, today);
        if (st === 'done' || st === 'skipped') continue;
        const at = timeToMinutes(h.time) - h.reminderMinutes;
        const key = `${h.id}:${today}`;
        if (nowMin >= at && nowMin <= at + 120 && !fired[key]) {
          fired[key] = true;
          changed = true;
          void notify(`${h.emoji} ${h.name}`, h.reminderMinutes === 0 ? `Agora (${h.time})` : `Começa às ${h.time}`);
        }
      }
      if (changed) {
        // guarda só os disparos de hoje para o objeto não crescer para sempre
        const keep = Object.fromEntries(Object.entries(fired).filter(([k]) => k.endsWith(`:${today}`)));
        try {
          localStorage.setItem(FIRED_KEY, JSON.stringify(keep));
        } catch {
          /* ignora */
        }
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
}

const signature = (s: AppState) =>
  s.habits.map((h) => `${h.id}:${h.updatedAt}:${h.gcal ? 1 : 0}:${h.syncToCalendar ? 1 : 0}`).join('|') + `#${s.pendingEventDeletes.length}`;

/** Sincroniza ao abrir, ao voltar para o app e alguns segundos depois de editar hábitos. */
export function useAutoSync() {
  const state = useAppState();
  const sig = signature(state);
  const connected = state.google.connected && googleConfigured;
  const lastRun = useRef(0);

  const run = useRef(async () => {
    lastRun.current = Date.now();
    try {
      await syncNow();
    } catch {
      setGoogleState({ lastSyncMessage: 'Sessão do Google expirada: toque em Sincronizar para reconectar.' });
    }
  });

  useEffect(() => {
    if (!connected) return;
    const id = setTimeout(() => void run.current(), 4000);
    return () => clearTimeout(id);
  }, [connected, sig]);

  useEffect(() => {
    if (!connected) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRun.current > 5 * 60_000) void run.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [connected]);
}

/** Sincroniza os dados entre aparelhos (Drive): ao abrir, ao voltar para o app, a cada minuto e logo depois de editar. */
export function useAutoDriveSync() {
  const state = useAppState();
  const enabled = state.google.connected && state.google.driveSync && googleConfigured;
  const sig = shareSignature(state);

  const run = useRef(async () => {
    try {
      await driveSyncNow();
    } catch {
      setGoogleState({ lastDriveMessage: 'Não foi possível sincronizar: toque em Sincronizar nos Ajustes para reconectar.' });
    }
  });

  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => void run.current(), 5000);
    return () => clearTimeout(id);
  }, [enabled, sig]);

  useEffect(() => {
    if (!enabled) return;
    const pull = () => {
      if (document.visibilityState === 'visible') void run.current();
    };
    document.addEventListener('visibilitychange', pull);
    const id = setInterval(pull, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', pull);
      clearInterval(id);
    };
  }, [enabled]);
}
