import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvestmentService } from '../../core/services/investment.service';
import { Investment, InvestmentCreate } from '../../core/models/investment.model';
import { CurrencyFormatPipe } from '../../core/pipes/currency-format.pipe';

@Component({
  selector: 'app-investments',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatPipe],
  templateUrl: './investments.component.html',
})
export class InvestmentsComponent implements OnInit {
  investments = signal<Investment[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);

  total = computed(() => this.investments().reduce((s, i) => s + i.value, 0));

  editForm: InvestmentCreate = this.blank();
  form: InvestmentCreate = this.blank();

  constructor(private investmentService: InvestmentService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.investmentService.list().subscribe(inv => { this.investments.set(inv); this.loading.set(false); });
  }

  save(): void {
    this.saving.set(true);
    this.investmentService.create(this.form).subscribe({
      next: () => { this.showForm.set(false); this.saving.set(false); this.form = this.blank(); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  startEdit(inv: Investment): void {
    this.editForm = { name: inv.name, type: inv.type, value: inv.value };
    this.showForm.set(false);
    this.editingId.set(inv.id);
  }

  cancelEdit(): void { this.editingId.set(null); }

  saveEdit(): void {
    const id = this.editingId();
    if (!id) return;
    this.saving.set(true);
    this.investmentService.update(id, this.editForm).subscribe({
      next: () => { this.editingId.set(null); this.saving.set(false); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  delete(id: number): void {
    if (!confirm('Delete this investment?')) return;
    this.investmentService.delete(id).subscribe(() => this.load());
  }

  private blank(): InvestmentCreate { return { name: '', type: 'etf', value: 0 }; }
}
