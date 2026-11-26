import type { DateKey } from './dates';

export type Frequency =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }; // 0 = domingo … 6 = sábado

export type DayStatus = 'done' | 'skipped';

/** Vínculo de um hábito com um evento recorrente do Google Agenda. */
export interface CalendarLink {
  eventId: string;
  /** 'app': evento criado pelo Ritmo (pode ser apagado junto). 'adopted': evento que já existia na agenda. */
  origin: 'app' | 'adopted';
  /** `updated` do evento no Google (ms) na última sincronização. */
  remoteUpdated: number;
  /** Momento (ms) da última sincronização bem-sucedida deste hábito. */
  syncedAt: number;
}

export interface Habit {
  id: string;
  name: string;
  description: string;
  emoji: string;
  categoryId: string;
  /** Maior = mais importante. */
  priority: number;
  frequency: Frequency;
  /** Meta "N vezes por semana", em quaisquer dias. Usada com frequency 'daily', que é o que versões antigas do app enxergam. */
  weeklyTimes?: number;
  /** Meta diária em quantidade (ex.: 8 copos). Cada toque soma `step`. */
  goal?: { target: number; unit: string; step: number };
  /** Quantidade registrada em cada dia, para hábitos com `goal`. */
  amounts?: Record<DateKey, number>;
  amountsAt?: Record<DateKey, number>;
  startDate: DateKey;
  targetDate: DateKey | null;
  /** "HH:mm" — necessário para sincronizar com a agenda. */
  time: string | null;
  durationMin: number;
  /** Minutos antes do horário para lembrar (agenda e notificação). null = sem lembrete. */
  reminderMinutes: number | null;
  syncToCalendar: boolean;
  archived: boolean;
  log: Record<DateKey, DayStatus>;
  /** Momento (ms) da última mudança de cada dia do `log` (inclusive ao desmarcar) — usado no merge entre aparelhos. */
  logAt?: Record<DateKey, number>;
  notes: Record<DateKey, string>;
  notesAt?: Record<DateKey, number>;
  gcal: CalendarLink | null;
  /** Presente nos hábitos criados pelo Desafio 75; hábitos com o mesmo id formam um desafio. */
  challenge?: { id: string; order: number };
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  title: string;
  categoryId: string;
  dueDate: DateKey | null;
  priority: number;
  done: boolean;
  doneAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Expense {
  id: string;
  date: DateKey;
  category: string;
  /** Valor em centavos, para somar sem erro de arredondamento. */
  amountCents: number;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export type BookStatus = 'want' | 'reading' | 'read';

export type ProgressMode = 'pages' | 'percent' | 'minutes';

export interface ProgressEntry {
  id: string;
  /** Momento da leitura (ms). */
  at: number;
  mode: ProgressMode;
  /** Página, porcentagem ou minuto em que a leitura parou. */
  value: number;
  /** Total de páginas ou minutos; 100 no modo porcentagem. */
  total: number;
  emotions: string[];
  comment: string;
}

export interface Book {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  isbn: string | null;
  coverUrl: string | null;
  status: BookStatus;
  progress?: ProgressEntry[];
  /** Nota de 0,5 a 5. */
  rating?: number;
  /** Dia em que a leitura terminou; '' = não sei (não conta na meta do ano). */
  finishedAt?: DateKey | '';
  createdAt: number;
  updatedAt: number;
}

/** Metas sincronizadas entre aparelhos: 'reading:AAAA' (livros no ano) e 'spending:week' (centavos). 0 = sem meta. */
export interface Target {
  id: string;
  value: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  updatedAt?: number;
}

export interface FocusSession {
  id: string;
  startedAt: number;
  seconds: number;
  habitId: string | null;
}

export interface TimerState {
  status: 'idle' | 'running' | 'paused';
  totalSec: number;
  /** Timestamp (ms) em que o contador zera, quando running. */
  endsAt: number | null;
  /** Segundos restantes, quando paused. */
  remainingSec: number | null;
  habitId: string | null;
  markDoneOnFinish: boolean;
}

export interface GoogleSettings {
  connected: boolean;
  lastSyncAt: number | null;
  lastSyncMessage: string | null;
  /** Sincroniza os dados do app entre aparelhos usando a pasta privada do app no Google Drive. */
  driveSync: boolean;
  lastDriveSyncAt: number | null;
  lastDriveMessage: string | null;
}

export interface AppState {
  version: 1;
  habits: Habit[];
  tasks: Task[];
  expenses: Expense[];
  books: Book[];
  targets: Target[];
  categories: Category[];
  sessions: FocusSession[];
  timer: TimerState;
  google: GoogleSettings;
  /** IDs de eventos da agenda a apagar na próxima sincronização (hábitos excluídos). */
  pendingEventDeletes: string[];
  /** id -> momento (ms) da exclusão. Evita que um item apagado num aparelho "ressuscite" vindo de outro. */
  tombstones: Record<string, number>;
}
