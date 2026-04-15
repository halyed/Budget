export interface LinkedInvestment {
  id: number;
  name: string;
  type: string;
  value: number;
}

export interface SavingsGoal {
  id: number;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  progress_pct: number;
  linked_investments: LinkedInvestment[];
}

export interface GoalCreate {
  name: string;
  description: string | null;
  target_amount: number;
  target_date: string | null;
  investment_ids: number[];
}

export type GoalUpdate = Partial<GoalCreate>;
