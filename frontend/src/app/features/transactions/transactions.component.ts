import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { Transaction, TransactionCreate } from '../../core/models/transaction.model';
import { Category } from '../../core/models/category.model';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transactions.component.html',
})
export class TransactionsComponent implements OnInit {
  transactions = signal<Transaction[]>([]);
  categories = signal<Category[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);
  errorMsg = signal<string | null>(null);

  editForm: TransactionCreate = this.blank();
  form: TransactionCreate = this.blank();

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService,
  ) {}

  ngOnInit(): void {
    this.categoryService.list().subscribe(c => this.categories.set(c));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.transactionService.list().subscribe(t => {
      this.transactions.set(t);
      this.loading.set(false);
    });
  }

  save(): void {
    if (!this.form.amount || !this.form.date) return;
    this.saving.set(true);
    this.transactionService.create(this.form).subscribe({
      next: () => {
        this.showForm.set(false);
        this.saving.set(false);
        this.form = this.blank();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  startEdit(t: Transaction): void {
    this.editForm = {
      date: t.date,
      amount: t.amount,
      description: t.description ?? '',
      type: t.type,
      category_id: t.category_id,
    };
    this.showForm.set(false);
    this.editingId.set(t.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(): void {
    const id = this.editingId();
    if (!id) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    console.log('PATCH payload:', JSON.stringify(this.editForm));
    this.transactionService.update(id, this.editForm).subscribe({
      next: (updated) => {
        this.transactions.update(list => list.map(t => t.id === id ? updated : t));
        this.editingId.set(null);
        this.saving.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        console.error('saveEdit error', err);
        this.errorMsg.set(`Update failed (${err?.status}): ${JSON.stringify(err?.error)}`);
      },
    });
  }

  delete(id: number): void {
    if (!confirm('Delete this transaction?')) return;
    this.transactionService.delete(id).subscribe(() => this.load());
  }

  private blank(): TransactionCreate {
    return { date: new Date().toISOString().split('T')[0], amount: 0, description: '', type: 'expense', category_id: null };
  }
}
