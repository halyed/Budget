import { Category } from './category.model';

export interface Transaction {
  id: number;
  date: string; // ISO date string YYYY-MM-DD
  amount: number;
  description: string | null;
  type: 'income' | 'expense' | 'savings';
  category_id: number | null;
  category: Category | null;
}

export type TransactionCreate = Omit<Transaction, 'id' | 'category'>;
export type TransactionUpdate = Partial<TransactionCreate>;
