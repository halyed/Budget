import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { MonthlySummary, BudgetVsActual, PortfolioSummary } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private api: ApiService) {}

  getSummary(month: number, year: number): Observable<MonthlySummary> {
    return this.api.get<MonthlySummary>('/dashboard/summary', { month, year });
  }

  getBudgetVsActual(month: number, year: number): Observable<BudgetVsActual[]> {
    return this.api.get<BudgetVsActual[]>('/dashboard/budget-vs-actual', { month, year });
  }

  getPortfolio(): Observable<PortfolioSummary> {
    return this.api.get<PortfolioSummary>('/dashboard/portfolio');
  }
}
