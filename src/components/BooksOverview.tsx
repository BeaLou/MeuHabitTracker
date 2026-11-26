import { useState } from 'react';
import { setTarget } from '../actions';
import { todayKey } from '../core/dates';
import { PROGRESS_MODES, emotionColor, latestProgress, percentOf } from '../core/progress';
import { emotionSummary, formatRating, readInYear, recentReads, targetValue } from '../core/reading';
import type { AppState, Book } from '../core/types';

function BigCover({ book }: { book: Book }) {
  return book.coverUrl
    ? <img className="big-cover" src={book.coverUrl} alt="" loading="lazy" />
    : <span className="big-cover">{book.title}</span>;
}

export function BooksOverview({ state, onUpdateProgress }: { state: AppState; onUpdateProgress: (id: string) => void }) {
  const year = Number(todayKey().slice(0, 4));
  const id = `reading:${year}`;
  const goal = targetValue(state.targets, id);
  const done = readInYear(state.books, year).length;
  const [draft, setDraft] = useState<string | null>(null);

  const current = state.books.filter((b) => b.status === 'reading').sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const entry = current ? latestProgress(current) : undefined;
  const recent = recentReads(state.books);
  const emotions = emotionSummary(state.books, year);

  return (
    <div className="overview">
      <div className="day-card">
        <div className="top">
          <b>Meta de {year}</b>
          <span>{goal ? `${done} de ${goal} livros` : `${done} ${done === 1 ? 'lido' : 'lidos'}`}</span>
        </div>
        {goal > 0 && <div className="meter"><i style={{ width: `${Math.min(100, Math.round((done / goal) * 100))}%` }} /></div>}
        {draft === null ? (
          <button className="link" onClick={() => setDraft(goal ? String(goal) : '')}>{goal ? 'Alterar meta' : 'Definir meta'}</button>
        ) : (
          <form className="inline" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); setTarget(id, Math.max(0, Math.round(Number(draft) || 0))); setDraft(null); }}>
            <input type="number" inputMode="numeric" min={0} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`Livros para ler em ${year}`} autoFocus />
            <button className="btn small" type="submit">Salvar</button>
          </form>
        )}
      </div>

      {current && (
        <div className="day-card hero">
          <BigCover book={current} />
          <div className="info">
            <div>
              <b className="serif">{current.title}</b>
              <small>{current.authors}</small>
            </div>
            {entry && (
              <>
                <div className="meter"><i style={{ width: `${percentOf(entry)}%` }} /></div>
                <small>{percentOf(entry)}%{entry.mode !== 'percent' && ` · ${entry.value} de ${entry.total} ${PROGRESS_MODES.find((m) => m.id === entry.mode)!.unit}`}</small>
              </>
            )}
            <button className="btn small" onClick={() => onUpdateProgress(current.id)}>Registrar leitura</button>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <>
          <h2 className="period">Lidos recentemente</h2>
          <div className="shelf">
            {recent.map((b) => (
              <figure key={b.id}>
                <BigCover book={b} />
                <figcaption>{b.rating ? formatRating(b.rating) : 'Sem nota'}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {emotions.length > 0 && (
        <>
          <h2 className="period">Como você se sentiu em {year}</h2>
          <div className="day-card">
            {emotions.map((e) => (
              <div className="feeling" key={e.name}>
                <div className="top"><span>{e.name}</span><span>{e.count} {e.count === 1 ? 'registro' : 'registros'}</span></div>
                <div className="meter"><i style={{ width: `${Math.round((e.count / emotions[0].count) * 100)}%`, background: emotionColor(e.name) }} /></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
