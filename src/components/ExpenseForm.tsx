import { useState } from 'react';
import type { ExpenseInput } from '../actions';
import { todayKey } from '../core/dates';
import { EXPENSE_CATEGORIES, parseAmount } from '../core/expenses';
import type { Expense } from '../core/types';

interface Props {
  initial?: Expense;
  onSubmit: (d: ExpenseInput) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function ExpenseForm({ initial, onSubmit, onDelete, onCancel }: Props) {
  const [amount, setAmount] = useState(initial ? (initial.amountCents / 100).toFixed(2).replace('.', ',') : '');
  const [date, setDate] = useState(initial?.date ?? todayKey());
  const [category, setCategory] = useState(initial?.category ?? EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState(initial?.note ?? '');
  const cents = parseAmount(amount);

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (cents) onSubmit({ date, category, amountCents: cents, note: note.trim() });
      }}
    >
      <div className="field">
        <label htmlFor="g-valor">Valor (R$)</label>
        <input id="g-valor" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" autoFocus={!initial} />
        {amount && !cents && <span className="warn">Digite um valor como 25,90.</span>}
      </div>
      <div className="inline">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="g-data">Data</label>
          <input id="g-data" type="date" value={date} onChange={(e) => setDate(e.target.value || todayKey())} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="g-cat">Categoria</label>
          <select id="g-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="g-obs">Observação</label>
        <textarea id="g-obs" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="btns">
        <button type="submit" className="btn" disabled={!cents}>Salvar</button>
        <div className="btns row2">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
          {onDelete && <button type="button" className="btn danger" onClick={onDelete}>Excluir</button>}
        </div>
      </div>
    </form>
  );
}
