import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private authService = inject(AuthService);

  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  loading = signal(false);
  error = signal('');
  submitted = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  passwordStrength = computed(() => {
    const p = this.password();
    if (!p) return null;
    let score = 0;
    if (p.length >= 8)  score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/3' };
    if (score <= 3) return { label: 'Fair', color: 'bg-yellow-500', width: 'w-2/3' };
    return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
  });

  onSubmit(): void {
    if (this.password() !== this.confirmPassword()) {
      this.error.set('Passwords do not match.');
      return;
    }
    if (this.password().length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }
    if (this.passwordStrength()?.label === 'Weak') {
      this.error.set('Password is too weak. Add uppercase letters, numbers or symbols.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.authService.register(this.email(), this.password()).subscribe({
      next: () => this.submitted.set(true),
      error: err => {
        const detail = err.error?.detail ?? 'Registration failed. Please try again.';
        this.error.set(detail);
        this.loading.set(false);
      },
    });
  }
}
