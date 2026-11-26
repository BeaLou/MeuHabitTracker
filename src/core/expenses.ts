import type { Expense } from './types';

export const EXPENSE_CATEGORIES = ['Alimentação', 'Transporte', 'Casa', 'Saúde', 'Estudos', 'Lazer', 'Compras', 'Outros'];

/** "1.234,56", "12,5", "12.50" ou "R$ 30" -> centavos. null se não for um valor positivo. */
export function parseAmount(text: string): number | null {
  let t = text.replace(/R\$|\s/g, '');
  if (t.includes(',')) {
    if (!/^(\d+|\d{1,3}(\.\d{3})+),\d{1,2}$/.test(t)) return null;
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  } else if (!/^\d+(\.\d{1,2})?$/.test(t)) {
    return null;
  }
  const cents = Math.round(Number(t) * 100);
  return cents > 0 ? cents : null;
}

export const formatMoney = (cents: number): string =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Gastos do mês "YYYY-MM", do mais recente para o mais antigo. */
export const expensesOfMonth = (list: Expense[], month: string): Expense[] =>
  list.filter((e) => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

export const totalCents = (list: Expense[]): number => list.reduce((sum, e) => sum + e.amountCents, 0);
