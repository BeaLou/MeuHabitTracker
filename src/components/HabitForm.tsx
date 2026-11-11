import { useState } from 'react';
import { WEEKDAY_LETTER, todayKey } from '../core/dates';
import { EMOJI_CHOICES } from '../core/defaults';
import type { Category, Frequency, Habit } from '../core/types';
import { googleConfigured } from '../google/auth';

export type HabitDraft = Pick<
  Habit,
  | 'name' | 'description' | 'emoji' | 'categoryId' | 'priority' | 'frequency' | 'startDate' | 'targetDate'
  | 'time' | 'durationMin' | 'reminderMinutes' | 'syncToCalendar'
>;

export function draftFrom(h?: Habit, categoryId?: string): HabitDraft {
  return {
    name: h?.name ?? '',
    description: h?.description ?? '',
    emoji: h?.emoji ?? '✅',
    categoryId: h?.categoryId ?? categoryId ?? '',
    priority: h?.priority ?? 5,
    frequency: h?.frequency ?? { type: 'daily' },
    startDate: h?.startDate ?? todayKey(),
    targetDate: h?.targetDate ?? null,
    time: h?.time ?? null,
    durationMin: h?.durationMin ?? 30,
    reminderMinutes: h?.reminderMinutes ?? null,
    syncToCalendar: h?.syncToCalendar ?? false,
  };
}

const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Sem lembrete' },
  { value: '0', label: 'Na hora' },
  { value: '5', label: '5 min antes' },
  { value: '10', label: '10 min antes' },
  { value: '30', label: '30 min antes' },
  { value: '60', label: '1 hora antes' },
];

interface Props {
  initial?: Habit;
  categories: Category[];
  googleConnected: boolean;
  submitLabel: string;
  onSubmit: (draft: HabitDraft) => void;
  onCancel?: () => void;
}

export function HabitForm({ initial, categories, googleConnected, submitLabel, onSubmit, onCancel }: Props) {
  const [d, setD] = useState<HabitDraft>(() => draftFrom(initial, categories[0]?.id));
  const set = <K extends keyof HabitDraft>(k: K, v: HabitDraft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const freq = d.frequency;
  const toggleDay = (day: number) => {
    const cur = freq.type === 'weekdays' ? freq.days : [];
    const days = cur.includes(day) ? cur.filter((x) => x !== day) : [...cur, day];
    set('frequency', { type: 'weekdays', days });
  };

  const canSync = googleConnected && !!d.time;
  const invalid = d.name.trim() === '' || (freq.type === 'weekdays' && freq.days.length === 0);

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (invalid) return;
        onSubmit({ ...d, name: d.name.trim(), syncToCalendar: d.syncToCalendar && !!d.time });
      }}
    >
      <div className="field">
        <label htmlFor="h-name">Nome do hábito</label>
        <input id="h-name" value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Pilates" autoFocus={!initial} />
      </div>

      <div className="field">
        <span className="label">Ícone</span>
        <div className="emoji-grid">
          {EMOJI_CHOICES.map((e) => (
            <button type="button" key={e} className={d.emoji === e ? 'on' : ''} onClick={() => set('emoji', e)} aria-label={`Ícone ${e}`}>{e}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="h-cat">Categoria</label>
        <select id="h-cat" value={d.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="h-desc">Descrição</label>
        <textarea id="h-desc" rows={2} value={d.description} onChange={(e) => set('description', e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="h-freq">Frequência</label>
        <select
          id="h-freq"
          value={freq.type}
          onChange={(e) => set('frequency', (e.target.value === 'daily' ? { type: 'daily' } : { type: 'weekdays', days: [1, 3, 5] }) as Frequency)}
        >
          <option value="daily">Todos os dias</option>
          <option value="weekdays">Dias específicos</option>
        </select>
        {freq.type === 'weekdays' && (
          <div className="emoji-grid" style={{ marginTop: 4 }}>
            {WEEKDAY_LETTER.map((l, i) => (
              <button type="button" key={i} className={freq.days.includes(i) ? 'on' : ''} onClick={() => toggleDay(i)} aria-label={`Dia ${i}`}>{l}</button>
            ))}
          </div>
        )}
      </div>

      <div className="inline">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="h-time">Horário</label>
          <input id="h-time" type="time" value={d.time ?? ''} onChange={(e) => set('time', e.target.value || null)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="h-dur">Duração (min)</label>
          <input id="h-dur" type="number" min={5} step={5} value={d.durationMin} onChange={(e) => set('durationMin', Math.max(5, Number(e.target.value) || 30))} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="h-rem">Lembrete</label>
        <select
          id="h-rem"
          value={d.reminderMinutes == null ? '' : String(d.reminderMinutes)}
          disabled={!d.time}
          onChange={(e) => set('reminderMinutes', e.target.value === '' ? null : Number(e.target.value))}
        >
          {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {!d.time && <span className="hint">Defina um horário para ativar o lembrete.</span>}
      </div>

      <div className="inline">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="h-prio">Prioridade (0–20)</label>
          <input id="h-prio" type="number" min={0} max={20} value={d.priority} onChange={(e) => set('priority', Math.min(20, Math.max(0, Number(e.target.value) || 0)))} />
        </div>
      </div>

      <div className="inline">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="h-start">Data de início</label>
          <input id="h-start" type="date" value={d.startDate} onChange={(e) => set('startDate', e.target.value || todayKey())} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="h-end">Data alvo</label>
          <input id="h-end" type="date" value={d.targetDate ?? ''} onChange={(e) => set('targetDate', e.target.value || null)} />
        </div>
      </div>

      <div className="field">
        <label className="inline" htmlFor="h-sync" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 15, color: 'var(--text)' }}>
          <input id="h-sync" type="checkbox" checked={d.syncToCalendar && canSync} disabled={!canSync} onChange={(e) => set('syncToCalendar', e.target.checked)} />
          Sincronizar com o Google Agenda
        </label>
        {!googleConfigured && <span className="hint">Configure o Google nos Ajustes (⚙) para ativar.</span>}
        {googleConfigured && !googleConnected && <span className="hint">Conecte sua conta do Google nos Ajustes (⚙).</span>}
        {googleConnected && !d.time && <span className="hint">Defina um horário para aparecer na agenda.</span>}
      </div>

      <div className="btns row2">
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="btn" disabled={invalid}>{submitLabel}</button>
      </div>
    </form>
  );
}
