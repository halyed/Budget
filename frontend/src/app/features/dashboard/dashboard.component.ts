import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { DashboardService } from '../../core/services/dashboard.service';
import { AiService, ChatMessage } from '../../core/services/ai.service';
import { MonthlySummary, BudgetVsActual, PortfolioSummary } from '../../core/models/dashboard.model';
import { CurrencyFormatPipe } from '../../core/pipes/currency-format.pipe';
import { chartColors } from '../../core/utils/chart-colors';

Chart.register(...registerables);

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
export class DashboardComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;
  @ViewChild('portfolioCanvas') portfolioCanvasRef?: ElementRef<HTMLCanvasElement>;

  private today = new Date();
  selectedMonth = signal(this.today.getMonth() + 1);
  selectedYear  = signal(this.today.getFullYear());

  selectedLabel = computed(() => {
    const d = new Date(this.selectedYear(), this.selectedMonth() - 1, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  });

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

  portfolioBreakdown = computed(() => {
    const p = this.portfolio();
    if (!p || p.total_portfolio <= 0) return [];
    const sorted = [...p.breakdown].sort((a, b) => b.value - a.value);
    const colors = chartColors(sorted.length);
    return sorted.map((item, i) => ({
      ...item,
      pct: Math.round((item.value / p.total_portfolio) * 1000) / 10,
      color: colors[i],
    }));
  });

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
  private pendingChartRender = false;
  private portfolioChart: Chart | null = null;

  constructor(
    private dashboardService: DashboardService,
    private aiService: AiService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    forkJoin({
      summary: this.dashboardService.getSummary(this.selectedMonth(), this.selectedYear()),
      budgetVsActual: this.dashboardService.getBudgetVsActual(this.selectedMonth(), this.selectedYear()),
      portfolio: this.dashboardService.getPortfolio(),
    }).subscribe(({ summary, budgetVsActual, portfolio }) => {
      this.summary.set(summary);
      this.budgetVsActual.set(budgetVsActual);
      this.portfolio.set(portfolio);
      this.loading.set(false);
      this.pendingChartRender = true;
    });
  }

  // Lets users move into next month early (e.g. salary arrives before month-end)
  // instead of being locked to the calendar's current month.
  prevMonth(): void {
    if (this.selectedMonth() === 1) { this.selectedMonth.set(12); this.selectedYear.update(y => y - 1); }
    else { this.selectedMonth.update(m => m - 1); }
    this.loadData();
  }

  nextMonth(): void {
    if (this.selectedMonth() === 12) { this.selectedMonth.set(1); this.selectedYear.update(y => y + 1); }
    else { this.selectedMonth.update(m => m + 1); }
    this.loadData();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      this.shouldScroll = false;
    }
    if (this.pendingChartRender && this.portfolioCanvasRef?.nativeElement) {
      this.pendingChartRender = false;
      this.renderPortfolioChart();
    }
  }

  ngOnDestroy(): void {
    this.portfolioChart?.destroy();
  }

  private renderPortfolioChart(): void {
    const ctx = this.portfolioCanvasRef?.nativeElement;
    const breakdown = this.portfolioBreakdown();
    if (!ctx || breakdown.length === 0) return;

    this.portfolioChart?.destroy();
    this.portfolioChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: breakdown.map(b => b.name),
        datasets: [{
          data: breakdown.map(b => b.value),
          backgroundColor: breakdown.map(b => b.color),
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const item = breakdown[ctx.dataIndex];
                return ` ${item.name}: ${item.value.toFixed(2)} (${item.pct}%)`;
              },
            },
          },
        },
      },
    });
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
