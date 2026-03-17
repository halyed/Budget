import { Component, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService, ChatMessage } from '../../core/services/ai.service';

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
})
export class ChatComponent implements AfterViewChecked {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  messages = signal<DisplayMessage[]>([]);
  input = signal('');
  loading = signal(false);
  error = signal<string | null>(null);

  hints = [
    'Am I on track this month?',
    'Where am I spending the most?',
    'How are my savings goals progressing?',
    'How does this month compare to last month?',
  ];

  private shouldScroll = false;

  constructor(private aiService: AiService) {}

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      this.shouldScroll = false;
    }
  }

  send(): void {
    const question = this.input().trim();
    if (!question || this.loading()) return;

    this.input.set('');
    this.error.set(null);
    this.messages.update(m => [...m, { role: 'user', content: question }]);
    this.loading.set(true);
    this.shouldScroll = true;

    const history: ChatMessage[] = this.messages()
      .slice(0, -1)  // exclude the message we just added
      .map(m => ({ role: m.role, content: m.content }));

    this.aiService.chat(question, history).subscribe({
      next: (res) => {
        this.messages.update(m => [...m, { role: 'assistant', content: res.answer }]);
        this.loading.set(false);
        this.shouldScroll = true;
      },
      error: (err) => {
        this.error.set(err.error?.detail ?? 'Chat service unavailable.');
        this.loading.set(false);
        // Remove the user message that failed
        this.messages.update(m => m.slice(0, -1));
        this.input.set(question);
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  clear(): void {
    this.messages.set([]);
    this.error.set(null);
  }
}
