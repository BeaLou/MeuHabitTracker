import { useState } from 'react';
import { addCategory, removeCategory, updateCategory } from '../actions';
import { CATEGORY_COLORS, EMOJI_CHOICES } from '../core/defaults';
import type { AppState, Category } from '../core/types';
import { Sheet } from '../components/Sheet';

function CategoryForm({ initial, canDelete, onSubmit, onDelete, onCancel }: {
  initial?: Category;
  canDelete: boolean;
  onSubmit: (c: Omit<Category, 'id'>) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '⭐');
  const [color, setColor] = useState(initial?.color ?? CATEGORY_COLORS[0]);
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit({ name: name.trim(), emoji, color }); }}>
      <div className="field">
        <label htmlFor="c-name">Nome</label>
        <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <span className="label">Ícone</span>
        <div className="emoji-grid">
          {EMOJI_CHOICES.map((e) => <button type="button" key={e} className={emoji === e ? 'on' : ''} onClick={() => setEmoji(e)} aria-label={`Ícone ${e}`}>{e}</button>)}
        </div>
      </div>
      <div className="field">
        <span className="label">Cor</span>
        <div className="swatches">
          {CATEGORY_COLORS.map((c) => <button type="button" key={c} className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Cor ${c}`} />)}
        </div>
      </div>
      <div className="btns">
        <button className="btn" type="submit" disabled={!name.trim()}>Salvar</button>
        <div className="btns row2">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
          {onDelete && <button type="button" className="btn danger" disabled={!canDelete} onClick={onDelete}>Excluir</button>}
        </div>
        {onDelete && !canDelete && <p className="hint">É preciso manter pelo menos uma categoria.</p>}
      </div>
    </form>
  );
}

export function CategoriesScreen({ state }: { state: AppState }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const editingCat = state.categories.find((c) => c.id === editing);

  return (
    <div>
      <button className="btn ghost" style={{ width: '100%', margin: '4px 0 12px' }} onClick={() => setEditing('new')}>+ Nova categoria</button>
      {state.categories.map((c) => {
        const habits = state.habits.filter((h) => h.categoryId === c.id && !h.archived).length;
        const tasks = state.tasks.filter((t) => t.categoryId === c.id && !t.done).length;
        return (
          <button className="row" style={{ width: '100%' }} key={c.id} onClick={() => setEditing(c.id)}>
            <div className="ico" style={{ background: `${c.color}22` }}>{c.emoji}</div>
            <div className="main">
              <div className="title" style={{ color: c.color }}>{c.name}</div>
              <div className="sub">{habits} hábito(s) · {tasks} tarefa(s) pendente(s)</div>
            </div>
          </button>
        );
      })}

      {editing === 'new' && (
        <Sheet title="Nova categoria" onClose={() => setEditing(null)}>
          <CategoryForm canDelete={false} onCancel={() => setEditing(null)} onSubmit={(c) => { addCategory(c); setEditing(null); }} />
        </Sheet>
      )}
      {editingCat && (
        <Sheet title="Editar categoria" onClose={() => setEditing(null)}>
          <CategoryForm
            initial={editingCat}
            canDelete={state.categories.length > 1}
            onCancel={() => setEditing(null)}
            onSubmit={(c) => { updateCategory(editingCat.id, c); setEditing(null); }}
            onDelete={() => {
              if (window.confirm(`Excluir "${editingCat.name}"? Os itens dela vão para outra categoria.`)) {
                removeCategory(editingCat.id);
                setEditing(null);
              }
            }}
          />
        </Sheet>
      )}
    </div>
  );
}
