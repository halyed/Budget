import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../core/services/api.service';

Chart.register(...registerables);

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
  imports: [CommonModule],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('incomeExpensesCanvas') incomeExpensesRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('savingsRateCanvas') savingsRateRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryBreakdownCanvas') categoryBreakdownRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryTrendsCanvas') categoryTrendsRef!: ElementRef<HTMLCanvasElement>;

  selectedMonths = signal<number>(6);
  loading = signal(true);
  error = signal<string | null>(null);
  data = signal<ReportData | null>(null);

  periodOptions = [
    { label: 'Last 3 months', value: 3 },
    { label: 'Last 6 months', value: 6 },
    { label: 'Last 12 months', value: 12 },
  ];

  private charts: Chart[] = [];
  private viewInitialized = false;
  private dataLoaded = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    if (this.dataLoaded && this.data()) {
      this.renderCharts();
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  selectPeriod(months: number): void {
    if (months === this.selectedMonths()) return;
    this.selectedMonths.set(months);
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.destroyCharts();

    this.api.get<ReportData>('/reports/monthly-summary', { months: this.selectedMonths() })
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.loading.set(false);
          this.dataLoaded = true;
          if (this.viewInitialized) {
            // Wait one tick for *ngIf canvases to render
            setTimeout(() => this.renderCharts(), 0);
          }
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
  }

  private renderCharts(): void {
    const d = this.data();
    if (!d) return;

    this.renderIncomeExpenses(d);
    this.renderSavingsRate(d);
    this.renderCategoryBreakdown(d);
    this.renderCategoryTrends(d);
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
            label: 'Savings Rate (%)',
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
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true, max: 100 } },
      },
    }));
  }

  private renderCategoryBreakdown(d: ReportData): void {
    const ctx = this.categoryBreakdownRef?.nativeElement;
    if (!ctx) return;
    // Use the most recent month's data
    const last = d.months[d.months.length - 1];
    const labels = d.category_trends.map(c => c.category_name);
    const amounts = d.category_trends.map(c => c.amounts[c.amounts.length - 1]);

    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: amounts,
          backgroundColor: CHART_COLORS.slice(0, labels.length),
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          title: {
            display: true,
            text: `Expenses by Category — ${last?.label ?? ''}`,
          },
        },
      },
    }));
  }

  private renderCategoryTrends(d: ReportData): void {
    const ctx = this.categoryTrendsRef?.nativeElement;
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: d.category_trends.map((cat, i) => ({
          label: cat.category_name,
          data: cat.amounts,
          borderColor: CHART_COLORS[i % CHART_COLORS.length],
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 3,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } },
      },
    }));
  }
}
