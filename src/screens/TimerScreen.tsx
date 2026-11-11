import { useState } from 'react';
import { pauseTimer, resetTimer, resumeTimer, startTimer } from '../actions';
import { toKey } from '../core/dates';
import type { AppState } from '../core/types';
import { useNow } from '../hooks';
import { store } from '../store';

const PRESETS = [15, 25, 45, 60];

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export function TimerScreen({ state }: { state: AppState }) {
  const t = state.timer;
  const now = useNow(250);
  const [habitId, setHabitId] = useState<string>(t.habitId ?? '');
  const [markDone, setMarkDone] = useState(t.markDoneOnFinish);

  const remaining =
    t.status === 'running' && t.endsAt != null ? Math.max(0, Math.ceil((t.endsAt - now) / 1000))
    : t.status === 'paused' ? t.remainingSec ?? 0
    : t.totalSec;
  const progress = t.totalSec > 0 ? remaining / t.totalSec : 0;

  const setTotal = (min: number) => {
    if (t.status !== 'idle') return;
    store.update((s) => ({ ...s, timer: { ...s.timer, totalSec: Math.max(1, min) * 60 } }));
  };

  const size = 240;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const todayStr = toKey(new Date());
  const todaySessions = state.sessions.filter((s) => toKey(new Date(s.startedAt)) === todayStr);
  const todayMin = Math.round(todaySessions.reduce((a, s) => a + s.seconds, 0) / 60);
  const activeHabits = state.habits.filter((h) => !h.archived);
  const habitName = (id: string | null) => state.habits.find((h) => h.id === id)?.name;

  return (
    <div>
      <div className="timer-ring">
        <svg width={size} height={size} role="img" aria-label="Tempo restante">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
        </svg>
        <div className="time" aria-live="off">{mmss(remaining)}</div>
      </div>

      {t.status === 'idle' && (
        <>
          <div className="presets">
            {PRESETS.map((m) => (
              <button key={m} className={`chip${t.totalSec === m * 60 ? ' on' : ''}`} onClick={() => setTotal(m)}>{m} min</button>
            ))}
            <input
              type="number" min={1} max={240} aria-label="Minutos personalizados"
              style={{ width: 90 }} value={Math.round(t.totalSec / 60)}
              onChange={(e) => setTotal(Math.min(240, Number(e.target.value) || 1))}
            />
          </div>
          <div className="form">
            <div className="field">
              <label htmlFor="tm-habit">Vincular a um hábito (opcional)</label>
              <select id="tm-habit" value={habitId} onChange={(e) => setHabitId(e.target.value)}>
                <option value="">Sem hábito</option>
                {activeHabits.map((h) => <option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
              </select>
            </div>
            <label className="inline" htmlFor="tm-done">
              <input id="tm-done" type="checkbox" checked={markDone} disabled={!habitId} onChange={(e) => setMarkDone(e.target.checked)} />
              Marcar o hábito como feito ao terminar
            </label>
            <button className="btn" onClick={() => startTimer(t.totalSec, habitId || null, markDone && !!habitId)}>Iniciar foco</button>
          </div>
        </>
      )}

      {t.status === 'running' && (
        <div className="btns row2">
          <button className="btn ghost" onClick={pauseTimer}>Pausar</button>
          <button className="btn danger" onClick={resetTimer}>Cancelar</button>
        </div>
      )}
      {t.status === 'paused' && (
        <div className="btns row2">
          <button className="btn" onClick={resumeTimer}>Continuar</button>
          <button className="btn danger" onClick={resetTimer}>Cancelar</button>
        </div>
      )}
      {t.status !== 'idle' && t.habitId && <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>Foco em: {habitName(t.habitId)}</p>}

      <div className="section-title">Hoje: {todayMin} min em {todaySessions.length} sessão(ões)</div>
      {todaySessions.slice(0, 8).map((s) => (
        <div className="kv" key={s.id}>
          <span>{new Date(s.startedAt).toTimeString().slice(0, 5)} {habitName(s.habitId) ? `· ${habitName(s.habitId)}` : ''}</span>
          <b>{Math.round(s.seconds / 60)} min</b>
        </div>
      ))}
    </div>
  );
}
