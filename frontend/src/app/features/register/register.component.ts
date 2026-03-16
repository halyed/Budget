import { Component, inject, signal } from '@angular/core';
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

  onSubmit(): void {
    if (this.password() !== this.confirmPassword()) {
      this.error.set('Passwords do not match.');
      return;
    }
    if (this.password().length < 8) {
      this.error.set('Password must be at least 8 characters.');
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
