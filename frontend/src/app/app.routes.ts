import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { TransactionsComponent } from './features/transactions/transactions.component';
import { InvestmentsComponent } from './features/investments/investments.component';
import { GoalsComponent } from './features/goals/goals.component';
import { ReportsComponent } from './features/reports/reports.component';
import { LoginComponent } from './features/login/login.component';
import { RegisterComponent } from './features/register/register.component';
import { VerifyEmailComponent } from './features/verify-email/verify-email.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'verify-email', component: VerifyEmailComponent },
  { path: 'dashboard',    component: DashboardComponent,    canActivate: [authGuard] },
  { path: 'transactions', component: TransactionsComponent, canActivate: [authGuard] },
  { path: 'investments',  component: InvestmentsComponent,  canActivate: [authGuard] },
  { path: 'goals',        component: GoalsComponent,        canActivate: [authGuard] },
  { path: 'reports',      component: ReportsComponent,      canActivate: [authGuard] },
];
