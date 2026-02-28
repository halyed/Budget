import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Category, CategoryCreate, CategoryUpdate } from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  constructor(private api: ApiService) {}

  list(): Observable<Category[]> {
    return this.api.get<Category[]>('/categories');
  }

  create(payload: CategoryCreate): Observable<Category> {
    return this.api.post<Category>('/categories', payload);
  }

  update(id: number, payload: CategoryUpdate): Observable<Category> {
    return this.api.patch<Category>(`/categories/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`/categories/${id}`);
  }
}
