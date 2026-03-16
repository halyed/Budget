import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface UserResponse {
  id: number;
  email: string;
  username: string;
}

interface MessageResponse {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly apiBase = environment.apiUrl;

  private _token = signal<string | null>(null);

  login(email: string, password: string): Observable<void> {
    return this.http
      .post<TokenResponse>(`${this.apiBase}/auth/login`, { email, password }, { withCredentials: true })
      .pipe(
        tap(res => this._token.set(res.access_token)),
        map(() => void 0),
      );
  }

  register(email: string, password: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.apiBase}/auth/register`,
      { email, password },
      { withCredentials: true },
    );
  }

  logout(): void {
    this.http.post(`${this.apiBase}/auth/logout`, {}, { withCredentials: true }).subscribe({
      complete: () => this._clearAndRedirect(),
      error: () => this._clearAndRedirect(),
    });
  }

  refreshToken(): Observable<void> {
    return this.http
      .post<TokenResponse>(`${this.apiBase}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap(res => this._token.set(res.access_token)),
        map(() => void 0),
      );
  }

  tryRestoreSession(): Promise<void> {
    return this.refreshToken()
      .pipe(catchError(() => of(void 0)))
      .toPromise() as Promise<void>;
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.apiBase}/auth/change-password`, {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  getToken(): string | null {
    return this._token();
  }

  isAuthenticated(): boolean {
    const token = this._token();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  private _clearAndRedirect(): void {
    this._token.set(null);
    this.router.navigate(['/login']);
  }
}
