import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  constructor(private api: ApiService) {}

  suggestCategory(description: string): Observable<{ category: string | null }> {
    return this.api.post('/ai/suggest-category', { description });
  }

  chat(question: string, history: ChatMessage[]): Observable<{ answer: string }> {
    return this.api.post('/ai/chat', { question, history });
  }
}
