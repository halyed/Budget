import { Category } from './category.model';

export interface Transaction {
  id: number;
  date: string; // ISO date string YYYY-MM-DD — when it actually happened
  // Month this transaction counts toward (dashboard, budgets, month lock, ...).
  // Independent of `date` — e.g. a salary that lands Aug 27 can still be
  // booked to September if that's the month you were viewing when you added it.
  budget_year: number;
  budget_month: number;
  amount: number;
  description: string | null;
  type: 'income' | 'expense' | 'savings';
  category_id: number | null;
  category: Category | null;
}

export type TransactionCreate = Omit<Transaction, 'id' | 'category'>;
export type TransactionUpdate = Partial<TransactionCreate>;
