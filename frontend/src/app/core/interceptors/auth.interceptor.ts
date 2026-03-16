import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const AUTH_SKIP_URLS = ['/auth/refresh', '/auth/login', '/auth/logout'];

function withAuth(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
  });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const isAuthSkip = AUTH_SKIP_URLS.some(url => req.url.includes(url));

  return next(withAuth(req, authService.getToken())).pipe(
    catchError(err => {
      if (err.status === 401 && !isAuthSkip) {
        // Try silent refresh then replay the original request once
        return authService.refreshToken().pipe(
          switchMap(() => next(withAuth(req, authService.getToken()))),
          catchError(() => {
            authService.logout();
            return throwError(() => err);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
