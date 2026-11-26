import type { Book, ProgressEntry, ProgressMode } from './types';

export const PROGRESS_MODES: { id: ProgressMode; label: string; unit: string }[] = [
  { id: 'pages', label: 'Páginas', unit: 'pág.' },
  { id: 'percent', label: 'Porcentagem', unit: '%' },
  { id: 'minutes', label: 'Minutagem', unit: 'min' },
];

export const MAX_EMOTIONS = 6;

export const EMOTION_GROUPS: { color: string; items: string[] }[] = [
  { color: '#9dbf9e', items: ['curiosa', 'inspirada', 'pensativa', 'relaxada', 'nostálgica'] },
  { color: '#ffd23f', items: ['apaixonada', 'divertida', 'alegre', 'surpresa'] },
  { color: '#ff9f43', items: ['ansiosa', 'tensa', 'confusa', 'desconfiada', 'chocada'] },
  { color: '#ff5c6c', items: ['irritada', 'indignada', 'amedrontada'] },
  { color: '#4da3ff', items: ['triste', 'melancólica', 'frustrada', 'entediada'] },
  { color: '#c084fc', items: ['empolgada', 'focada', 'conectada', 'eufórica'] },
];

export const emotionColor = (name: string): string =>
  EMOTION_GROUPS.find((g) => g.items.includes(name))?.color ?? '#bf9baa';

export const percentOf = (e: Pick<ProgressEntry, 'value' | 'total'>): number =>
  e.total > 0 ? Math.min(100, Math.max(0, Math.round((e.value / e.total) * 100))) : 0;

/** Valor válido: total positivo e posição entre 0 e o total. */
export const isValidProgress = (value: number, total: number): boolean =>
  Number.isInteger(value) && Number.isInteger(total) && total > 0 && value >= 0 && value <= total;

/** Registros da leitura mais recente para a mais antiga. */
export const history = (b: Book): ProgressEntry[] => [...(b.progress ?? [])].sort((a, c) => c.at - a.at);

export const latestProgress = (b: Book): ProgressEntry | undefined => history(b)[0];
