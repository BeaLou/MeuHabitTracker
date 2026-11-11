import { useState } from 'react';
import type { Category, Task } from '../core/types';

export type TaskDraft = Pick<Task, 'title' | 'categoryId' | 'dueDate' | 'priority'>;

interface Props {
  initial?: Task;
  categories: Category[];
  onSubmit: (d: TaskDraft) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function TaskForm({ initial, categories, onSubmit, onDelete, onCancel }: Props) {
  const [d, setD] = useState<TaskDraft>({
    title: initial?.title ?? '',
    categoryId: initial?.categoryId ?? categories[0]?.id ?? '',
    dueDate: initial?.dueDate ?? null,
    priority: initial?.priority ?? 5,
  });
  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (d.title.trim()) onSubmit({ ...d, title: d.title.trim() });
      }}
    >
      <div className="field">
        <label htmlFor="t-title">Tarefa</label>
        <input id="t-title" value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Levar a Bela pra passear" autoFocus />
      </div>
      <div className="field">
        <label htmlFor="t-cat">Categoria</label>
        <select id="t-cat" value={d.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>
      <div className="inline">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="t-due">Data</label>
          <input id="t-due" type="date" value={d.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="t-prio">Prioridade (0–20)</label>
          <input id="t-prio" type="number" min={0} max={20} value={d.priority} onChange={(e) => set('priority', Math.min(20, Math.max(0, Number(e.target.value) || 0)))} />
        </div>
      </div>
      <div className="btns">
        <button type="submit" className="btn" disabled={!d.title.trim()}>Salvar</button>
        <div className="btns row2">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
          {onDelete && <button type="button" className="btn danger" onClick={onDelete}>Excluir</button>}
        </div>
      </div>
    </form>
  );
}
