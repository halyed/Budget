import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Investment, InvestmentCreate, InvestmentUpdate } from '../models/investment.model';

@Injectable({ providedIn: 'root' })
export class InvestmentService {
  constructor(private api: ApiService) {}

  list(): Observable<Investment[]> {
    return this.api.get<Investment[]>('/investments');
  }

  create(payload: InvestmentCreate): Observable<Investment> {
    return this.api.post<Investment>('/investments', payload);
  }

  update(id: number, payload: InvestmentUpdate): Observable<Investment> {
    return this.api.patch<Investment>(`/investments/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`/investments/${id}`);
  }
}
