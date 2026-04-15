# Budget App — Documentation

Personal finance tracker — multi-user web app accessible from any browser. Tracks monthly income/expenses, categories, investments, savings goals, reports and an AI finance assistant.

Live at: **https://budget.halyed.com**

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
| Frontend | Angular 21, Tailwind CSS, Chart.js, chartjs-chart-sankey |
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
│   │       ├── 004_fix_categories_drop_name_unique.py
│   │       └── 005_add_goal_investments_junction.py  ← goal ↔ investment many-to-many
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
│       │   ├── goal.py              # includes goal_investments junction table
│       │   ├── refresh_token.py
│       │   └── verification_token.py
│       ├── schemas/
│       │   ├── auth.py
│       │   ├── category.py
│       │   ├── transaction.py
│       │   ├── investment.py
│       │   └── goal.py              # GoalCreate/Update accept investment_ids[]; GoalRead returns linked_investments
│       ├── api/v1/
│       │   ├── router.py
│       │   └── routes/
│       │       ├── auth.py          # register, login, verify-email, refresh, logout, me, change-password
│       │       ├── dashboard.py     # summary (with net), budget-vs-actual, portfolio, goals
│       │       ├── categories.py
│       │       ├── transactions.py  # CRUD + bulk import
│       │       ├── investments.py
│       │       ├── goals.py         # CRUD with investment linking
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
        ├── app.ts / app.html        # root: sidebar (hidden when unauthenticated), change-password modal
        ├── app.routes.ts            # routes with authGuard (/categories → /transactions, /goals → /investments)
        ├── app.config.ts            # provideHttpClient + APP_INITIALIZER (session restore)
        ├── core/
        │   ├── services/
        │   │   ├── auth.service.ts
        │   │   ├── api.service.ts
        │   │   ├── currency.service.ts  # user currency preference (localStorage)
        │   │   └── ...
        │   ├── pipes/
        │   │   └── currency-format.pipe.ts  # formats amounts with selected currency symbol
        │   ├── interceptors/
        │   │   └── auth.interceptor.ts  # Bearer token + silent 401 refresh
        │   └── guards/
        │       └── auth.guard.ts
        └── features/
            ├── login/
            ├── register/            # with password strength indicator
            ├── verify-email/
            ├── dashboard/           # includes floating AI chatbot widget (bottom-right)
            ├── transactions/        # transactions + categories merged into one page
            ├── categories/          # component kept; route redirects to /transactions
            ├── investments/         # goals (top) + investments (bottom) on one page
            ├── reports/             # multi-month charts + Sankey cashflow + AI insights
            └── chat/                # chat component (logic embedded in dashboard widget)
```

---

## Features

### Core
- **Multi-user** — each user has fully isolated data
- **Email verification** — new accounts require email confirmation before login
- **Secure auth** — 15-min access tokens + 30-day HttpOnly refresh tokens
- **Rate limiting** — 3 registrations/hour, 5 login attempts/minute
- **Nav hidden when logged out** — sidebar and hamburger menu are not shown on login/register pages

### Transactions & Categories (one page)
- **Transactions** — income, expense, savings with category assignment
- **Month navigation** — ← → buttons next to the action buttons; defaults to current month; silently refreshes without loading flash
- **Compact list** — shows last 5 transactions by default; "Show all N" toggle expands the full scrollable list
- **Bulk import** — import a full month via JSON array
- **AI category suggestion** — as you type a description, a rule-based suggestion appears instantly
- **Categories** — managed directly below transactions on the same page
  - Grouped by type: fixed, variable, learning, family
  - Each category has a name, planned amount, color, and icon
  - Scrollable list (max height, no page change needed)

### Dashboard
- **Monthly summary cards** — Income, Expenses, Available (income − expenses − savings), Savings Rate
- **Budget vs Actual** — sorted with most overbudget categories first; shows top 10 by default with "Show all" toggle
  - Green = under budget, grey = on budget, red = over budget
- **Portfolio overview** — total investment value with breakdown
- **Floating AI chatbot** — 💬 button fixed at bottom-right; expands into a full chat panel with hint suggestions, message history, and clear button

### Investments & Goals (one page)
- **Goals** — shown at the top; each goal can link to multiple investments
  - Linked investments are selected via toggle chips in the add/edit form
  - `current_amount` is automatically computed as the sum of linked investment values
  - Goal card shows each linked investment (type · name · value) as chips
  - Progress bar turns green with "Goal reached!" at 100%
  - Unlinked goals keep a manual `current_amount`
- **Investments** — shown below goals; track stocks, ETFs, crypto, cash, real estate
  - Updating or deleting an investment automatically refreshes goal progress

### Reports
- **Period selector** — last 3, 6, or 12 months (defaults to 3); silently refreshes without full page reload
- **Income vs Expenses** — grouped bar chart
- **Savings Rate** — line chart; hover tooltip shows percentage + euro amount (e.g. "22% (€500.00)")
- **Category Breakdown** — doughnut chart + table showing spend per category as amount and % of income
- **Cash Flow (Sankey)** — river-flow diagram: income → expense categories → savings
- **Month navigator** — independently navigate breakdown and cashflow charts (← month →)
- **AI Spending Insights** — on-demand analysis generated by Ollama (local phi3:mini)

### AI Features
- **Auto-categorization** — rule-based instant suggestion while typing a transaction description
- **Spending insights** — AI bullet points via Ollama (local, requires phi3:mini model)
- **AI Financial Advisor** — floating chatbot on the dashboard, powered by Groq (llama-3.3-70b)
  - Financial snapshot sent with every message:
    - Income, expenses, savings, available (net), savings rate
    - Top spending categories
    - Goals with progress
    - Investments
  - All amounts correctly separated: savings = savings transactions, available = income − expenses − savings

### UX
- **Currency selector** — choose €, FCFA, $, £, ₦, ¥ — persists in browser
- **Responsive** — works on mobile and desktop; chat input uses `dvh` for correct mobile viewport
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
ALLOWED_ORIGINS=https://budget.halyed.com,http://localhost

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
APP_URL=https://budget.halyed.com
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
| `GET` | `/dashboard/summary` | `month`, `year` | Income, expenses, saved, net (available), savings rate |
| `GET` | `/dashboard/budget-vs-actual` | `month`, `year` | Planned vs actual per category |
| `GET` | `/dashboard/portfolio` | — | Total portfolio + breakdown |
| `GET` | `/dashboard/goals` | — | Goals with progress |

> Savings rate = savings transactions ÷ income. `net` = income − expenses − savings.

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
| `GET` | `/goals` | List all (with linked investments) |
| `POST` | `/goals` | Create (accepts `investment_ids: []`) |
| `PATCH` | `/goals/{id}` | Update (accepts `investment_ids: []`) |
| `DELETE` | `/goals/{id}` | Delete |

`GoalRead` response includes:
- `linked_investments` — list of `{id, name, type, value}` objects
- `current_amount` — sum of linked investment values (or manual value if none linked)
- `progress_pct` — computed as `current_amount / target_amount * 100`

### Reports

| Method | Path | Params | Description |
|---|---|---|---|
| `GET` | `/reports/monthly-summary` | `months` (1-24, default 6) | Multi-month income/expense/savings/category trends |

Response includes:
- `labels` — month labels array
- `months` — per-month totals (income, expenses, savings, savings_rate, net)
- `category_trends` — per-category spend amounts across all months (only non-zero months)

### AI

| Method | Path | Description |
|---|---|---|
| `POST` | `/ai/suggest-category` | Suggests a category for a transaction description (rule-based) |
| `POST` | `/ai/insights` | Generates spending insights via Ollama |
| `POST` | `/ai/chat` | Multi-turn finance chat via Groq |

Chat snapshot includes: income, expenses, savings, available (net), savings rate, top categories, goals, investments.

> AI endpoints gracefully degrade: chat returns 503 if `GROQ_API_KEY` not set, insights return 503 if Ollama not running.

---

## Deployment

### Prerequisites

- VPS with Docker installed
- Domain pointing to VPS IP (`budget.halyed.com` → VPS IP via OVH DNS A record)
- Shared Caddy container on a `web` Docker network

### Caddy configuration (shared Caddyfile)

```
budget.halyed.com {
    handle /api/* {
        reverse_proxy budget-backend:8000
    }
    handle {
        reverse_proxy budget-frontend:80
    }
}
```

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

> Alembic migrations run automatically on startup via `entrypoint.sh`. New migrations are applied without manual intervention.

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
| `goal_investments` | Junction table — many-to-many between goals and investments |
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
- `005` — goal_investments junction table (many-to-many goals ↔ investments)

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
- Health check: `GET https://budget.halyed.com/health`

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `VPS_HOST` | VPS IP address |
| `VPS_USER` | SSH username |
| `VPS_SSH_KEY` | Private SSH key |
| `VPS_PATH` | Project path on VPS (e.g. `/home/user/apps/Budget`) |
