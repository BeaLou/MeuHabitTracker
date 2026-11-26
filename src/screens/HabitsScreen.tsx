import { useState } from 'react';
import { todayKey } from '../core/dates';
import type { AppState } from '../core/types';
import { ChallengeCard } from '../components/ChallengeCard';
import { Icon } from '../components/Icon';
import { HabitCard } from '../components/HabitCard';

interface Props {
  state: AppState;
  onOpenHabit: (id: string, tab: 'calendar' | 'stats' | 'edit') => void;
  onNewHabit: () => void;
  onOpenChallenge: () => void;
}

export function HabitsScreen({ state, onOpenHabit, onNewHabit, onOpenChallenge }: Props) {
  const today = todayKey();
  const [cat, setCat] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const catById = new Map(state.categories.map((c) => [c.id, c]));

  const matches = (categoryId: string) => cat === 'all' || categoryId === cat;
  const active = state.habits.filter((h) => !h.archived && matches(h.categoryId)).sort((a, b) => b.priority - a.priority);
  const archived = state.habits.filter((h) => h.archived && matches(h.categoryId));

  return (
    <div>
      <ChallengeCard habits={state.habits} onOpen={onOpenChallenge} />
      <div className="chips">
        <button className={`chip${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')}>Tudo</button>
        {state.categories.map((c) => (
          <button key={c.id} className={`chip${cat === c.id ? ' on' : ''}`} onClick={() => setCat(c.id)}>{c.emoji} {c.name}</button>
        ))}
      </div>

      {active.length === 0 && (
        <div className="empty">
          <Icon name="search" />
          <p className="lead">Nenhuma pista por aqui ainda.</p>
          <p>Nenhum hábito {cat === 'all' ? 'criado' : 'nesta categoria'}.</p>
          <button className="btn" onClick={onNewHabit}>Criar hábito</button>
        </div>
      )}

      <div className="cards">
        {active.map((h) => (
          <HabitCard key={h.id} habit={h} category={catById.get(h.categoryId)} today={today} onOpen={(tab) => onOpenHabit(h.id, tab)} />
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <button className="chip" onClick={() => setShowArchived((v) => !v)} style={{ margin: '8px 0 12px' }}>
            {showArchived ? 'Ocultar' : 'Mostrar'} arquivados ({archived.length})
          </button>
          {showArchived && (
            <div className="cards">
              {archived.map((h) => (
                <HabitCard key={h.id} habit={h} category={catById.get(h.categoryId)} today={today} onOpen={(tab) => onOpenHabit(h.id, tab)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
