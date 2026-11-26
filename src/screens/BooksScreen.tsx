import { useState } from 'react';
import { addBook, removeBook, setBookStatus, updateBook } from '../actions';
import { BOOK_STATUS, searchBooks, type BookInfo } from '../core/books';
import type { AppState, BookStatus } from '../core/types';
import { ProgressSheet } from '../components/ProgressSheet';
import { latestProgress, percentOf } from '../core/progress';
import { BooksOverview } from '../components/BooksOverview';
import { finishedOn } from '../core/reading';
import { Icon } from '../components/Icon';

const meta = (b: BookInfo) => [b.authors, b.year].filter(Boolean).join(' · ');
const same = (a: BookInfo, b: BookInfo) =>
  a.title.toLowerCase() === b.title.toLowerCase() && a.authors.toLowerCase() === b.authors.toLowerCase();

function Cover({ url }: { url: string | null }) {
  return url ? <img className="cover" src={url} alt="" loading="lazy" /> : <span className="cover" />;
}

const RATINGS = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];

export function BooksScreen({ state }: { state: AppState }) {
  const [status, setStatus] = useState<BookStatus>('want');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookInfo[] | null>(null);
  const [searched, setSearched] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const openBook = state.books.find((b) => b.id === openId);

  const search = async () => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      setResults(await searchBooks(q));
      setSearched(q);
    } catch (e) {
      // TypeError: sem rede ou o serviço recusou a conexão do navegador
      setError(e instanceof TypeError ? 'Não consegui acessar o serviço de busca. Confira a internet.' : (e as Error).message);
      setSearched(q);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => { setResults(null); setError(null); setQuery(''); setSearched(''); };
  const addManual = () => {
    addBook({ title: searched, authors: '', year: null, isbn: null, coverUrl: null }, status);
    clear();
  };

  const list = state.books.filter((b) => b.status === status).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div>
      <form className="inline" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Título, autor ou ISBN" aria-label="Buscar livro" />
        <button className="btn small" type="submit" disabled={busy || !query.trim()}>{busy ? 'Buscando…' : 'Buscar'}</button>
      </form>

      {!results && !error && <BooksOverview state={state} onUpdateProgress={setOpenId} />}

      <h2 className="period">Estante</h2>
      <div className="tabs" role="tablist">
        {BOOK_STATUS.map((s) => (
          <button key={s.id} role="tab" aria-selected={status === s.id} className={status === s.id ? 'on' : ''} onClick={() => setStatus(s.id)}>
            {s.label} ({state.books.filter((b) => b.status === s.id).length})
          </button>
        ))}
      </div>

      {(results || error) ? (
        <>
          {error && <p className="warn">{error}</p>}
          {results?.length === 0 && <p className="hint">Nenhum livro encontrado.</p>}
          {results?.map((r, i) => {
            const saved = state.books.some((b) => same(b, r));
            return (
              <div className="row" key={i}>
                <Cover url={r.coverUrl} />
                <div className="main"><div className="title">{r.title}</div><div className="sub">{meta(r)}</div></div>
                <button className="btn small" disabled={saved} onClick={() => addBook(r, status)}>{saved ? 'Salvo' : 'Salvar'}</button>
              </div>
            );
          })}
          <div className="btns" style={{ marginTop: 12 }}>
            <button className="btn ghost" onClick={addManual}>Salvar só o título digitado</button>
            <button className="btn ghost" onClick={clear}>Voltar à minha lista</button>
          </div>
        </>
      ) : (
        <>
          {list.length === 0 && (
            <div className="empty"><Icon name="search" /><p className="lead">Nenhuma pista por aqui ainda.</p></div>
          )}
          {list.map((b) => (
            <div className="row" key={b.id}>
              <Cover url={b.coverUrl} />
              <div className="main">
                <div className="title">{b.title}</div>
                <div className="sub">{meta(b)}</div>
                {latestProgress(b) && (
                  <div className="read-bar">
                    <span><i style={{ width: `${percentOf(latestProgress(b)!)}%` }} /></span>
                    <small>{percentOf(latestProgress(b)!)}%</small>
                  </div>
                )}
                <button className="btn ghost small" onClick={() => setOpenId(b.id)}>Atualizar progresso</button>{' '}
                <select className="book-status" value={b.status} onChange={(e) => setBookStatus(b.id, e.target.value as BookStatus)} aria-label={`Situação de ${b.title}`}>
                  {BOOK_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                {b.status === 'read' && (
                  <div className="read-info">
                    <select value={b.rating ?? ''} onChange={(e) => updateBook(b.id, { rating: e.target.value ? Number(e.target.value) : undefined })} aria-label={`Nota de ${b.title}`}>
                      <option value="">Sem nota</option>
                      {RATINGS.map((n) => <option key={n} value={n}>★ {n.toLocaleString('pt-BR')}</option>)}
                    </select>
                    <label>Terminei em <input type="date" value={finishedOn(b)} onChange={(e) => updateBook(b.id, { finishedAt: e.target.value })} /></label>
                  </div>
                )}
              </div>
              <button className="icon-btn" aria-label={`Excluir ${b.title}`} onClick={() => { if (window.confirm(`Excluir "${b.title}"?`)) removeBook(b.id); }}>
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </>
      )}
      {openBook && <ProgressSheet key={openBook.id} book={openBook} onClose={() => setOpenId(null)} />}
    </div>
  );
}
