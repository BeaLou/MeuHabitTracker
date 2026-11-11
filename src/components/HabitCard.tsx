import { useState } from 'react';
import { cycleDay, removeHabit, updateHabit } from '../actions';
import { WEEKDAY_SHORT, dayNumber, fromKey, type DateKey } from '../core/dates';
import { cellStatus, computeStats, frequencyLabel, lastSevenDays } from '../core/habits';
import type { Category, Habit } from '../core/types';
import { Icon } from './Icon';

interface Props {
  habit: Habit;
  category: Category | undefined;
  today: DateKey;
  onOpen: (tab: 'calendar' | 'stats' | 'edit') => void;
}

export function HabitCard({ habit, category, today, onOpen }: Props) {
  const [menu, setMenu] = useState(false);
  const stats = computeStats(habit, today);
  const days = lastSevenDays(today);

  return (
    <div className="card" style={{ position: 'relative' }}>
      <div className="head">
        <button className="grow" onClick={() => onOpen('calendar')}>
          <h3>{habit.emoji} {habit.name}</h3>
          <div className="sub" style={{ marginTop: 4 }}>
            {category && <span className="tag" style={{ color: category.color }}>{category.name}</span>}
            <span>{frequencyLabel(habit.frequency)}</span>
            {habit.time && <span>⏰ {habit.time}</span>}
            {habit.gcal && <span title="Sincronizado com o Google Agenda">📅</span>}
          </div>
        </button>
        <button className="icon-btn" aria-label="Mais opções" onClick={() => setMenu((m) => !m)}>
          <Icon name="more" />
        </button>
      </div>

      {menu && (
        <div className="menu" style={{ top: 44 }}>
          <button onClick={() => { setMenu(false); onOpen('edit'); }}>Editar</button>
          <button onClick={() => { setMenu(false); updateHabit(habit.id, { archived: !habit.archived }); }}>
            {habit.archived ? 'Desarquivar' : 'Arquivar'}
          </button>
          <button
            className="danger"
            onClick={() => {
              setMenu(false);
              if (window.confirm(`Excluir "${habit.name}" e todo o histórico?`)) removeHabit(habit.id);
            }}
          >
            Excluir
          </button>
        </div>
      )}

      <div className="strip">
        {days.map((k) => {
          const st = cellStatus(habit, k, today);
          return (
            <div className="c" key={k}>
              <span>{WEEKDAY_SHORT[fromKey(k).getDay()]}</span>
              <button className={`dot ${st}`} disabled={k > today} onClick={() => cycleDay(habit.id, k)} aria-label={`${k}: ${st}`}>
                {dayNumber(k)}
              </button>
            </div>
          );
        })}
      </div>

      <div className="foot">
        <span className="stat" title="Sequência atual"><Icon name="flame" /> {stats.currentStreak}</span>
        <span className="stat" title="Taxa de conclusão"><Icon name="check" /> {stats.rate}%</span>
        <span className="spacer" />
        <button className="icon-btn" aria-label="Calendário" onClick={() => onOpen('calendar')}><Icon name="calendar" /></button>
        <button className="icon-btn" aria-label="Estatísticas" onClick={() => onOpen('stats')}><Icon name="chart" /></button>
      </div>
    </div>
  );
}
