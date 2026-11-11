import { useEffect, useMemo, useState } from 'react';
import { cycleDay, toggleTask } from '../actions';
import { dayItems, gridRange, type AgendaEvent, type DayItem } from '../core/agenda';
import { MONTHS, WEEKDAY_SHORT, dayNumber, formatLong, fromKey, monthGrid, todayKey, type DateKey } from '../core/dates';
import type { AppState } from '../core/types';
import { Icon } from '../components/Icon';
import { listRangeEvents } from '../google/sync';
import { useMediaQuery } from '../hooks';

interface Props {
  state: AppState;
  onOpenHabit: (id: string) => void;
  onEditTask: (id: string) => void;
}

export function AgendaScreen({ state, onOpenHabit, onEditTask }: Props) {
  const today = todayKey();
  const [ym, setYm] = useState(() => {
    const d = fromKey(today);
    return { year: d.getFullYear(), month0: d.getMonth() };
  });
  const [selected, setSelected] = useState<DateKey>(today);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wide = useMediaQuery('(min-width: 900px)');
  const maxChips = wide ? 5 : 3;

  const grid = useMemo(() => monthGrid(ym.year, ym.month0), [ym.year, ym.month0]);
  const prefix = `${ym.year}-${String(ym.month0 + 1).padStart(2, '0')}`;
  const connected = state.google.connected;
  const lastSyncAt = state.google.lastSyncAt;

  useEffect(() => {
    if (!connected) {
      setEvents([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    const { from, to } = gridRange(grid);
    listRangeEvents(from, to)
      .then((ev) => { if (!cancelled) setEvents(ev); })
      .catch(() => { if (!cancelled) { setEvents([]); setError('Não foi possível ler o Google Agenda agora.'); } });
    return () => { cancelled = true; };
  }, [connected, grid, lastSyncAt]);

  const activeHabits = state.habits;
  const itemsByDay = useMemo(() => {
    const map = new Map<DateKey, DayItem[]>();
    for (const k of grid) map.set(k, dayItems(k, today, events, activeHabits, state.tasks));
    return map;
  }, [grid, today, events, activeHabits, state.tasks]);

  const move = (delta: number) => {
    setYm((p) => {
      const m = p.month0 + delta;
      return { year: p.year + Math.floor(m / 12), month0: ((m % 12) + 12) % 12 };
    });
  };
  const goToday = () => {
    const d = fromKey(today);
    setYm({ year: d.getFullYear(), month0: d.getMonth() });
    setSelected(today);
  };

  const dayList = itemsByDay.get(selected) ?? dayItems(selected, today, events, activeHabits, state.tasks);
  const catColor = (id: string) => state.categories.find((c) => c.id === id)?.color;

  return (
    <div className="agenda">
      <div className="agenda-head">
        <button className="icon-btn accent" onClick={() => move(-1)} aria-label="Mês anterior"><Icon name="back" /></button>
        <div className="title"><strong>{MONTHS[ym.month0]}</strong><small>{ym.year}</small></div>
        <button className="btn ghost small" onClick={goToday}>Hoje</button>
        <button className="icon-btn accent" onClick={() => move(1)} aria-label="Próximo mês"><Icon name="next" /></button>
      </div>

      {!connected && (
        <p className="hint">Conecte o Google em Ajustes para ver também os eventos da sua agenda aqui. Seus hábitos e tarefas já aparecem.</p>
      )}
      {error && <p className="warn">{error}</p>}

      <div className="mgrid" role="grid" aria-label={`${MONTHS[ym.month0]} ${ym.year}`}>
        {WEEKDAY_SHORT.map((w) => <span className="wd" key={w}>{w}</span>)}
        {grid.map((k) => {
          const items = itemsByDay.get(k) ?? [];
          const shown = items.slice(0, maxChips);
          const more = items.length - shown.length;
          return (
            <button
              key={k}
              className={`mcell${k.startsWith(prefix) ? '' : ' out'}${k === selected ? ' sel' : ''}${k === today ? ' today' : ''}`}
              onClick={() => setSelected(k)}
              aria-label={`${formatLong(k)}: ${items.length} itens`}
            >
              <span className="num">{dayNumber(k)}</span>
              {shown.map((it, i) => <Chip key={i} item={it} color={it.kind === 'habit' ? catColor(it.habit.categoryId) : undefined} />)}
              {more > 0 && <span className="mmore">+{more}</span>}
            </button>
          );
        })}
      </div>

      <div className="legend">
        <span><i className="sw ev" /> Evento</span>
        <span><i className="sw hb" /> Hábito</span>
        <span><i className="sw tk" /> Tarefa</span>
      </div>

      <div className="section-title">{formatLong(selected)}</div>
      {dayList.length === 0 && <p className="hint">Nada neste dia.</p>}
      {dayList.map((it) => {
        if (it.kind === 'event') {
          const e = it.event;
          return (
            <div className="event" key={`e${e.id}${e.startDate}`}>
              <time>{e.allDay ? 'dia todo' : e.start}</time>
              <span>{e.title}</span>
            </div>
          );
        }
        if (it.kind === 'habit') {
          const h = it.habit;
          const future = selected > today;
          const st = it.status;
          return (
            <div className="row" key={`h${h.id}`}>
              <div className="ico" style={{ background: catColor(h.categoryId) ? `${catColor(h.categoryId)}22` : undefined }}>{h.emoji}</div>
              <button className="main" onClick={() => onOpenHabit(h.id)}>
                <div className="title">{h.name}</div>
                <div className="sub"><span className="tag">Hábito</span>{h.time && <span>⏰ {h.time}</span>}</div>
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
        }
        const t = it.task;
        return (
          <div className={`row${t.done ? ' done' : ''}`} key={`t${t.id}`}>
            <div className="ico">📝</div>
            <button className="main" onClick={() => onEditTask(t.id)}>
              <div className="title">{t.title}</div>
              <div className="sub"><span className="tag">Tarefa</span></div>
            </button>
            <button className={`check ${t.done ? 'done' : ''}`} onClick={() => toggleTask(t.id)} aria-label={`${t.title}: ${t.done ? 'concluída' : 'pendente'}`}>
              {t.done && <Icon name="check" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Chip({ item, color }: { item: DayItem; color?: string }) {
  if (item.kind === 'event') {
    const e = item.event;
    return e.allDay
      ? <span className="mchip allday">{e.title}</span>
      : <span className="mchip ev">{e.start && <i>{e.start}</i>}{e.title}</span>;
  }
  if (item.kind === 'habit') {
    return (
      <span className={`mchip hb st-${item.status}`} style={color ? { borderLeftColor: color } : undefined}>
        {item.habit.time && <i>{item.habit.time}</i>}{item.habit.emoji} {item.habit.name}
      </span>
    );
  }
  return <span className={`mchip tk${item.task.done ? ' fin' : ''}`}>{item.task.title}</span>;
}
