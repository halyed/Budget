import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { TransactionsComponent } from './features/transactions/transactions.component';
import { InvestmentsComponent } from './features/investments/investments.component';
import { ReportsComponent } from './features/reports/reports.component';
import { ChatComponent } from './features/chat/chat.component';
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
  { path: 'categories',   redirectTo: 'transactions',        pathMatch: 'full' },
  { path: 'investments',  component: InvestmentsComponent,  canActivate: [authGuard] },
  { path: 'goals',        redirectTo: 'investments',        pathMatch: 'full' },
  { path: 'reports',      component: ReportsComponent,      canActivate: [authGuard] },
  { path: 'chat',         component: ChatComponent,         canActivate: [authGuard] },
];
