import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyService } from '../services/currency.service';

@Pipe({ name: 'currencyFormat', pure: false, standalone: true })
export class CurrencyFormatPipe implements PipeTransform {
  private cs = inject(CurrencyService);

  transform(value: number | null | undefined, digitsInfo: string = '1.0-0'): string {
    if (value == null) return '';
    const match = digitsInfo.match(/\d+\.(\d+)-(\d+)/);
    const minFrac = match ? parseInt(match[1]) : 0;
    const maxFrac = match ? parseInt(match[2]) : 0;
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac,
    });
    return `${this.cs.symbol()} ${formatted}`;
  }
}
