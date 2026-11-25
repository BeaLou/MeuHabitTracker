import { useState } from 'react';
import { addChallenge, endChallenge, setDayStatus } from '../actions';
import { CHALLENGE_DAYS, activeChallenge, challengeDates, challengeDayNumber, doneCount } from '../core/challenge';
import { formatLong, todayKey } from '../core/dates';
import type { AppState } from '../core/types';
import { Icon } from '../components/Icon';

interface Props {
  state: AppState;
  onBack: () => void;
  onOpenHabit: (id: string) => void;
}

export function ChallengeScreen({ state, onBack, onOpenHabit }: Props) {
  const today = todayKey();
  const habits = activeChallenge(state.habits);
  const [start, setStart] = useState(today);
  const [picked, setPicked] = useState<number | null>(null);

  const dates = habits.length ? challengeDates(habits) : [];
  const day = picked ?? (habits.length ? challengeDayNumber(habits[0].startDate, today) : 1);
  const key = dates[day - 1];
  const complete = dates.filter((k) => doneCount(habits, k) === habits.length).length;

  return (
    <div className="app overlay challenge">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Voltar"><Icon name="back" /></button>
        <h1>Desafio 75</h1>
      </div>

      <div className="screen">
        {!habits.length ? (
          <div className="form">
            <p>Cria 6 hábitos diários por 75 dias: dieta, água, leitura, dois treinos e foto.</p>
            <p className="hint">Dois treinos por dia sem descanso pedem cautela. Vale conversar com um profissional de saúde antes e ajustar as metas.</p>
            <div className="field">
              <label htmlFor="c-start">Data de início</label>
              <input id="c-start" type="date" value={start} onChange={(e) => setStart(e.target.value || today)} />
            </div>
            <button className="btn" onClick={() => { setPicked(null); addChallenge(start); }}>Começar desafio</button>
          </div>
        ) : (
          <>
            <p><b>{complete}</b> de {CHALLENGE_DAYS} dias completos</p>
            <progress max={CHALLENGE_DAYS} value={complete} aria-label="Progresso do desafio" />

            <div className="section-title">Dia {day} · {formatLong(key)}</div>
            {key > today && <p className="hint">Este dia ainda não chegou.</p>}
            {habits.map((h) => {
              const done = h.log[key] === 'done';
              return (
                <div key={h.id} className={`row${done ? ' done' : ''}`}>
                  <span className="ico">{h.emoji}</span>
                  <button className="main title" onClick={() => onOpenHabit(h.id)}>{h.name}</button>
                  <button
                    className={`check${done ? ' done' : ''}`}
                    disabled={key > today}
                    aria-pressed={done}
                    aria-label={`Concluir ${h.name}`}
                    onClick={() => setDayStatus(h.id, key, done ? null : 'done')}
                  >
                    {done ? '✓' : ''}
                  </button>
                </div>
              );
            })}

            <div className="section-title">Os 75 dias</div>
            <div className="c-grid">
              {dates.map((k, i) => {
                const n = doneCount(habits, k);
                const cls = n === habits.length ? 'full' : n ? 'part' : '';
                return (
                  <button
                    key={k}
                    className={`${cls}${i + 1 === day ? ' sel' : ''}`}
                    onClick={() => setPicked(i + 1)}
                    aria-label={`Dia ${i + 1}: ${n} de ${habits.length}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <button
              className="btn ghost"
              style={{ width: '100%', marginTop: 20 }}
              onClick={() => { if (window.confirm('Encerrar o desafio? Os hábitos serão arquivados e o histórico fica salvo.')) endChallenge(habits.map((h) => h.id)); }}
            >
              Encerrar desafio
            </button>
          </>
        )}
      </div>
    </div>
  );
}
