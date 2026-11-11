import { useEffect, useMemo, useState } from 'react';
import { addExamples, cycleDay, toggleTask } from '../actions';
import { WEEKDAY_SHORT, addDays, dayNumber, fromKey, startOfWeek, todayKey, formatLong } from '../core/dates';
import { cellStatus, isDue } from '../core/habits';
import type { AppState } from '../core/types';
import { Icon } from '../components/Icon';
import { listDayEvents, type DayEvent } from '../google/sync';

interface Props {
  state: AppState;
  onOpenHabit: (id: string) => void;
  onEditTask: (id: string) => void;
  onNewHabit: () => void;
}

export function TodayScreen({ state, onOpenHabit, onEditTask, onNewHabit }: Props) {
  const today = todayKey();
  const [selected, setSelected] = useState(today);
  const [cat, setCat] = useState<string>('all');
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const catById = useMemo(() => new Map(state.categories.map((c) => [c.id, c])), [state.categories]);

  const weekStart = startOfWeek(selected);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const future = selected > today;

  const habits = state.habits
    .filter((h) => !h.archived && isDue(h, selected) && (cat === 'all' || h.categoryId === cat))
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || b.priority - a.priority);

  const tasks = state.tasks
    .filter((t) => (cat === 'all' || t.categoryId === cat))
    .filter((t) =>
      t.dueDate === selected ||
      // tarefas sem data ou atrasadas aparecem em "hoje" enquanto não forem concluídas
      (selected === today && !t.done && (t.dueDate === null || t.dueDate < today)),
    )
    .sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority);

  const connected = state.google.connected;
  useEffect(() => {
    if (!connected) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setEventsError(null);
    listDayEvents(selected)
      .then((ev) => { if (!cancelled) setEvents(ev); })
      .catch(() => { if (!cancelled) { setEvents([]); setEventsError('Não foi possível ler a agenda agora.'); } });
    return () => { cancelled = true; };
  }, [connected, selected]);

  const otherEvents = events.filter((e) => !e.linkedHabitId);
  const empty = state.habits.length === 0 && state.tasks.length === 0;

  return (
    <div>
      <div className="week">
        <button className="icon-btn" aria-label="Semana anterior" onClick={() => setSelected(addDays(selected, -7))}><Icon name="back" /></button>
        <div className="days">
          {week.map((k) => (
            <button key={k} className={`d${k === selected ? ' sel' : ''}${k === today ? ' today' : ''}`} onClick={() => setSelected(k)} aria-label={formatLong(k)}>
              <span>{WEEKDAY_SHORT[fromKey(k).getDay()]}</span>
              <b>{dayNumber(k)}</b>
            </button>
          ))}
        </div>
        <button className="icon-btn" aria-label="Próxima semana" onClick={() => setSelected(addDays(selected, 7))}><Icon name="next" /></button>
      </div>

      <div className="chips">
        <button className={`chip${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')}>Tudo</button>
        {state.categories.map((c) => (
          <button key={c.id} className={`chip${cat === c.id ? ' on' : ''}`} onClick={() => setCat(c.id)}>{c.emoji} {c.name}</button>
        ))}
      </div>

      {empty && (
        <div className="empty">
          <div className="big">🌱</div>
          <p>Nenhum hábito ainda. Crie o primeiro ou comece com alguns exemplos.</p>
          <div className="btns" style={{ width: '100%' }}>
            <button className="btn" onClick={onNewHabit}>Criar hábito</button>
            <button className="btn ghost" onClick={addExamples}>Adicionar exemplos</button>
          </div>
        </div>
      )}

      {habits.map((h) => {
        const st = cellStatus(h, selected, today);
        const c = catById.get(h.categoryId);
        return (
          <div className="row" key={h.id}>
            <div className="ico" style={{ background: c ? `${c.color}22` : undefined }}>{h.emoji}</div>
            <button className="main" onClick={() => onOpenHabit(h.id)}>
              <div className="title">{h.name}</div>
              <div className="sub">
                <span className="tag" style={{ color: c?.color }}>Hábito</span>
                {h.time && <span>⏰ {h.time}</span>}
                {h.gcal && <span>📅</span>}
              </div>
            </button>
            <button
              className={`check ${st === 'done' ? 'done' : st === 'skipped' ? 'skipped' : ''}`}
              disabled={future}
              onClick={() => cycleDay(h.id, selected)}
              aria-label={`${h.name}: ${st}`}
            >
              {st === 'done' && <Icon name="check" />}
              {st === 'skipped' && <Icon name="skip" />}
            </button>
          </div>
        );
      })}

      {tasks.map((t) => {
        const c = catById.get(t.categoryId);
        const overdue = !t.done && t.dueDate !== null && t.dueDate < today;
        return (
          <div className={`row${t.done ? ' done' : ''}`} key={t.id}>
            <div className="ico" style={{ background: c ? `${c.color}22` : undefined }}>{c?.emoji ?? '📝'}</div>
            <button className="main" onClick={() => onEditTask(t.id)}>
              <div className="title">{t.title}</div>
              <div className="sub">
                <span className="tag" style={{ color: c?.color }}>Tarefa</span>
                {overdue && <span style={{ color: 'var(--red)' }}>atrasada</span>}
              </div>
            </button>
            <button className={`check ${t.done ? 'done' : ''}`} onClick={() => toggleTask(t.id)} aria-label={`${t.title}: ${t.done ? 'concluída' : 'pendente'}`}>
              {t.done && <Icon name="check" />}
            </button>
          </div>
        );
      })}

      {!empty && habits.length === 0 && tasks.length === 0 && <p className="hint" style={{ textAlign: 'center', padding: 24 }}>Nada previsto para este dia.</p>}

      {connected && (otherEvents.length > 0 || eventsError) && (
        <>
          <div className="section-title">Google Agenda</div>
          {eventsError && <p className="warn">{eventsError}</p>}
          {otherEvents.map((e) => (
            <div className="event" key={e.id}>
              <time>{e.start ?? 'dia todo'}</time>
              <span>{e.title}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
