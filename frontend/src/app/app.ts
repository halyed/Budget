import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private authService = inject(AuthService);

  navItems = [
    { path: '/dashboard',     label: 'Dashboard' },
    { path: '/transactions',  label: 'Transactions' },
    { path: '/categories',    label: 'Categories' },
    { path: '/investments',   label: 'Investments' },
    { path: '/goals',         label: 'Goals' },
    { path: '/reports',       label: 'Reports' },
    { path: '/chat',          label: 'AI Chat' },
  ];

  // Change-password modal state
  sidebarOpen = signal(false);
  showModal   = signal(false);
  cpCurrent   = signal('');
  cpNew       = signal('');
  cpError     = signal('');
  cpSuccess   = signal(false);
  cpLoading   = signal(false);

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get username(): string {
    return this.authService.currentUserEmail();
  }

  logout(): void {
    this.authService.logout();
  }

  openModal(): void {
    this.cpCurrent.set('');
    this.cpNew.set('');
    this.cpError.set('');
    this.cpSuccess.set(false);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  submitChangePassword(): void {
    this.cpError.set('');
    this.cpSuccess.set(false);
    this.cpLoading.set(true);

    this.authService.changePassword(this.cpCurrent(), this.cpNew()).subscribe({
      next: () => {
        this.cpSuccess.set(true);
        this.cpLoading.set(false);
        setTimeout(() => this.closeModal(), 1500);
      },
      error: (err) => {
        this.cpError.set(err.error?.detail ?? 'Failed to update password.');
        this.cpLoading.set(false);
      },
    });
  }
}
