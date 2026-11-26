import { useState } from 'react';
import { addMonths, MONTHS, formatBR, fromKey, todayKey } from '../core/dates';
import { expensesOfMonth, formatMoney, totalCents } from '../core/expenses';
import type { AppState } from '../core/types';
import { Icon } from '../components/Icon';

export function ExpensesScreen({ state, onEdit }: { state: AppState; onEdit: (id: string) => void }) {
  const [{ year, month0 }, setMonth] = useState(() => {
    const d = fromKey(todayKey());
    return { year: d.getFullYear(), month0: d.getMonth() };
  });
  const list = expensesOfMonth(state.expenses, `${year}-${String(month0 + 1).padStart(2, '0')}`);
  const move = (delta: number) => setMonth((m) => addMonths(m.year, m.month0, delta));

  return (
    <div>
      <div className="month-head">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="Mês anterior"><Icon name="back" /></button>
        <div><strong>{MONTHS[month0]}</strong><small>{year}</small></div>
        <button className="icon-btn" onClick={() => move(1)} aria-label="Próximo mês"><Icon name="next" /></button>
      </div>
      <div className="total"><small>Total do mês</small><strong>{formatMoney(totalCents(list))}</strong></div>

      {list.length === 0 && <p className="hint" style={{ textAlign: 'center', padding: 24 }}>Nenhum gasto neste mês. Toque em + para anotar.</p>}
      {list.map((e) => (
        <button className="row" style={{ width: '100%' }} key={e.id} onClick={() => onEdit(e.id)}>
          <div className="main">
            <div className="title">{e.category}</div>
            <div className="sub"><span>{formatBR(e.date)}</span>{e.note && <span>{e.note}</span>}</div>
          </div>
          <b>{formatMoney(e.amountCents)}</b>
        </button>
      ))}
    </div>
  );
}
