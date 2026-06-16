import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface MonthStatus {
  month: number;
  year: number;
  closed: boolean;
}

@Injectable({ providedIn: 'root' })
export class MonthLockService {
  constructor(private api: ApiService) {}

  getStatus(month: number, year: number): Observable<MonthStatus> {
    return this.api.get<MonthStatus>('/months/status', { month, year });
  }

  close(month: number, year: number): Observable<MonthStatus> {
    return this.api.post<MonthStatus>('/months/close', { month, year });
  }

  reopen(month: number, year: number): Observable<MonthStatus> {
    return this.api.post<MonthStatus>('/months/reopen', { month, year });
  }
}
