import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { SavingsGoal, GoalCreate, GoalUpdate } from '../models/goal.model';

@Injectable({ providedIn: 'root' })
export class GoalService {
  constructor(private api: ApiService) {}

  list(): Observable<SavingsGoal[]> {
    return this.api.get<SavingsGoal[]>('/goals');
  }

  create(payload: GoalCreate): Observable<SavingsGoal> {
    return this.api.post<SavingsGoal>('/goals', payload);
  }

  update(id: number, payload: GoalUpdate): Observable<SavingsGoal> {
    return this.api.patch<SavingsGoal>(`/goals/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`/goals/${id}`);
  }
}
