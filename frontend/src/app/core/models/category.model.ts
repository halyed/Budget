export interface Category {
  id: number;
  name: string;
  type: 'fixed' | 'variable' | 'learning' | 'family';
  planned_amount: number;
  icon: string | null;
  color: string | null;
}

export type CategoryCreate = Omit<Category, 'id'>;
export type CategoryUpdate = Partial<CategoryCreate>;
