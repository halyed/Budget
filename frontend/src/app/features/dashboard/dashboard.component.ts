import { Component, OnInit, AfterViewChecked, ViewChild, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DashboardService } from '../../core/services/dashboard.service';
import { AiService, ChatMessage } from '../../core/services/ai.service';
import { MonthlySummary, BudgetVsActual, PortfolioSummary } from '../../core/models/dashboard.model';
import { CurrencyFormatPipe } from '../../core/pipes/currency-format.pipe';

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatPipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  today = new Date();
  month = this.today.getMonth() + 1;
  year = this.today.getFullYear();

  loading = signal(true);
  summary = signal<MonthlySummary | null>(null);
  budgetVsActual = signal<BudgetVsActual[]>([]);
  portfolio = signal<PortfolioSummary | null>(null);

  showAllBudget = signal(false);

  // Sort: overbudget first (most negative diff), then underbudget
  sortedBudget = computed(() =>
    [...this.budgetVsActual()].sort((a, b) => a.difference - b.difference)
  );

  visibleBudget = computed(() =>
    this.showAllBudget() ? this.sortedBudget() : this.sortedBudget().slice(0, 10)
  );

  // Chat
  chatOpen    = signal(false);
  messages    = signal<DisplayMessage[]>([]);
  chatInput   = signal('');
  chatLoading = signal(false);
  chatError   = signal<string | null>(null);

  hints = [
    'Am I on track this month?',
    'Where am I spending the most?',
    'How does this month compare to last month?',
  ];

  private shouldScroll = false;

  constructor(
    private dashboardService: DashboardService,
    private aiService: AiService,
  ) {}

  ngOnInit(): void {
    forkJoin({
      summary: this.dashboardService.getSummary(this.month, this.year),
      budgetVsActual: this.dashboardService.getBudgetVsActual(this.month, this.year),
      portfolio: this.dashboardService.getPortfolio(),
    }).subscribe(({ summary, budgetVsActual, portfolio }) => {
      this.summary.set(summary);
      this.budgetVsActual.set(budgetVsActual);
      this.portfolio.set(portfolio);
      this.loading.set(false);
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      this.shouldScroll = false;
    }
  }

  toggleChat(): void {
    this.chatOpen.update(v => !v);
  }

  sendChat(): void {
    const question = this.chatInput().trim();
    if (!question || this.chatLoading()) return;

    this.chatInput.set('');
    this.chatError.set(null);
    this.messages.update(m => [...m, { role: 'user', content: question }]);
    this.chatLoading.set(true);
    this.shouldScroll = true;

    const history: ChatMessage[] = this.messages()
      .slice(0, -1)
      .map(m => ({ role: m.role, content: m.content }));

    this.aiService.chat(question, history).subscribe({
      next: (res) => {
        this.messages.update(m => [...m, { role: 'assistant', content: res.answer }]);
        this.chatLoading.set(false);
        this.shouldScroll = true;
      },
      error: (err) => {
        this.chatError.set(err.error?.detail ?? 'Chat service unavailable.');
        this.chatLoading.set(false);
        this.messages.update(m => m.slice(0, -1));
        this.chatInput.set(question);
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChat();
    }
  }

  clearChat(): void {
    this.messages.set([]);
    this.chatError.set(null);
  }
}
