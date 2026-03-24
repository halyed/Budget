import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../core/services/category.service';
import { Category, CategoryCreate } from '../../core/models/category.model';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.component.html',
})
export class CategoriesComponent implements OnInit {
  categories = signal<Category[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);

  form: CategoryCreate = this.blank();
  editForm: CategoryCreate = this.blank();

  readonly types = ['fixed', 'variable', 'learning', 'family'] as const;

  grouped = computed(() => {
    const map: Record<string, Category[]> = {};
    for (const t of this.types) map[t] = [];
    for (const c of this.categories()) map[c.type]?.push(c);
    return map;
  });

  constructor(private categoryService: CategoryService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.categoryService.list().subscribe(cats => { this.categories.set(cats); this.loading.set(false); });
  }

  save(): void {
    this.saving.set(true);
    this.categoryService.create(this.form).subscribe({
      next: () => { this.showForm.set(false); this.saving.set(false); this.form = this.blank(); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  startEdit(cat: Category): void {
    this.editForm = { name: cat.name, type: cat.type, planned_amount: cat.planned_amount, icon: cat.icon ?? '', color: cat.color ?? '#6366f1' };
    this.showForm.set(false);
    this.editingId.set(cat.id);
  }

  cancelEdit(): void { this.editingId.set(null); }

  saveEdit(): void {
    const id = this.editingId();
    if (!id) return;
    this.saving.set(true);
    this.categoryService.update(id, this.editForm).subscribe({
      next: () => { this.editingId.set(null); this.saving.set(false); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  delete(id: number): void {
    if (!confirm('Delete this category? Existing transactions will keep their category reference.')) return;
    this.categoryService.delete(id).subscribe(() => this.load());
  }

  private blank(): CategoryCreate {
    return { name: '', type: 'variable', planned_amount: 0, icon: 'tag', color: '#6366f1' };
  }
}
