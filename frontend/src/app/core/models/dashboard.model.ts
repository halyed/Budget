export interface MonthlySummary {
  month: number;
  year: number;
  total_income: number;
  total_expenses: number;
  saved: number;
  net: number;
  savings_rate: number;
}

export interface BudgetVsActual {
  category_id: number;
  category_name: string;
  category_type: string;
  planned: number;
  actual: number;
  difference: number;
}

export interface PortfolioSummary {
  total_portfolio: number;
  breakdown: { id: number; name: string; type: string; value: number }[];
}
