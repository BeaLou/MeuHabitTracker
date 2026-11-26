import { useState } from 'react';
import { setTarget } from '../actions';
import { MONTHS, WEEKDAY_LETTER, addDays, dayNumber, formatLong, fromKey, todayKey, type DateKey } from '../core/dates';
import { formatMoney, parseAmount, totalCents } from '../core/expenses';
import { habitLevel } from '../core/heatmap';
import { doneInWeek } from '../core/habits';
import { targetValue } from '../core/reading';
import { bestClue, byCategory, expensesOfDays, pagesRead, readingDays, weekDays } from '../core/week';
import type { AppState } from '../core/types';
import { Icon } from '../components/Icon';

const LIMIT = 'spending:week';
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const month = (k: DateKey) => MONTHS[fromKey(k).getMonth()].toLowerCase();
const rangeLabel = (a: DateKey, b: DateKey) =>
  month(a) === month(b) ? `${dayNumber(a)} a ${dayNumber(b)} de ${month(b)}` : `${dayNumber(a)} de ${month(a)} a ${dayNumber(b)} de ${month(b)}`;

export function WeekScreen({ state }: { state: AppState }) {
  const today = todayKey();
  const [anchor, setAnchor] = useState(today);
  const [draft, setDraft] = useState<string | null>(null);
  const days = weekDays(anchor);
  const isCurrent = days.includes(today);

  const habits = state.habits
    .filter((h) => !h.archived && h.startDate <= days[6] && (!h.targetDate || h.targetDate >= days[0]))
    .sort((a, b) => b.priority - a.priority);
  const clue = bestClue(habits, days, today);
  const pages = pagesRead(state.books, days);
  const daysRead = readingDays(state.books, days);
  const spent = expensesOfDays(state.expenses, days);
  const total = totalCents(spent);
  const limit = targetValue(state.targets, LIMIT);
  const draftCents = draft?.trim() ? parseAmount(draft) : 0;

  return (
    <div className="week-review">
      <div className="month-head">
        <button className="icon-btn" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="Semana anterior"><Icon name="back" /></button>
        <div><strong>{rangeLabel(days[0], days[6])}</strong><small>{days[0].slice(0, 4)}</small></div>
        <button className="icon-btn" disabled={isCurrent} onClick={() => setAnchor(addDays(anchor, 7))} aria-label="Próxima semana"><Icon name="next" /></button>
      </div>

      <div className="day-card clue">
        <small>{isCurrent ? `Prévia até ${WEEKDAY_NAMES[fromKey(today).getDay()]}` : 'Semana encerrada'}</small>
        <p>
          {clue
            ? `Sua melhor pista: ${clue.habit.name} apareceu ${clue.done} de ${clue.total} ${clue.habit.weeklyTimes ? 'vezes da meta' : clue.total === 1 ? 'dia' : 'dias'}.`
            : 'Nenhuma pista por aqui ainda.'}
        </p>
      </div>

      {habits.length > 0 && (
        <>
          <h2 className="period">Constância</h2>
          <div className="day-card">
            <table className="week-grid">
              <thead>
                <tr><th />{days.map((d, i) => <th key={d} title={formatLong(d)}>{WEEKDAY_LETTER[i]}</th>)}</tr>
              </thead>
              <tbody>
                {habits.map((h) => (
                  <tr key={h.id}>
                    <th scope="row">
                      <span>{h.name}</span>
                      {h.weeklyTimes && <small>{doneInWeek(h, days[0])} de {h.weeklyTimes}</small>}
                    </th>
                    {days.map((d) => {
                      const level = habitLevel(h, d);
                      return <td key={d}><i className={`l${level}`} role="img" aria-label={`${formatLong(d)}: ${level === 4 ? 'feito' : level ? 'em parte' : 'sem registro'}`} /></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <small className="note">Mais rosa = mais perto da meta</small>
          </div>
        </>
      )}

      <h2 className="period">Leitura</h2>
      <div className="day-card">
        <div className="top">
          <b>{pages} {pages === 1 ? 'página' : 'páginas'}</b>
          <span>{daysRead} {daysRead === 1 ? 'dia' : 'dias'} com leitura</span>
        </div>
      </div>

      <h2 className="period">Gastos</h2>
      <div className="day-card">
        <div className="top">
          <b>{formatMoney(total)}</b>
          {limit > 0 && <span>limite semanal {formatMoney(limit)}</span>}
        </div>
        {limit > 0 && (
          <>
            <div className="meter"><i style={{ width: `${Math.min(100, Math.round((total / limit) * 100))}%`, background: total > limit ? 'var(--red)' : undefined }} /></div>
            {total > limit && <p className="warn">{formatMoney(total - limit)} acima do limite.</p>}
          </>
        )}
        {byCategory(spent).slice(0, 3).map((c) => (
          <div className="kv" key={c.category}><span>{c.category}</span><b>{formatMoney(c.cents)}</b></div>
        ))}
        {draft === null ? (
          <button className="link" onClick={() => setDraft(limit ? (limit / 100).toFixed(2).replace('.', ',') : '')}>{limit ? 'Alterar limite' : 'Definir limite semanal'}</button>
        ) : (
          <form className="inline" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (draftCents === null) return; setTarget(LIMIT, draftCents); setDraft(null); }}>
            <input inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ex.: 450" aria-label="Limite semanal em reais (vazio para remover)" autoFocus />
            <button className="btn small" type="submit" disabled={draftCents === null}>Salvar</button>
          </form>
        )}
      </div>
    </div>
  );
}
