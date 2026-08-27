import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface MonthStatus {
  month: number;
  year: number;
  closed: boolean;
}

export interface MonthPeriod {
  year: number;
  month: number;
}

@Injectable({ providedIn: 'root' })
export class MonthLockService {
  constructor(private api: ApiService) {}

  getStatus(month: number, year: number): Observable<MonthStatus> {
    return this.api.get<MonthStatus>('/months/status', { month, year });
  }

  // The calendar's current month may already be closed (e.g. closed early
  // once salary arrived) — walk forward to the first open month, so callers
  // land on the month the user is actually budgeting for, not a finalized one.
  resolveActiveMonth(year: number, month: number, attemptsLeft = 12): Observable<MonthPeriod> {
    return this.getStatus(month, year).pipe(
      switchMap(status => {
        if (!status.closed || attemptsLeft <= 0) return of({ year, month });
        const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
        return this.resolveActiveMonth(next.year, next.month, attemptsLeft - 1);
      }),
    );
  }

  close(month: number, year: number): Observable<MonthStatus> {
    return this.api.post<MonthStatus>('/months/close', { month, year });
  }

  reopen(month: number, year: number): Observable<MonthStatus> {
    return this.api.post<MonthStatus>('/months/reopen', { month, year });
  }
}
