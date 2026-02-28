import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoalService } from '../../core/services/goal.service';
import { SavingsGoal, GoalCreate } from '../../core/models/goal.model';

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './goals.component.html',
})
export class GoalsComponent implements OnInit {
  goals = signal<SavingsGoal[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = signal(false);
  editingId = signal<number | null>(null);

  form: GoalCreate = this.blank();
  editForm: GoalCreate = this.blank();

  constructor(private goalService: GoalService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.goalService.list().subscribe(g => { this.goals.set(g); this.loading.set(false); });
  }

  save(): void {
    this.saving.set(true);
    this.goalService.create(this.form).subscribe({
      next: () => { this.showForm.set(false); this.saving.set(false); this.form = this.blank(); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  startEdit(g: SavingsGoal): void {
    this.editForm = {
      name: g.name,
      description: g.description,
      target_amount: g.target_amount,
      target_date: g.target_date,
    };
    this.showForm.set(false);
    this.editingId.set(g.id);
  }

  cancelEdit(): void { this.editingId.set(null); }

  saveEdit(): void {
    const id = this.editingId();
    if (!id) return;
    this.saving.set(true);
    this.goalService.update(id, this.editForm).subscribe({
      next: () => { this.editingId.set(null); this.saving.set(false); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  delete(id: number): void {
    if (!confirm('Delete this goal?')) return;
    this.goalService.delete(id).subscribe(() => this.load());
  }

  private blank(): GoalCreate {
    return { name: '', description: null, target_amount: 0, target_date: null };
  }
}
