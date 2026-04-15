import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { AiService } from '../../core/services/ai.service';
import { Transaction, TransactionCreate } from '../../core/models/transaction.model';
import { Category, CategoryCreate } from '../../core/models/category.model';
import { CurrencyFormatPipe } from '../../core/pipes/currency-format.pipe';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatPipe],
  templateUrl: './transactions.component.html',
})
export class TransactionsComponent implements OnInit {

  // ── Transactions ──────────────────────────────────────────────
  transactions = signal<Transaction[]>([]);
  loadingTx    = signal(true);
  savingTx     = signal(false);
  showTxForm   = signal(false);
  editingTxId  = signal<number | null>(null);
  errorMsg     = signal<string | null>(null);
  showAllTx    = signal(false);

  form: TransactionCreate     = this.blankTx();
  editTxForm: TransactionCreate = this.blankTx();

  visibleTransactions = computed(() =>
    this.showAllTx() ? this.transactions() : this.transactions().slice(0, 5)
  );

  // AI category suggestion
  suggestedCategory = signal<string | null>(null);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Period filter
  private today = new Date();
  selectedMonth = signal(this.today.getMonth() + 1);
  selectedYear  = signal(this.today.getFullYear());

  selectedLabel = computed(() => {
    const d = new Date(this.selectedYear(), this.selectedMonth() - 1, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  });

  isCurrentMonth = computed(() =>
    this.selectedMonth() === this.today.getMonth() + 1 &&
    this.selectedYear()  === this.today.getFullYear()
  );

  prevMonth(): void {
    if (this.selectedMonth() === 1) { this.selectedMonth.set(12); this.selectedYear.update(y => y - 1); }
    else { this.selectedMonth.update(m => m - 1); }
    this.loadTransactions();
  }

  nextMonth(): void {
    if (this.isCurrentMonth()) return;
    if (this.selectedMonth() === 12) { this.selectedMonth.set(1); this.selectedYear.update(y => y + 1); }
    else { this.selectedMonth.update(m => m + 1); }
    this.loadTransactions();
  }

  // Bulk import
  showBulk    = signal(false);
  bulkMonth   = signal(new Date().toISOString().slice(0, 7));
  bulkJson    = signal(this.exampleJson());
  bulkLoading = signal(false);
  bulkResult  = signal<{ created: number; skipped: number; errors: string[] } | null>(null);
  bulkError   = signal<string | null>(null);

  // ── Categories ────────────────────────────────────────────────
  categories    = signal<Category[]>([]);
  loadingCat    = signal(true);
  savingCat     = signal(false);
  showCatForm   = signal(false);
  editingCatId  = signal<number | null>(null);

  catForm: CategoryCreate     = this.blankCat();
  editCatForm: CategoryCreate = this.blankCat();

  readonly catTypes = ['fixed', 'variable', 'learning', 'family'] as const;

  grouped = computed(() => {
    const map: Record<string, Category[]> = {};
    for (const t of this.catTypes) map[t] = [];
    for (const c of this.categories()) map[c.type]?.push(c);
    return map;
  });

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private aiService: AiService,
  ) {}

  ngOnInit(): void {
    this.loadTransactions();
    this.loadCategories();
  }

  // ── Transaction methods ───────────────────────────────────────

  loadTransactions(): void {
    this.loadingTx.set(true);
    this.showAllTx.set(false);
    this.transactionService.list({ month: this.selectedMonth(), year: this.selectedYear() }).subscribe(t => {
      this.transactions.set(t);
      this.loadingTx.set(false);
    });
  }

  saveTx(): void {
    if (!this.form.amount || !this.form.date) return;
    this.savingTx.set(true);
    this.transactionService.create(this.form).subscribe({
      next: () => { this.showTxForm.set(false); this.savingTx.set(false); this.form = this.blankTx(); this.loadTransactions(); },
      error: () => this.savingTx.set(false),
    });
  }

  startEditTx(t: Transaction): void {
    this.editTxForm = { date: t.date, amount: t.amount, description: t.description ?? '', type: t.type, category_id: t.category_id };
    this.showTxForm.set(false);
    this.editingTxId.set(t.id);
  }

  cancelEditTx(): void { this.editingTxId.set(null); }

  saveEditTx(): void {
    const id = this.editingTxId();
    if (!id) return;
    this.savingTx.set(true);
    this.errorMsg.set(null);
    this.transactionService.update(id, this.editTxForm).subscribe({
      next: (updated) => {
        this.transactions.update(list => list.map(t => t.id === id ? updated : t));
        this.editingTxId.set(null);
        this.savingTx.set(false);
      },
      error: (err) => {
        this.savingTx.set(false);
        this.errorMsg.set(`Update failed (${err?.status}): ${JSON.stringify(err?.error)}`);
      },
    });
  }

  deleteTx(id: number): void {
    if (!confirm('Delete this transaction?')) return;
    this.transactionService.delete(id).subscribe(() => this.loadTransactions());
  }

  openBulk(): void { this.bulkResult.set(null); this.bulkError.set(null); this.showBulk.set(true); }

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
      next: (res) => { this.bulkResult.set(res); this.bulkLoading.set(false); this.loadTransactions(); },
      error: (err) => { this.bulkError.set(err.error?.detail ?? 'Import failed.'); this.bulkLoading.set(false); },
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
    const s = this.suggestedCategory();
    if (!s) return;
    const cat = this.categories().find(c => c.name === s);
    if (cat) this.form.category_id = cat.id;
    this.suggestedCategory.set(null);
  }

  dismissSuggestion(): void { this.suggestedCategory.set(null); }

  private blankTx(): TransactionCreate {
    return { date: new Date().toISOString().split('T')[0], amount: 0, description: '', type: 'expense', category_id: null };
  }

  private exampleJson(): string {
    return JSON.stringify([
      { "description": "Monthly salary",  "amount": 1000, "category_name": null,             "type": "income",  "day": 1  },
      { "description": "Rent",            "amount": 500,  "category_name": "Rent",            "type": "expense", "day": 1  },
      { "description": "Groceries",       "amount": 200,  "category_name": "Groceries",       "type": "expense", "day": 15 },
    ], null, 2);
  }

  // ── Category methods ──────────────────────────────────────────

  loadCategories(): void {
    this.loadingCat.set(true);
    this.categoryService.list().subscribe(cats => { this.categories.set(cats); this.loadingCat.set(false); });
  }

  saveCat(): void {
    this.savingCat.set(true);
    this.categoryService.create(this.catForm).subscribe({
      next: () => { this.showCatForm.set(false); this.savingCat.set(false); this.catForm = this.blankCat(); this.loadCategories(); },
      error: () => this.savingCat.set(false),
    });
  }

  startEditCat(cat: Category): void {
    this.editCatForm = { name: cat.name, type: cat.type, planned_amount: cat.planned_amount, icon: cat.icon ?? '', color: cat.color ?? '#6366f1' };
    this.showCatForm.set(false);
    this.editingCatId.set(cat.id);
  }

  cancelEditCat(): void { this.editingCatId.set(null); }

  saveEditCat(): void {
    const id = this.editingCatId();
    if (!id) return;
    this.savingCat.set(true);
    this.categoryService.update(id, this.editCatForm).subscribe({
      next: () => { this.editingCatId.set(null); this.savingCat.set(false); this.loadCategories(); },
      error: () => this.savingCat.set(false),
    });
  }

  deleteCat(id: number): void {
    if (!confirm('Delete this category? Existing transactions will keep their category reference.')) return;
    this.categoryService.delete(id).subscribe(() => this.loadCategories());
  }

  private blankCat(): CategoryCreate {
    return { name: '', type: 'variable', planned_amount: 0, icon: 'tag', color: '#6366f1' };
  }
}
