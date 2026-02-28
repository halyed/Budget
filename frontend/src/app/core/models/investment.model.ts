export interface Investment {
  id: number;
  name: string;
  type: 'etf' | 'crypto' | 'cash' | 'stocks';
  value: number;
  updated_at: string; // ISO datetime
}

export type InvestmentCreate = Omit<Investment, 'id' | 'updated_at'>;
export type InvestmentUpdate = Partial<InvestmentCreate>;
