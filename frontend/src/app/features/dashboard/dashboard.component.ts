import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { DashboardService } from '../../core/services/dashboard.service';
import { MonthlySummary, BudgetVsActual, PortfolioSummary } from '../../core/models/dashboard.model';
import { CurrencyFormatPipe } from '../../core/pipes/currency-format.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyFormatPipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  today = new Date();
  month = this.today.getMonth() + 1;
  year = this.today.getFullYear();

  loading = signal(true);
  summary = signal<MonthlySummary | null>(null);
  budgetVsActual = signal<BudgetVsActual[]>([]);
  portfolio = signal<PortfolioSummary | null>(null);

  constructor(private dashboardService: DashboardService) {}

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
}
