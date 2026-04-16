import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvestmentService } from '../../core/services/investment.service';
import { GoalService } from '../../core/services/goal.service';
import { Investment, InvestmentCreate } from '../../core/models/investment.model';
import { SavingsGoal, GoalCreate } from '../../core/models/goal.model';
import { CurrencyFormatPipe } from '../../core/pipes/currency-format.pipe';

@Component({
  selector: 'app-investments',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatPipe],
  templateUrl: './investments.component.html',
})
export class InvestmentsComponent implements OnInit {
  // --- Investments ---
  investments = signal<Investment[]>([]);
  loadingInv  = signal(true);
  savingInv   = signal(false);
  showInvForm = signal(false);
  editingInvId = signal<number | null>(null);

  total = computed(() => this.investments().reduce((s, i) => s + i.value, 0));

  editInvForm: InvestmentCreate = this.blankInv();
  invForm: InvestmentCreate = this.blankInv();

  // --- Goals ---
  goals = signal<SavingsGoal[]>([]);
  loadingGoals  = signal(true);
  savingGoal    = signal(false);
  showGoalForm  = signal(false);
  editingGoalId = signal<number | null>(null);

  goalForm: GoalCreate = this.blankGoal();
  editGoalForm: GoalCreate = this.blankGoal();

  constructor(
    private investmentService: InvestmentService,
    private goalService: GoalService,
  ) {}

  ngOnInit(): void {
    this.loadInvestments();
    this.loadGoals();
  }

  // --- Investment methods ---

  loadInvestments(): void {
    this.loadingInv.set(true);
    this.investmentService.list().subscribe(inv => { this.investments.set(inv); this.loadingInv.set(false); });
  }

  saveInv(): void {
    this.savingInv.set(true);
    this.investmentService.create(this.invForm).subscribe({
      next: () => { this.showInvForm.set(false); this.savingInv.set(false); this.invForm = this.blankInv(); this.loadInvestments(); },
      error: () => this.savingInv.set(false),
    });
  }

  startEditInv(inv: Investment): void {
    this.editInvForm = { name: inv.name, type: inv.type, value: inv.value };
    this.showInvForm.set(false);
    this.editingInvId.set(inv.id);
  }

  cancelEditInv(): void { this.editingInvId.set(null); }

  saveEditInv(): void {
    const id = this.editingInvId();
    if (!id) return;
    this.savingInv.set(true);
    this.investmentService.update(id, this.editInvForm).subscribe({
      next: () => { this.editingInvId.set(null); this.savingInv.set(false); this.loadInvestments(); this.loadGoals(); },
      error: () => this.savingInv.set(false),
    });
  }

  deleteInv(id: number): void {
    if (!confirm('Delete this investment?')) return;
    this.investmentService.delete(id).subscribe(() => { this.loadInvestments(); this.loadGoals(); });
  }

  private blankInv(): InvestmentCreate { return { name: '', type: 'etf', value: 0 }; }

  // --- Goal methods ---

  loadGoals(): void {
    this.loadingGoals.set(true);
    this.goalService.list().subscribe(g => { this.goals.set(g); this.loadingGoals.set(false); });
  }

  saveGoal(): void {
    this.savingGoal.set(true);
    this.goalService.create(this.goalForm).subscribe({
      next: () => { this.showGoalForm.set(false); this.savingGoal.set(false); this.goalForm = this.blankGoal(); this.loadGoals(); },
      error: () => this.savingGoal.set(false),
    });
  }

  startEditGoal(g: SavingsGoal): void {
    this.editGoalForm = {
      name: g.name,
      description: g.description,
      target_amount: g.target_amount,
      target_date: g.target_date,
      investment_ids: g.linked_investments.map(i => i.id),
    };
    this.showGoalForm.set(false);
    this.editingGoalId.set(g.id);
  }

  cancelEditGoal(): void { this.editingGoalId.set(null); }

  saveEditGoal(): void {
    const id = this.editingGoalId();
    if (!id) return;
    this.savingGoal.set(true);
    this.goalService.update(id, this.editGoalForm).subscribe({
      next: () => { this.editingGoalId.set(null); this.savingGoal.set(false); this.loadGoals(); },
      error: () => this.savingGoal.set(false),
    });
  }

  deleteGoal(id: number): void {
    if (!confirm('Delete this goal?')) return;
    this.goalService.delete(id).subscribe(() => this.loadGoals());
  }

  toggleInvestment(form: GoalCreate, invId: number): void {
    const idx = form.investment_ids.indexOf(invId);
    if (idx === -1) form.investment_ids = [...form.investment_ids, invId];
    else form.investment_ids = form.investment_ids.filter(id => id !== invId);
  }

  isLinked(form: GoalCreate, invId: number): boolean {
    return form.investment_ids.includes(invId);
  }

  private blankGoal(): GoalCreate {
    return { name: '', description: null, target_amount: 0, target_date: null, investment_ids: [] };
  }
}
