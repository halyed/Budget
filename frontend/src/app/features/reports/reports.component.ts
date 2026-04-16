import {
  Component, OnInit, OnDestroy, AfterViewChecked,
  ViewChild, ElementRef, computed, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { SankeyController, Flow } from 'chartjs-chart-sankey';
import { ApiService } from '../../core/services/api.service';
import { AiService } from '../../core/services/ai.service';
import { CurrencyFormatPipe } from '../../core/pipes/currency-format.pipe';

Chart.register(...registerables, SankeyController, Flow);

interface MonthData {
  label: string;
  month: number;
  year: number;
  income: number;
  expenses: number;
  savings: number;
  savings_rate: number;
}

interface CategoryTrend {
  category_id: number;
  category_name: string;
  amounts: number[];
}

interface ReportData {
  labels: string[];
  months: MonthData[];
  category_trends: CategoryTrend[];
}

const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16',
];

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, CurrencyFormatPipe],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('incomeExpensesCanvas') incomeExpensesRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('savingsRateCanvas') savingsRateRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryBreakdownCanvas') categoryBreakdownRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('cashflowCanvas') cashflowRef!: ElementRef<HTMLCanvasElement>;

  selectedMonths = signal<number>(3);
  loading = signal(true);
  error = signal<string | null>(null);
  data = signal<ReportData | null>(null);

  insightsText = signal<string | null>(null);
  insightsLoading = signal(false);
  insightsError = signal<string | null>(null);

  periodOptions = [
    { label: 'Last 3 months', value: 3 },
    { label: 'Last 6 months', value: 6 },
    { label: 'Last 12 months', value: 12 },
  ];

  // Index into d.months for the detail charts (breakdown + cashflow)
  selectedChartMonthIdx = signal(0);

  chartMonthLabel = computed(() => this.data()?.months[this.selectedChartMonthIdx()]?.label ?? '');
  isFirstChartMonth = computed(() => this.selectedChartMonthIdx() === 0);
  isLastChartMonth  = computed(() => {
    const d = this.data();
    return !d || this.selectedChartMonthIdx() === d.months.length - 1;
  });

  prevChartMonth(): void {
    if (this.isFirstChartMonth()) return;
    this.selectedChartMonthIdx.update(i => i - 1);
    this.reRenderDetailCharts();
  }

  nextChartMonth(): void {
    if (this.isLastChartMonth()) return;
    this.selectedChartMonthIdx.update(i => i + 1);
    this.reRenderDetailCharts();
  }

  private reRenderDetailCharts(): void {
    const d = this.data();
    if (!d) return;
    this.breakdownChart?.destroy();
    this.breakdownChart = null;
    this.cashflowChart?.destroy();
    this.cashflowChart = null;
    this.renderCategoryBreakdown(d);
    this.renderCashflow(d);
  }

  private charts: Chart[] = [];         // income/expenses + savings rate
  private breakdownChart: Chart | null = null;
  private cashflowChart:  Chart | null = null;
  private pendingRender = false;

  constructor(private api: ApiService, private aiService: AiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  // Fires after every DOM update — renders charts as soon as canvases are available
  ngAfterViewChecked(): void {
    if (this.pendingRender && this.incomeExpensesRef?.nativeElement) {
      this.pendingRender = false;
      this.renderCharts();
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  getInsights(): void {
    this.insightsLoading.set(true);
    this.insightsError.set(null);
    this.insightsText.set(null);
    this.aiService.getInsights(this.selectedMonths()).subscribe({
      next: (res) => {
        this.insightsText.set(res.insights);
        this.insightsLoading.set(false);
      },
      error: (err) => {
        this.insightsError.set(err.error?.detail ?? 'Failed to get insights.');
        this.insightsLoading.set(false);
      },
    });
  }

  selectPeriod(months: number): void {
    if (months === this.selectedMonths()) return;
    this.selectedMonths.set(months);
    this.loadData(false);
  }

  private loadData(initialLoad = true): void {
    if (initialLoad) this.loading.set(true);
    this.error.set(null);
    this.destroyCharts();

    this.api.get<ReportData>('/reports/monthly-summary', { months: this.selectedMonths() })
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.selectedChartMonthIdx.set(d.months.length - 1);
          this.loading.set(false);
          this.pendingRender = true;
        },
        error: () => {
          this.error.set('Failed to load report data.');
          this.loading.set(false);
        },
      });
  }

  private destroyCharts(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    this.breakdownChart?.destroy();
    this.breakdownChart = null;
    this.cashflowChart?.destroy();
    this.cashflowChart = null;
  }

  private renderCharts(): void {
    const d = this.data();
    if (!d) return;

    this.renderIncomeExpenses(d);
    this.renderSavingsRate(d);
    this.renderCategoryBreakdown(d);
    this.renderCashflow(d);
  }

  private renderIncomeExpenses(d: ReportData): void {
    const ctx = this.incomeExpensesRef?.nativeElement;
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: d.labels,
        datasets: [
          {
            label: 'Income',
            data: d.months.map(m => m.income),
            backgroundColor: '#10b981',
          },
          {
            label: 'Expenses',
            data: d.months.map(m => m.expenses),
            backgroundColor: '#ef4444',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } },
      },
    }));
  }

  private renderSavingsRate(d: ReportData): void {
    const ctx = this.savingsRateRef?.nativeElement;
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [
          {
            label: 'Savings Rate',
            data: d.months.map(m => m.savings_rate),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const rate = d.months[idx].savings_rate;
                const amount = d.months[idx].savings.toFixed(2);
                return ` ${rate}% (€${amount})`;
              },
            },
          },
        },
        scales: { y: { beginAtZero: true, max: 100 } },
      },
    }));
  }

  getCategoryBreakdown(): { name: string; amount: number; pct: number; color: string }[] {
    const d = this.data();
    if (!d || d.category_trends.length === 0) return [];
    const idx = this.selectedChartMonthIdx();
    const income = d.months[idx].income;
    return d.category_trends
      .map((cat, i) => ({
        name: cat.category_name,
        amount: cat.amounts[idx],
        pct: income > 0 ? Math.round((cat.amounts[idx] / income) * 1000) / 10 : 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }

  private renderCategoryBreakdown(d: ReportData): void {
    const ctx = this.categoryBreakdownRef?.nativeElement;
    if (!ctx) return;
    const idx = this.selectedChartMonthIdx();
    const income = d.months[idx].income;
    const labels = d.category_trends.map(c => c.category_name);
    const amounts = d.category_trends.map(c => c.amounts[idx]);

    this.breakdownChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: amounts,
          backgroundColor: d.category_trends.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
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
                const amount = ctx.parsed as number;
                const pct = income > 0 ? ((amount / income) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${amount.toFixed(2)} (${pct}% of income)`;
              },
            },
          },
        },
      },
    });
  }

  private renderCashflow(d: ReportData): void {
    const ctx = this.cashflowRef?.nativeElement;
    if (!ctx) return;

    const idx = this.selectedChartMonthIdx();
    const month = d.months[idx];

    const flows: { from: string; to: string; flow: number }[] = [];

    for (const cat of d.category_trends) {
      const amount = cat.amounts[idx];
      if (amount > 0) {
        flows.push({ from: 'Income', to: cat.category_name, flow: amount });
      }
    }

    const categorized = flows.reduce((sum, f) => sum + f.flow, 0);
    const uncategorized = Math.round((month.expenses - categorized) * 100) / 100;
    if (uncategorized > 0.01) {
      flows.push({ from: 'Income', to: 'Other', flow: uncategorized });
    }

    if (month.savings > 0) {
      flows.push({ from: 'Income', to: 'Savings', flow: Math.round(month.savings * 100) / 100 });
    }

    if (flows.length === 0) return;

    this.cashflowChart = new Chart(ctx, {
      type: 'sankey' as any,
      data: {
        datasets: [{
          label: `Cash Flow — ${month.label}`,
          data: flows,
          colorFrom: (c: any) => {
            const node = c.dataset.data[c.dataIndex]?.from;
            return node === 'Income' ? '#10b981' : '#6366f1';
          },
          colorTo: (c: any) => {
            const node = c.dataset.data[c.dataIndex]?.to;
            if (node === 'Savings') return '#10b981';
            if (node === 'Other') return '#9ca3af';
            return '#ef4444';
          },
          colorMode: 'gradient',
          borderWidth: 0,
          size: 'min',
        } as any],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item: any) => {
                const flow = item.dataset.data[item.dataIndex];
                return `${flow.from} → ${flow.to}: ${flow.flow.toFixed(2)}`;
              },
            },
          },
        },
      } as any,
    });
  }
}
