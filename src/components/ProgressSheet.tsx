import { useState } from 'react';
import { addProgress, removeProgress } from '../actions';
import { EMOTION_GROUPS, MAX_EMOTIONS, PROGRESS_MODES, emotionColor, history, isValidProgress, latestProgress, percentOf } from '../core/progress';
import type { Book, ProgressMode } from '../core/types';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

/** Date -> valor de <input type="datetime-local"> no fuso do aparelho. */
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const when = (at: number) => new Date(at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function ProgressSheet({ book, onClose }: { book: Book; onClose: () => void }) {
  const last = latestProgress(book);
  const totalFor = (m: ProgressMode) =>
    m === 'percent' ? '100' : String(history(book).find((e) => e.mode === m)?.total ?? '');

  const [mode, setMode] = useState<ProgressMode>(last?.mode ?? 'pages');
  const [value, setValue] = useState(String(last?.value ?? 0));
  const [total, setTotal] = useState(() => totalFor(last?.mode ?? 'pages'));
  const [at, setAt] = useState(() => localInput(new Date()));
  const [emotions, setEmotions] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [comment, setComment] = useState('');

  const unit = PROGRESS_MODES.find((m) => m.id === mode)!.unit;
  const v = Number(value);
  const t = Number(total);
  const valid = value !== '' && isValidProgress(v, t) && !!at;

  const changeMode = (m: ProgressMode) => {
    const nextTotal = totalFor(m);
    // mantém a posição proporcional ao trocar de unidade
    const pct = t > 0 ? v / t : 0;
    setMode(m);
    setTotal(nextTotal);
    setValue(String(Math.min(Number(nextTotal) || 0, Math.round(pct * Number(nextTotal)))));
  };

  const toggle = (name: string) =>
    setEmotions((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : cur.length < MAX_EMOTIONS ? [...cur, name] : cur));

  return (
    <Sheet title="Progresso" onClose={onClose}>
      <p className="hint" style={{ marginBottom: 12 }}>{book.title}</p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          addProgress(book.id, { at: new Date(at).getTime(), mode, value: v, total: t, emotions, comment: comment.trim() });
          onClose();
        }}
      >
        <div className="field">
          <label htmlFor="p-mode">Como você está lendo?</label>
          <select id="p-mode" value={mode} onChange={(e) => changeMode(e.target.value as ProgressMode)}>
            {PROGRESS_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>

        <div className="inline">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="p-value">Onde parou ({unit})</label>
            <input id="p-value" type="number" inputMode="numeric" min={0} max={t || undefined} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          {mode !== 'percent' && (
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="p-total">Total ({unit})</label>
              <input id="p-total" type="number" inputMode="numeric" min={1} value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
          )}
        </div>
        {t > 0 && (
          <input className="slider" type="range" min={0} max={t} value={Math.min(t, v || 0)} onChange={(e) => setValue(e.target.value)} aria-label="Ajustar progresso" />
        )}
        {!(t > 0) ? <span className="hint">Informe o total para acompanhar.</span>
          : !valid ? <span className="warn">Use um número inteiro de 0 a {t}.</span>
          : <span className="hint">{percentOf({ value: v, total: t })}% concluído</span>}

        <div className="field">
          <label htmlFor="p-at">Quando você leu?</label>
          <input id="p-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </div>

        <div className="field">
          <span className="label">Como você se sentiu? ({emotions.length}/{MAX_EMOTIONS})</span>
          <div className="emotions">
            {(picking ? EMOTION_GROUPS.flatMap((g) => g.items) : emotions).map((name) => (
              <button type="button" key={name} className={emotions.includes(name) ? 'on' : ''} aria-pressed={emotions.includes(name)} onClick={() => toggle(name)}>
                <i style={{ background: emotionColor(name) }} />{name}
              </button>
            ))}
          </div>
          <button type="button" className="btn ghost small" onClick={() => setPicking((p) => !p)}>{picking ? 'Pronto' : '+ Adicionar emoções'}</button>
        </div>

        <div className="field">
          <label htmlFor="p-comment">O que está achando?</label>
          <textarea id="p-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reflexões, teorias, comentários…" />
        </div>

        <button type="submit" className="btn" disabled={!valid}>Salvar</button>
      </form>

      {history(book).length > 0 && (
        <>
          <div className="section-title">Histórico</div>
          {history(book).map((e) => (
            <div className="row" key={e.id}>
              <div className="main">
                <div className="title">{percentOf(e)}%{e.mode !== 'percent' && ` · ${e.value} de ${e.total} ${PROGRESS_MODES.find((m) => m.id === e.mode)!.unit}`}</div>
                <div className="sub"><span>{when(e.at)}</span>{e.emotions.length > 0 && <span>{e.emotions.join(', ')}</span>}</div>
                {e.comment && <p className="comment">{e.comment}</p>}
              </div>
              <button className="icon-btn" aria-label="Excluir registro" onClick={() => { if (window.confirm('Excluir este registro?')) removeProgress(book.id, e.id); }}>
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}
