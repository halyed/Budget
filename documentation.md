# Budget App — Documentation

Personal finance tracker — multi-user web app accessible from any browser. Tracks monthly income/expenses, categories, investments, savings goals, reports and an AI finance assistant.

Live at: **https://hbudget.duckdns.org**

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Features](#features)
5. [Local Development](#local-development)
6. [Environment Variables](#environment-variables)
7. [Authentication](#authentication)
8. [API Reference](#api-reference)
9. [Deployment](#deployment)
10. [Database](#database)
11. [CI/CD](#cicd)

---

## Architecture

```
Browser
    │
    │ HTTPS (443)
    ▼
  Caddy (shared)     ← automatic Let's Encrypt, routes by domain
    │
    ├── budget-frontend:80   ← Angular SPA (nginx)
    └── budget-backend:8000  ← FastAPI REST API
         │
         ▼
       SQLite          ← persisted in Docker named volume
         │
       Ollama          ← local AI model (phi3:mini) for spending insights
```

All services run as Docker containers on a shared `web` Docker network managed by a top-level Caddy instance. Only Caddy is exposed to the internet.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21, Tailwind CSS, Chart.js |
| Backend | FastAPI (Python 3.12), SQLAlchemy 2, Alembic |
| Database | SQLite |
| Auth | JWT (python-jose), bcrypt, HttpOnly refresh tokens |
| AI Chat | Groq API (llama-3.3-70b) |
| AI Insights | Ollama (phi3:mini, local) |
| Web server | nginx (SPA) |
| TLS / Proxy | Caddy (automatic Let's Encrypt) |
| Containerisation | Docker + Docker Compose |
| CI/CD | GitHub Actions |

---

## Project Structure

```
Budget/
├── Caddyfile                        # Note: not used — shared Caddy is one level up
├── docker-compose.yml
├── documentation.md
├── .github/workflows/
│   ├── ci.yml                       # builds Docker images + runs frontend tests
│   └── deploy.yml                   # SSH deploy to VPS (runs after CI passes)
│
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh                # alembic upgrade head → uvicorn
│   ├── requirements.txt
│   ├── .env                         # secrets — never committed
│   ├── .env.example                 # template with all variables
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 001_add_multi_user_support.py
│   │       ├── 002_add_verification_tokens.py
│   │       ├── 003_fix_categories_unique_constraint.py
│   │       └── 004_fix_categories_drop_name_unique.py
│   └── app/
│       ├── main.py                  # FastAPI app, lifespan (migrations + admin bootstrap)
│       ├── core/
│       │   ├── config.py            # Settings from .env (pydantic-settings)
│       │   ├── database.py          # SQLAlchemy engine + session
│       │   ├── deps.py              # get_current_user dependency
│       │   ├── security.py          # bcrypt, JWT, refresh token helpers
│       │   ├── email_service.py     # SMTP email (Yahoo/Gmail)
│       │   └── limiter.py           # slowapi rate limiter
│       ├── models/
│       │   ├── user.py
│       │   ├── category.py
│       │   ├── transaction.py
│       │   ├── investment.py
│       │   ├── goal.py
│       │   ├── refresh_token.py
│       │   └── verification_token.py
│       ├── schemas/
│       │   ├── auth.py
│       │   ├── category.py
│       │   ├── transaction.py
│       │   ├── investment.py
│       │   └── goal.py
│       ├── api/v1/
│       │   ├── router.py
│       │   └── routes/
│       │       ├── auth.py          # register, login, verify-email, refresh, logout, me, change-password
│       │       ├── dashboard.py     # summary, budget-vs-actual, portfolio, goals
│       │       ├── categories.py
│       │       ├── transactions.py  # CRUD + bulk import
│       │       ├── investments.py
│       │       ├── goals.py
│       │       ├── reports.py       # monthly-summary (multi-month trends)
│       │       └── ai.py            # suggest-category, insights, chat
│       ├── ai/
│       │   ├── categorizer.py       # rule-based auto-categorization
│       │   ├── insights.py          # Ollama spending insights
│       │   ├── chat.py              # Groq AI chat with full financial snapshot
│       │   └── rules.json           # keyword → category mapping
│       └── db/
│           └── seed.py              # seeds default categories for new users
│
└── frontend/
    ├── Dockerfile                   # node build → nginx (2-stage)
    └── src/app/
        ├── app.ts / app.html        # root: sidebar, currency selector, change-password modal
        ├── app.routes.ts            # routes with authGuard
        ├── app.config.ts            # provideHttpClient + APP_INITIALIZER (session restore)
        ├── core/
        │   ├── services/
        │   │   ├── auth.service.ts
        │   │   ├── api.service.ts
        │   │   ├── currency.service.ts  # user currency preference (localStorage)
        │   │   └── ...
        │   ├── pipes/
        │   │   └── currency-format.pipe.ts  # formats amounts with selected currency
        │   ├── interceptors/
        │   │   └── auth.interceptor.ts  # Bearer token + silent 401 refresh
        │   └── guards/
        │       └── auth.guard.ts
        └── features/
            ├── login/
            ├── register/            # with password strength indicator
            ├── verify-email/
            ├── dashboard/
            ├── transactions/        # CRUD + bulk import
            ├── categories/          # manage categories + planned amounts
            ├── investments/
            ├── goals/
            ├── reports/             # multi-month trend charts
            └── chat/                # AI finance assistant
```

---

## Features

### Core
- **Multi-user** — each user has fully isolated data
- **Email verification** — new accounts require email confirmation before login
- **Secure auth** — 15-min access tokens + 30-day HttpOnly refresh tokens
- **Rate limiting** — 3 registrations/hour, 5 login attempts/minute

### Budget Management
- **Transactions** — income, expense, savings with category assignment
- **Bulk import** — import a full month via JSON
- **Categories** — custom categories with planned amounts, grouped by type (fixed, variable, learning, family)
- **Budget vs Actual** — planned vs spent per category on dashboard

### Investments & Goals
- **Investments** — track stocks, ETFs, crypto, cash, real estate
- **Savings goals** — track progress toward financial targets

### Reports
- **Monthly trends** — income/expenses/savings rate over up to 24 months
- **Category trends** — spending per category over time (Chart.js)

### AI Features
- **Auto-categorization** — suggests category based on transaction description (rule-based, no external API)
- **Spending insights** — AI-generated bullet points using Ollama (local, requires phi3:mini)
- **Finance chat** — Groq-powered assistant with full financial context:
  - Current month summary
  - Budget vs actual per category
  - Last 30 transactions
  - Last 3 months history
  - Goals and investments

### UX
- **Currency selector** — choose €, FCFA, $, £, ₦, ¥ — persists in browser
- **Responsive** — works on mobile and desktop
- **Auto-seed** — new users get default categories on first login

---

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 22+
- npm

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

cp .env.example .env
# Edit .env: set SECRET_KEY, ADMIN_PASSWORD, DEBUG=true

uvicorn app.main:app --reload --port 8000
```

> With `DEBUG=true`, email verification is skipped — accounts activate immediately.

### Frontend

```bash
cd frontend
npm install
npm start
```

App at `http://localhost:4200` — proxies `/api/*` to `http://localhost:8000`.

---

## Environment Variables

Create `backend/.env` from `.env.example`:

```env
# Database (overridden by docker-compose in production)
DATABASE_URL=sqlite:///./budget.db

# CORS
ALLOWED_ORIGINS=https://your-domain.com

# JWT secret — generate with:
# python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=REPLACE_WITH_GENERATED_SECRET

# Admin account (created on first startup if not exists)
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=REPLACE_WITH_STRONG_PASSWORD

# Registration
REGISTRATION_ENABLED=true

# Debug (true = skip email verification)
DEBUG=false

# AI — Groq (chat assistant)
GROQ_API_KEY=

# AI — Ollama (spending insights, runs via Docker)
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=phi3:mini

# Email — Yahoo or Gmail App Password
MAIL_USER=your_email@yahoo.com
MAIL_PASSWORD=your_app_password
MAIL_HOST=smtp.mail.yahoo.com
MAIL_PORT=587

# Public URL (used in verification email links)
APP_URL=https://your-domain.com
```

---

## Authentication

### Flow

1. User registers → account created with `is_active=False`
2. Verification email sent with a 24h link
3. User clicks link → `is_active=True`
4. `POST /auth/login` → returns access token (15min) + sets HttpOnly refresh cookie (30 days)
5. `authInterceptor` attaches `Authorization: Bearer <token>` to all requests
6. On 401 → interceptor silently calls `POST /auth/refresh` → retries original request
7. On refresh failure → logout → redirect to `/login`

> With `DEBUG=true`, step 2-3 are skipped and accounts activate immediately.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Create account (rate limited: 3/hour) |
| `POST` | `/auth/login` | Public | Login (rate limited: 5/min) |
| `POST` | `/auth/verify-email` | Public | Verify email with token |
| `POST` | `/auth/resend-verification` | Public | Resend verification email |
| `POST` | `/auth/refresh` | Cookie | Issue new access token |
| `POST` | `/auth/logout` | Cookie | Revoke refresh token |
| `GET` | `/auth/me` | Required | Current user info |
| `POST` | `/auth/change-password` | Required | Update password |

---

## API Reference

Base URL: `/api/v1` — all endpoints except `/auth/*` require `Authorization: Bearer <token>`.

### Dashboard

| Method | Path | Params | Description |
|---|---|---|---|
| `GET` | `/dashboard/summary` | `month`, `year` | Income, expenses, saved, savings rate |
| `GET` | `/dashboard/budget-vs-actual` | `month`, `year` | Planned vs actual per category |
| `GET` | `/dashboard/portfolio` | — | Total portfolio + breakdown |
| `GET` | `/dashboard/goals` | — | Goals with progress |

### Categories

| Method | Path | Description |
|---|---|---|
| `GET` | `/categories` | List all (ordered by type, name) |
| `POST` | `/categories` | Create |
| `PATCH` | `/categories/{id}` | Update |
| `DELETE` | `/categories/{id}` | Delete |

Types: `fixed`, `variable`, `learning`, `family`

### Transactions

| Method | Path | Description |
|---|---|---|
| `GET` | `/transactions` | List (filter: `month`, `year`, `type`, `category_id`) |
| `POST` | `/transactions` | Create |
| `PATCH` | `/transactions/{id}` | Update |
| `DELETE` | `/transactions/{id}` | Delete |
| `POST` | `/transactions/bulk` | Import a full month from JSON |

Types: `income`, `expense`, `savings`

**Bulk import payload:**
```json
{
  "month": "2026-03",
  "transactions": [
    { "description": "Salary", "amount": 1000, "type": "income", "day": 1 },
    { "description": "Rent", "amount": 500, "category_name": "Rent", "type": "expense", "day": 1 }
  ]
}
```

### Investments

| Method | Path | Description |
|---|---|---|
| `GET` | `/investments` | List all |
| `POST` | `/investments` | Create |
| `PATCH` | `/investments/{id}` | Update |
| `DELETE` | `/investments/{id}` | Delete |

Types: `stocks`, `etf`, `crypto`, `cash`, `real_estate`

### Goals

| Method | Path | Description |
|---|---|---|
| `GET` | `/goals` | List all |
| `POST` | `/goals` | Create |
| `PATCH` | `/goals/{id}` | Update |
| `DELETE` | `/goals/{id}` | Delete |

### Reports

| Method | Path | Params | Description |
|---|---|---|---|
| `GET` | `/reports/monthly-summary` | `months` (1-24) | Multi-month income/expense/category trends |

### AI

| Method | Path | Description |
|---|---|---|
| `POST` | `/ai/suggest-category` | Suggests a category for a transaction description |
| `POST` | `/ai/insights` | Generates spending insights via Ollama |
| `POST` | `/ai/chat` | Multi-turn finance chat via Groq |

> AI endpoints gracefully degrade: chat returns 503 if `GROQ_API_KEY` not set, insights return 503 if Ollama not running.

---

## Deployment

### Prerequisites

- VPS with Docker installed
- Domain pointing to VPS IP
- Shared Caddy container on a `web` Docker network

### First deployment

```bash
git clone https://github.com/halyed/Budget.git ~/apps/Budget
cd ~/apps/Budget

cp backend/.env.example backend/.env
nano backend/.env   # fill in all values

docker compose up -d --build
```

### Update

Handled automatically by GitHub Actions CD pipeline on every push to `master` that passes CI.

Manual update:
```bash
git pull origin master
docker compose up -d --build
```

### Pull Ollama model (first time only)

```bash
docker compose exec ollama ollama pull phi3:mini
```

### Useful commands

```bash
docker compose logs backend --tail=50
docker compose logs backend --since 10m
docker compose restart backend
docker compose ps
```

### Reset admin password

```bash
# On the VPS:
docker compose exec backend python -c "
import sqlite3
conn = sqlite3.connect('/app/data/budget.db')
conn.execute(\"UPDATE users SET password_hash='' WHERE email='admin@localhost'\")
conn.commit()
"
# Then update ADMIN_PASSWORD in .env and restart — admin bootstrap will re-create the user
```

---

## Database

SQLite at `/app/data/budget.db` inside the container, persisted in the `db_data` Docker named volume.

### Tables

| Table | Description |
|---|---|
| `users` | Registered users with email, password hash, active status |
| `categories` | Budget categories with planned amounts (scoped per user) |
| `transactions` | Income, expense, savings entries (scoped per user) |
| `investments` | Investment positions (scoped per user) |
| `savings_goals` | Savings targets (scoped per user) |
| `refresh_tokens` | Active refresh tokens with expiry and revocation flag |
| `verification_tokens` | Email verification tokens (24h expiry) |

### Migrations

Alembic runs automatically on container startup via `entrypoint.sh`:

```bash
alembic upgrade head
```

Migration history:
- `001` — multi-user support (user_id FK, email, refresh_tokens)
- `002` — email verification tokens
- `003` — fix categories unique constraint (batch recreate)
- `004` — drop leftover UNIQUE(name) via raw SQL rebuild

---

## CI/CD

Two GitHub Actions workflows:

**CI** (`.github/workflows/ci.yml`) — triggers on push to `master`:
- Builds backend Docker image
- Builds frontend Docker image
- Runs Angular unit tests

**Deploy** (`.github/workflows/deploy.yml`) — triggers when CI passes on `master`:
- SSH into VPS
- `git pull origin master`
- `docker compose up --build -d`
- Health check: `GET https://hbudget.duckdns.org/health`

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `VPS_HOST` | VPS IP address |
| `VPS_USER` | SSH username |
| `VPS_SSH_KEY` | Private SSH key |
| `VPS_PATH` | Project path on VPS (e.g. `/home/user/apps/Budget`) |
