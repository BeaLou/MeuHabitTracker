import { MONTHS, WEEKDAY_LETTER, dayNumber, monthGrid, type DateKey } from '../core/dates';
import { cellStatus } from '../core/habits';
import type { Habit } from '../core/types';
import { Icon } from './Icon';

interface Props {
  habit: Habit;
  today: DateKey;
  year: number;
  month0: number;
  selected: DateKey;
  onMonth: (delta: number) => void;
  onPick: (key: DateKey) => void;
  onToggle: (key: DateKey) => void;
}

export function MonthCalendar({ habit, today, year, month0, selected, onMonth, onPick, onToggle }: Props) {
  const grid = monthGrid(year, month0);
  const monthPrefix = `${year}-${String(month0 + 1).padStart(2, '0')}`;
  return (
    <div>
      <div className="month-head">
        <button className="icon-btn accent" onClick={() => onMonth(-1)} aria-label="Mês anterior"><Icon name="back" /></button>
        <div>
          <strong>{MONTHS[month0]}</strong>
          <small>{year}</small>
        </div>
        <button className="icon-btn accent" onClick={() => onMonth(1)} aria-label="Próximo mês"><Icon name="next" /></button>
      </div>
      <div className="cal">
        {WEEKDAY_LETTER.map((l, i) => <span className="wd" key={i}>{l}</span>)}
        {grid.map((k) => {
          const inMonth = k.startsWith(monthPrefix);
          const st = cellStatus(habit, k, today);
          return (
            <button
              key={k}
              className={`dot ${st}${inMonth ? '' : ' out'}${k === selected ? ' sel' : ''}${k > today ? ' future' : ''}`}
              onClick={() => (k === selected && k <= today ? onToggle(k) : onPick(k))}
              aria-label={`${k}: ${st}`}
            >
              {dayNumber(k)}
            </button>
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: 10, textAlign: 'center' }}>
        Toque num dia para selecionar; toque de novo para alternar feito → pulado → vazio (dias futuros não podem ser marcados).
      </p>
    </div>
  );
}
