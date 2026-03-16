import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink],
  templateUrl: './verify-email.component.html',
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  status = signal<'loading' | 'success' | 'error'>('loading');
  message = signal('');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.status.set('error');
      this.message.set('Invalid verification link.');
      return;
    }

    this.http.post<{ message: string }>(`${environment.apiUrl}/auth/verify-email`, { token }).subscribe({
      next: res => {
        this.status.set('success');
        this.message.set(res.message);
      },
      error: err => {
        this.status.set('error');
        this.message.set(err.error?.detail ?? 'Invalid or expired verification link.');
      },
    });
  }
}
