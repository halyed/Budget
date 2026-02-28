export interface SavingsGoal {
  id: number;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  target_date: string | null; // ISO date string
  progress_pct: number;
}

export type GoalCreate = Omit<SavingsGoal, 'id' | 'progress_pct' | 'current_amount'>;
export type GoalUpdate = Partial<GoalCreate>;
