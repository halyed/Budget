# Budget v2 — Implementation Checklist

## Features
- Multi-user support (each user has isolated data)
- Email-based registration & login
- More secure authentication (short-lived tokens + refresh tokens)
- Multi-month reports (data already persisted, frontend to be built)

---

## Phase 1 — Database Schema

- [x] 1.1 Extend `User` model — add `email`, `is_active`, `created_at`
- [x] 1.2 Add `user_id` FK to `transactions`, `categories`, `investments`, `savings_goals`
- [x] 1.3 Fix `categories.name` uniqueness — `UNIQUE(name)` → `UNIQUE(name, user_id)`
- [x] 1.4 Create `refresh_tokens` table
- [x] 1.5 Write & run Alembic migration (backfill existing data to admin, SQLite batch_alter_table)

---

## Phase 2 — Auth Overhaul (Backend)

- [x] 2.1 Shorten access token to 15 min, add 30-day refresh token via `HttpOnly` cookie
- [x] 2.2 Update `get_current_user` — return full `User` ORM object instead of username string
- [x] 2.3 New `POST /auth/register` — email + password, rate-limited to 3/hour
- [x] 2.4 Update `POST /auth/login` — email instead of username
- [x] 2.5 New `POST /auth/refresh` — reads cookie, issues new access token
- [x] 2.6 New `POST /auth/logout` — revokes refresh token, clears cookie
- [x] 2.7 Update schemas — `LoginRequest`, `RegisterRequest`, `TokenResponse`, `UserResponse`
- [x] 2.8 Update `main.py` admin bootstrap — use `ADMIN_EMAIL` instead of `ADMIN_USERNAME`

---

## Phase 3 — Query Scoping (Backend)

- [x] 3.1 `transactions.py` — scope all queries + fix `_adjust_savings` helper
- [x] 3.2 `categories.py` — scope all queries
- [x] 3.3 `investments.py` — scope all queries
- [x] 3.4 `goals.py` — scope all queries + fix `_investment_total` helper
- [x] 3.5 `dashboard.py` — scope all 4 endpoints

---

## Phase 4 — Seed Data

- [x] 4.1 Update `seed.py` — accept `user_id`, only seed if user has no data yet

---

## Phase 5 — Frontend

- [x] 5.1 `AuthService` — in-memory token, add `register()`, `refreshToken()`, `tryRestoreSession()`
- [x] 5.2 `auth.interceptor.ts` — add `withCredentials: true`, handle silent 401 refresh
- [x] 5.3 New `RegisterComponent` — email, password, confirm password
- [x] 5.4 Update `LoginComponent` — username → email, add "Register" link
- [x] 5.5 `app.routes.ts` — add `/register` route
- [x] 5.6 `app.config.ts` — add `APP_INITIALIZER` for silent session restore

---

## Phase 6 — Config & Deployment

- [ ] 6.1 Fix `ALLOWED_ORIGINS: "*"` in `docker-compose.yml` — must be explicit origin for cookies to work
- [ ] 6.2 Add `REGISTRATION_ENABLED` env var
- [ ] 6.3 Add `ADMIN_EMAIL` env var, update `.env` / `docker-compose.yml`

---

## Phase 7 — Reports (Frontend)

- [ ] 7.1 Build `ReportsComponent` — monthly trend charts across multiple months
- [ ] 7.2 Add chart library (e.g. Chart.js or ngx-charts)
- [ ] 7.3 Wire up to existing dashboard/transaction API endpoints

---

## Notes
- Data is already stored historically — no backend work needed for reports
- All phases 1–4 must be done before the frontend (phases 5–6) to agree on the API contract
- Phase 6.1 (CORS fix) is a blocker for cookie-based auth to work
