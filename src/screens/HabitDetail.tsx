import { useEffect, useState } from 'react';
import { cycleDay, removeHabit, setDayStatus, setNote, updateHabit } from '../actions';
import { addMonths, formatLong, fromKey, todayKey } from '../core/dates';
import { computeStats, diasLabel } from '../core/habits';
import type { AppState } from '../core/types';
import { Icon } from '../components/Icon';
import { HabitForm } from '../components/HabitForm';
import { MonthCalendar } from '../components/MonthCalendar';
import { ScoreRing } from '../components/ScoreRing';

export type DetailTab = 'calendar' | 'stats' | 'edit';

interface Props {
  state: AppState;
  habitId: string;
  initialTab: DetailTab;
  onBack: () => void;
}

export function HabitDetail({ state, habitId, initialTab, onBack }: Props) {
  const habit = state.habits.find((h) => h.id === habitId);
  const today = todayKey();
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [selected, setSelected] = useState(today);
  const [{ year, month0 }, setMonth] = useState(() => {
    const d = fromKey(today);
    return { year: d.getFullYear(), month0: d.getMonth() };
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!habit) onBack();
  }, [habit, onBack]);
  if (!habit) return null;

  const stats = computeStats(habit, today);
  const markToday = () => setDayStatus(habit.id, today, habit.log[today] === 'done' ? null : 'done');

  return (
    <div className="app overlay">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Voltar"><Icon name="back" /></button>
        <h1>{habit.emoji} {habit.name}</h1>
        <button className="icon-btn accent" onClick={markToday} aria-label="Concluir hoje"><Icon name="plus" /></button>
      </div>

      <div className="screen">
        <div className="tabs" role="tablist">
          {([['calendar', 'Calendário'], ['stats', 'Estatísticas'], ['edit', 'Editar']] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {tab === 'calendar' && (
          <>
            <MonthCalendar
              habit={habit} today={today} year={year} month0={month0} selected={selected}
              onMonth={(d) => setMonth((m) => addMonths(m.year, m.month0, d))}
              onPick={setSelected}
              onToggle={(k) => cycleDay(habit.id, k)}
            />
            <div className="section-title">Série</div>
            <div className="two">
              <div><small>Atual</small><strong>{diasLabel(stats.currentStreak)}</strong></div>
              <div><small>Melhor</small><strong>{diasLabel(stats.bestStreak)}</strong></div>
            </div>
            <div className="section-title">Anotações · {formatLong(selected)}</div>
            <textarea
              rows={3}
              placeholder="Como foi hoje?"
              value={habit.notes[selected] ?? ''}
              onChange={(e) => setNote(habit.id, selected, e.target.value)}
              aria-label="Anotações do dia"
            />
          </>
        )}

        {tab === 'stats' && (
          <>
            <div className="section-title" style={{ textAlign: 'center' }}>Pontuação do hábito</div>
            <div className="ring-wrap"><ScoreRing value={stats.score} label="Pontuação" /></div>
            <div className="two">
              <div><small>Série atual</small><strong>{diasLabel(stats.currentStreak)}</strong></div>
              <div><small>Melhor série</small><strong>{diasLabel(stats.bestStreak)}</strong></div>
            </div>
            <div className="section-title">Vezes concluída</div>
            <div className="kv"><span>Esta semana</span><b>{stats.doneWeek}</b></div>
            <div className="kv"><span>Este mês</span><b>{stats.doneMonth}</b></div>
            <div className="kv"><span>Este ano</span><b>{stats.doneYear}</b></div>
            <div className="kv"><span>Total</span><b>{stats.doneTotal}</b></div>
            <div className="kv"><span>Taxa de conclusão</span><b>{stats.rate}%</b></div>
          </>
        )}

        {tab === 'edit' && (
          <>
            <HabitForm
              key={habit.id}
              initial={habit}
              categories={state.categories}
              googleConnected={state.google.connected}
              submitLabel="Salvar alterações"
              onSubmit={(d) => { updateHabit(habit.id, d); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
            />
            {saved && <p className="hint" style={{ textAlign: 'center' }}>Alterações salvas ✓</p>}
            <div className="btns" style={{ marginTop: 8 }}>
              <button className="btn ghost" onClick={() => updateHabit(habit.id, { archived: !habit.archived })}>
                {habit.archived ? 'Desarquivar hábito' : 'Arquivar hábito'}
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  if (window.confirm(`Excluir "${habit.name}" e todo o histórico?`)) {
                    removeHabit(habit.id);
                    onBack();
                  }
                }}
              >
                Excluir hábito
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
