import { useCallback, useState } from 'react';
import { formatLong, todayKey } from './core/dates';
import { addExpense, addHabit, addTask, removeExpense, removeTask, updateExpense, updateTask } from './actions';
import { ExpenseForm } from './components/ExpenseForm';
import { HabitForm } from './components/HabitForm';
import { Icon, type IconName } from './components/Icon';
import { ChallengeScreen } from './screens/ChallengeScreen';
import { Sheet } from './components/Sheet';
import { TaskForm } from './components/TaskForm';
import { useAutoDriveSync, useAutoSync, useReminders, useTimerWatcher, useTokenRenewal } from './hooks';
import { AgendaScreen } from './screens/AgendaScreen';
import { HabitDetail, type DetailTab } from './screens/HabitDetail';
import { BooksScreen } from './screens/BooksScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { HabitsScreen } from './screens/HabitsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TasksScreen } from './screens/TasksScreen';
import { TimerScreen } from './screens/TimerScreen';
import { WeekScreen } from './screens/WeekScreen';
import { TodayScreen } from './screens/TodayScreen';
import { useAppState } from './store';

type Tab = 'today' | 'agenda' | 'habits' | 'tasks' | 'more' | 'week' | 'books' | 'expenses' | 'timer';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Hoje', icon: 'today' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'habits', label: 'Hábitos', icon: 'habits' },
  { id: 'tasks', label: 'Tarefas', icon: 'tasks' },
  { id: 'more', label: 'Mais', icon: 'more' },
];

/** Telas abertas pelo menu Mais. */
const MORE: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'week', label: 'Semana', icon: 'chart' },
  { id: 'books', label: 'Livros', icon: 'book' },
  { id: 'expenses', label: 'Gastos', icon: 'wallet' },
  { id: 'timer', label: 'Timer', icon: 'timer' },
];

type SheetKind = null | 'chooser' | 'habit' | 'task' | 'expense';

export default function App() {
  const state = useAppState();
  useTimerWatcher();
  useReminders();
  useTokenRenewal();
  useAutoSync();
  useAutoDriveSync();

  const [tab, setTab] = useState<Tab>('today');
  const [detail, setDetail] = useState<{ id: string; tab: DetailTab } | null>(null);
  const [challenge, setChallenge] = useState(false);
  const [settings, setSettings] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [editTask, setEditTask] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<string | null>(null);
  const closeExpense = () => { setSheet(null); setEditExpense(null); };
  const closeDetail = useCallback(() => setDetail(null), []);

  const task = state.tasks.find((t) => t.id === editTask);
  const expense = state.expenses.find((e) => e.id === editExpense);
  const inMore = MORE.some((m) => m.id === tab);
  const title = tab === 'today' ? 'Oi, Bea' : [...TABS, ...MORE].find((t) => t.id === tab)!.label;
  const showFab = tab === 'today' || tab === 'agenda' || tab === 'habits' || tab === 'tasks' || tab === 'expenses';
  const onFab = () => setSheet(tab === 'habits' ? 'habit' : tab === 'tasks' ? 'task' : tab === 'expenses' ? 'expense' : 'chooser');

  return (
    <div className="app">
      <div className="topbar">
        {inMore && <button className="icon-btn" onClick={() => setTab('more')} aria-label="Voltar"><Icon name="back" /></button>}
        <div className="heading">
          {tab === 'today' && <small>{formatLong(todayKey())}</small>}
          <h1>{title}</h1>
        </div>
      </div>

      <main className="screen">
        {tab === 'today' && (
          <TodayScreen state={state} onOpenHabit={(id) => setDetail({ id, tab: 'calendar' })} onEditTask={setEditTask} onNewHabit={() => setSheet('habit')} onOpenChallenge={() => setChallenge(true)} onOpenBooks={() => setTab('books')} onNewExpense={() => setSheet('expense')} />
        )}
        {tab === 'agenda' && (
          <AgendaScreen state={state} onOpenHabit={(id) => setDetail({ id, tab: 'calendar' })} onEditTask={setEditTask} />
        )}
        {tab === 'habits' && (
          <HabitsScreen state={state} onOpenHabit={(id, t) => setDetail({ id, tab: t })} onNewHabit={() => setSheet('habit')} onOpenChallenge={() => setChallenge(true)} />
        )}
        {tab === 'tasks' && <TasksScreen state={state} onEditTask={setEditTask} />}
        {tab === 'timer' && <TimerScreen state={state} />}
        {tab === 'week' && <WeekScreen state={state} />}
        {tab === 'books' && <BooksScreen state={state} />}
        {tab === 'expenses' && <ExpensesScreen state={state} onEdit={setEditExpense} />}
        {tab === 'more' && (
          <div>
            {MORE.map((m) => (
              <button key={m.id} className="row" style={{ width: '100%' }} onClick={() => setTab(m.id)}>
                <span className="ico"><Icon name={m.icon} /></span>
                <span className="main title">{m.label}</span>
                <Icon name="next" />
              </button>
            ))}
            <button className="row" style={{ width: '100%' }} onClick={() => setSettings(true)}>
              <span className="ico"><Icon name="gear" /></span>
              <span className="main title">Ajustes</span>
              <Icon name="next" />
            </button>
          </div>
        )}
      </main>

      {showFab && (
        <button className="fab" onClick={onFab} aria-label="Adicionar"><Icon name="plus" /></button>
      )}

      <nav className="bottom-nav" aria-label="Navegação principal">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id || (t.id === 'more' && inMore) ? 'active' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="pill"><Icon name={t.icon} /></span>
            {t.label}
          </button>
        ))}
      </nav>

      {challenge && <ChallengeScreen state={state} onBack={() => setChallenge(false)} onOpenHabit={(id) => setDetail({ id, tab: 'edit' })} />}
      {detail && <HabitDetail state={state} habitId={detail.id} initialTab={detail.tab} onBack={closeDetail} />}
      {settings && <SettingsScreen state={state} onBack={() => setSettings(false)} />}

      {sheet === 'chooser' && (
        <Sheet title="Adicionar" onClose={() => setSheet(null)}>
          <div className="btns">
            <button className="btn" onClick={() => setSheet('habit')}>Novo hábito</button>
            <button className="btn ghost" onClick={() => setSheet('task')}>Nova tarefa</button>
          </div>
        </Sheet>
      )}
      {sheet === 'habit' && (
        <Sheet title="Novo hábito" onClose={() => setSheet(null)}>
          <HabitForm
            categories={state.categories}
            googleConnected={state.google.connected}
            submitLabel="Criar hábito"
            onCancel={() => setSheet(null)}
            onSubmit={(d) => { addHabit(d); setSheet(null); }}
          />
        </Sheet>
      )}
      {(sheet === 'expense' || expense) && (
        <Sheet title={expense ? 'Editar gasto' : 'Novo gasto'} onClose={closeExpense}>
          <ExpenseForm
            key={expense?.id ?? 'new'}
            initial={expense}
            onCancel={closeExpense}
            onSubmit={(d) => { if (expense) updateExpense(expense.id, d); else addExpense(d); closeExpense(); }}
            onDelete={expense ? () => { if (window.confirm('Excluir este gasto?')) { removeExpense(expense.id); closeExpense(); } } : undefined}
          />
        </Sheet>
      )}
      {(sheet === 'task' || task) && (
        <Sheet title={task ? 'Editar tarefa' : 'Nova tarefa'} onClose={() => { setSheet(null); setEditTask(null); }}>
          <TaskForm
            key={task?.id ?? 'new'}
            initial={task}
            categories={state.categories}
            onCancel={() => { setSheet(null); setEditTask(null); }}
            onSubmit={(d) => {
              if (task) updateTask(task.id, d);
              else addTask(d);
              setSheet(null);
              setEditTask(null);
            }}
            onDelete={task ? () => { removeTask(task.id); setEditTask(null); } : undefined}
          />
        </Sheet>
      )}
    </div>
  );
}
