import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Transaction, TransactionCreate, TransactionUpdate } from '../models/transaction.model';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  constructor(private api: ApiService) {}

  list(filters?: { month?: number; year?: number; type?: string; category_id?: number }): Observable<Transaction[]> {
    return this.api.get<Transaction[]>('/transactions', filters as Record<string, number>);
  }

  get(id: number): Observable<Transaction> {
    return this.api.get<Transaction>(`/transactions/${id}`);
  }

  create(payload: TransactionCreate): Observable<Transaction> {
    return this.api.post<Transaction>('/transactions', payload);
  }

  update(id: number, payload: TransactionUpdate): Observable<Transaction> {
    return this.api.patch<Transaction>(`/transactions/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`/transactions/${id}`);
  }

  bulkImport(month: string, transactions: object[]): Observable<{ created: number; skipped: number; errors: string[] }> {
    return this.api.post('/transactions/bulk', { month, transactions });
  }
}
