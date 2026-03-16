import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  email = signal('');
  password = signal('');
  loading = signal(false);
  error = signal('');
  success = signal(this.route.snapshot.queryParamMap.get('registered') === '1'
    ? 'Account created! Please check your inbox to verify your email.'
    : '');
  showResend = signal(false);
  resendSent = signal(false);

  onSubmit(): void {
    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.showResend.set(false);

    this.authService.login(this.email(), this.password()).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: err => {
        if (err.status === 403 && err.error?.detail?.includes('verify')) {
          this.error.set(err.error.detail);
          this.showResend.set(true);
        } else {
          this.error.set('Invalid email or password.');
        }
        this.loading.set(false);
      },
    });
  }

  resendVerification(): void {
    this.http.post(`${environment.apiUrl}/auth/resend-verification`, { email: this.email() }).subscribe({
      next: () => this.resendSent.set(true),
      error: () => this.resendSent.set(true), // same message either way
    });
  }
}
