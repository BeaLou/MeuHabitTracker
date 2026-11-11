import { useState } from 'react';
import { addTask, toggleTask } from '../actions';
import { formatBR, todayKey } from '../core/dates';
import type { AppState } from '../core/types';
import { Icon } from '../components/Icon';

interface Props {
  state: AppState;
  onEditTask: (id: string) => void;
}

export function TasksScreen({ state, onEditTask }: Props) {
  const today = todayKey();
  const [title, setTitle] = useState('');
  const catById = new Map(state.categories.map((c) => [c.id, c]));

  const pending = state.tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || b.priority - a.priority);
  const done = state.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, 30);

  const quickAdd = () => {
    const t = title.trim();
    if (!t) return;
    addTask({ title: t, categoryId: state.categories[0]?.id });
    setTitle('');
  };

  const row = (id: string) => {
    const t = state.tasks.find((x) => x.id === id)!;
    const c = catById.get(t.categoryId);
    const overdue = !t.done && t.dueDate !== null && t.dueDate < today;
    return (
      <div className={`row${t.done ? ' done' : ''}`} key={t.id}>
        <button className={`check ${t.done ? 'done' : ''}`} onClick={() => toggleTask(t.id)} aria-label={`${t.title}: ${t.done ? 'concluída' : 'pendente'}`}>
          {t.done && <Icon name="check" />}
        </button>
        <button className="main" onClick={() => onEditTask(t.id)}>
          <div className="title">{t.title}</div>
          <div className="sub">
            {c && <span className="tag" style={{ color: c.color }}>{c.emoji} {c.name}</span>}
            {t.dueDate && <span style={{ color: overdue ? 'var(--red)' : undefined }}>📅 {formatBR(t.dueDate)}</span>}
          </div>
        </button>
      </div>
    );
  };

  return (
    <div>
      <form className="inline" style={{ marginBottom: 8 }} onSubmit={(e) => { e.preventDefault(); quickAdd(); }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nova tarefa…" aria-label="Nova tarefa" />
        <button className="btn" type="submit" disabled={!title.trim()}>Adicionar</button>
      </form>

      {pending.length === 0 && done.length === 0 && (
        <div className="empty"><div className="big">✅</div><p>Nenhuma tarefa. Escreva uma acima.</p></div>
      )}
      {pending.map((t) => row(t.id))}

      {done.length > 0 && (
        <>
          <div className="section-title">Concluídas</div>
          {done.map((t) => row(t.id))}
        </>
      )}
    </div>
  );
}
