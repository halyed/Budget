import { Injectable, signal } from '@angular/core';

export interface Currency {
  symbol: string;
  label: string;
}

export const CURRENCIES: Currency[] = [
  { symbol: '€',    label: 'Euro (€)' },
  { symbol: 'FCFA', label: 'FCFA' },
  { symbol: '$',    label: 'Dollar ($)' },
  { symbol: '£',    label: 'Pound (£)' },
  { symbol: '₦',    label: 'Naira (₦)' },
  { symbol: '¥',    label: 'Yen (¥)' },
];

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly KEY = 'budget_currency';
  symbol = signal<string>(localStorage.getItem(this.KEY) ?? '€');

  set(symbol: string): void {
    localStorage.setItem(this.KEY, symbol);
    this.symbol.set(symbol);
  }
}
