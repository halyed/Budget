import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { AiService } from '../../core/services/ai.service';
import { Transaction, TransactionCreate } from '../../core/models/transaction.model';
import { Category } from '../../core/models/category.model';
import { CurrencyFormatPipe } from '../../core/pipes/currency-format.pipe';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatPipe],
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

  // AI category suggestion
  suggestedCategory = signal<string | null>(null);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Bulk import
  showBulk    = signal(false);
  bulkMonth   = signal(new Date().toISOString().slice(0, 7));
  bulkJson    = signal(this.exampleJson());
  bulkLoading = signal(false);
  bulkResult  = signal<{ created: number; skipped: number; errors: string[] } | null>(null);
  bulkError   = signal<string | null>(null);

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private aiService: AiService,
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

  openBulk(): void {
    this.bulkResult.set(null);
    this.bulkError.set(null);
    this.showBulk.set(true);
  }

  submitBulk(): void {
    this.bulkError.set(null);
    this.bulkResult.set(null);
    let transactions: object[];
    try {
      transactions = JSON.parse(this.bulkJson());
      if (!Array.isArray(transactions)) throw new Error();
    } catch {
      this.bulkError.set('Invalid JSON — must be an array [ ... ]');
      return;
    }
    this.bulkLoading.set(true);
    this.transactionService.bulkImport(this.bulkMonth(), transactions).subscribe({
      next: (res) => {
        this.bulkResult.set(res);
        this.bulkLoading.set(false);
        this.load();
      },
      error: (err) => {
        this.bulkError.set(err.error?.detail ?? 'Import failed.');
        this.bulkLoading.set(false);
      },
    });
  }

  onDescriptionChange(value: string): void {
    this.form.description = value;
    this.suggestedCategory.set(null);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (value.length < 3) return;
    this.debounceTimer = setTimeout(() => {
      this.aiService.suggestCategory(value).subscribe({
        next: (res) => this.suggestedCategory.set(res.category),
        error: () => {},
      });
    }, 500);
  }

  applySuggestion(): void {
    const suggestion = this.suggestedCategory();
    if (!suggestion) return;
    const cat = this.categories().find(c => c.name === suggestion);
    if (cat) this.form.category_id = cat.id;
    this.suggestedCategory.set(null);
  }

  dismissSuggestion(): void {
    this.suggestedCategory.set(null);
  }

  private exampleJson(): string {
    return JSON.stringify([
      { "description": "Monthly salary",  "amount": 1000, "category_name": null,             "type": "income",  "day": 1  },
      { "description": "Rent",            "amount": 500,  "category_name": "Rent",            "type": "expense", "day": 1  },
      { "description": "Transport",       "amount": 80,   "category_name": "Transport",       "type": "expense", "day": 1  },
      { "description": "Internet",        "amount": 30,   "category_name": "Internet",        "type": "expense", "day": 1  },
      { "description": "Electricity",     "amount": 50,   "category_name": "Electricity",     "type": "expense", "day": 1  },
      { "description": "Sport",           "amount": 30,   "category_name": "Sport",           "type": "expense", "day": 1  },
      { "description": "Phone",           "amount": 10,   "category_name": "Phone",           "type": "expense", "day": 1  },
      { "description": "Groceries",       "amount": 200,  "category_name": "Groceries",       "type": "expense", "day": 15 },
      { "description": "Personal Care",   "amount": 50,   "category_name": "Personal Care",   "type": "expense", "day": 15 },
      { "description": "Gifts / Misc",    "amount": 30,   "category_name": "Gifts / Misc",    "type": "expense", "day": 15 },
      { "description": "Eating Out",      "amount": 50,   "category_name": "Eating Out",      "type": "expense", "day": 15 },
      { "description": "Online Tools",    "amount": 20,   "category_name": "Claude Code",     "type": "expense", "day": 1  },
      { "description": "Books & Courses", "amount": 30,   "category_name": "DEV / PLM Books", "type": "expense", "day": 1  },
      { "description": "Networking",      "amount": 20,   "category_name": "Networking",      "type": "expense", "day": 1  },
      { "description": "Family Support",  "amount": 100,  "category_name": "Family Abroad",   "type": "expense", "day": 1  }
    ], null, 2);
  }

  private blank(): TransactionCreate {
    return { date: new Date().toISOString().split('T')[0], amount: 0, description: '', type: 'expense', category_id: null };
  }
}
