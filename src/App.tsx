import { useCallback, useState } from 'react';
import { addHabit, addTask, removeTask, updateTask } from './actions';
import { HabitForm } from './components/HabitForm';
import { Icon, type IconName } from './components/Icon';
import { Sheet } from './components/Sheet';
import { TaskForm } from './components/TaskForm';
import { useAutoDriveSync, useAutoSync, useReminders, useTimerWatcher } from './hooks';
import { AgendaScreen } from './screens/AgendaScreen';
import { CategoriesScreen } from './screens/CategoriesScreen';
import { HabitDetail, type DetailTab } from './screens/HabitDetail';
import { HabitsScreen } from './screens/HabitsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TasksScreen } from './screens/TasksScreen';
import { TimerScreen } from './screens/TimerScreen';
import { TodayScreen } from './screens/TodayScreen';
import { useAppState } from './store';

type Tab = 'today' | 'agenda' | 'habits' | 'tasks' | 'categories' | 'timer';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Hoje', icon: 'today' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'habits', label: 'Hábitos', icon: 'habits' },
  { id: 'tasks', label: 'Tarefas', icon: 'tasks' },
  { id: 'categories', label: 'Categorias', icon: 'categories' },
  { id: 'timer', label: 'Timer', icon: 'timer' },
];

type SheetKind = null | 'chooser' | 'habit' | 'task';

export default function App() {
  const state = useAppState();
  useTimerWatcher();
  useReminders();
  useAutoSync();
  useAutoDriveSync();

  const [tab, setTab] = useState<Tab>('today');
  const [detail, setDetail] = useState<{ id: string; tab: DetailTab } | null>(null);
  const [settings, setSettings] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [editTask, setEditTask] = useState<string | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);

  const task = state.tasks.find((t) => t.id === editTask);
  const showFab = tab === 'today' || tab === 'agenda' || tab === 'habits' || tab === 'tasks';
  const onFab = () => setSheet(tab === 'habits' ? 'habit' : tab === 'tasks' ? 'task' : 'chooser');

  return (
    <div className="app">
      <div className="topbar">
        <h1>{TABS.find((t) => t.id === tab)!.label}</h1>
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Ajustes"><Icon name="gear" /></button>
      </div>

      <main className="screen">
        {tab === 'today' && (
          <TodayScreen state={state} onOpenHabit={(id) => setDetail({ id, tab: 'calendar' })} onEditTask={setEditTask} onNewHabit={() => setSheet('habit')} />
        )}
        {tab === 'agenda' && (
          <AgendaScreen state={state} onOpenHabit={(id) => setDetail({ id, tab: 'calendar' })} onEditTask={setEditTask} />
        )}
        {tab === 'habits' && (
          <HabitsScreen state={state} onOpenHabit={(id, t) => setDetail({ id, tab: t })} onNewHabit={() => setSheet('habit')} />
        )}
        {tab === 'tasks' && <TasksScreen state={state} onEditTask={setEditTask} />}
        {tab === 'categories' && <CategoriesScreen state={state} />}
        {tab === 'timer' && <TimerScreen state={state} />}
      </main>

      {showFab && (
        <button className="fab" onClick={onFab} aria-label="Adicionar"><Icon name="plus" /></button>
      )}

      <nav className="bottom-nav" aria-label="Navegação principal">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="pill"><Icon name={t.icon} /></span>
            {t.label}
          </button>
        ))}
      </nav>

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
