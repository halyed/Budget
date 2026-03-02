# Budget App — Documentation

Personal finance tracker built as a single-user web app, accessible from a phone browser. Tracks monthly income/expenses, investments, and savings goals.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Local Development](#local-development)
5. [Environment Variables](#environment-variables)
6. [Authentication](#authentication)
7. [API Reference](#api-reference)
8. [Deployment (OVH)](#deployment-ovh)
9. [Database](#database)
10. [Seeding Initial Data](#seeding-initial-data)

---

## Architecture

```
Phone Browser
    │
    │ HTTPS (443)
    ▼
  Caddy          ← automatic Let's Encrypt cert
    │
    │ HTTP (internal)
    ▼
  nginx          ← serves Angular SPA, proxies /api/* to backend
    │
    │ HTTP (internal)
    ▼
  FastAPI        ← REST API, JWT auth, SQLite via SQLAlchemy
    │
    ▼
  SQLite         ← persisted in a Docker named volume
```

All services run as Docker containers orchestrated by `docker-compose.yml`. Only Caddy is exposed to the internet (ports 80/443). The backend is never directly reachable from outside.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21, Tailwind CSS |
| Backend | FastAPI (Python 3.12), SQLAlchemy 2, Alembic |
| Database | SQLite |
| Auth | JWT (python-jose), bcrypt |
| Web server | nginx (SPA + reverse proxy) |
| TLS | Caddy (automatic Let's Encrypt) |
| Containerisation | Docker + Docker Compose |

---

## Project Structure

```
Budget/
├── Caddyfile                        # Caddy TLS config — set your domain here
├── docker-compose.yml
├── documentation.md
│
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh                # runs on container start: DB init → uvicorn
│   ├── requirements.txt
│   ├── .env                         # secrets — never committed
│   ├── .env.example                 # template
│   ├── alembic.ini
│   ├── alembic/env.py
│   └── app/
│       ├── main.py                  # FastAPI app, lifespan (create_all + seed admin)
│       ├── core/
│       │   ├── config.py            # Settings from .env
│       │   ├── database.py          # SQLAlchemy engine + session
│       │   ├── deps.py              # get_current_user dependency
│       │   └── security.py          # bcrypt helpers, JWT encode/decode
│       ├── models/
│       │   ├── user.py
│       │   ├── category.py
│       │   ├── transaction.py
│       │   ├── investment.py
│       │   └── goal.py
│       ├── schemas/
│       │   ├── auth.py
│       │   ├── category.py
│       │   ├── transaction.py
│       │   ├── investment.py
│       │   └── goal.py
│       ├── api/v1/
│       │   ├── router.py            # mounts all routers; protected routes use Depends(get_current_user)
│       │   └── routes/
│       │       ├── auth.py          # /login  /me  /change-password
│       │       ├── dashboard.py     # /summary  /budget-vs-actual  /portfolio  /goals
│       │       ├── categories.py
│       │       ├── transactions.py  # includes bulk import
│       │       ├── investments.py
│       │       └── goals.py
│       └── db/
│           └── seed.py              # one-time data seed script
│
└── frontend/
    ├── Dockerfile                   # node build → nginx serve (2-stage)
    ├── nginx.conf                   # SPA fallback + /api/ proxy
    └── src/app/
        ├── app.ts / app.html        # root component: sidebar, change-password modal
        ├── app.routes.ts            # routes with authGuard
        ├── app.config.ts            # provideHttpClient with authInterceptor
        ├── core/
        │   ├── services/
        │   │   ├── auth.service.ts  # login, logout, changePassword, isAuthenticated
        │   │   ├── api.service.ts   # base HTTP wrapper
        │   │   └── ...              # dashboard, category, transaction, investment, goal services
        │   ├── interceptors/
        │   │   └── auth.interceptor.ts  # attaches Bearer token; handles 401 → logout
        │   ├── guards/
        │   │   └── auth.guard.ts    # redirects to /login if unauthenticated
        │   └── models/              # TypeScript interfaces
        └── features/
            ├── login/
            ├── dashboard/
            ├── transactions/
            ├── investments/
            ├── goals/
            └── reports/
```

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

# Create .env (copy from .env.example and fill in values)
cp .env.example .env

uvicorn app.main:app --reload --port 8000
```

API available at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm start
```

App available at `http://localhost:4200`

> The dev environment (`environment.ts`) points to `http://localhost:8000/api/v1` directly — CORS is enabled on the backend for `localhost:4200`.

---

## Environment Variables

Create `backend/.env` (never commit this file):

```env
# Database
DATABASE_URL=sqlite:///./budget.db

# CORS — comma-separated list of allowed origins
ALLOWED_ORIGINS=http://localhost:4200

# JWT signing secret — generate with:
# python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=your-random-secret-here

# Admin credentials (used only on first boot to seed the users table)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=yourpassword
```

> After first boot, the password is stored as a bcrypt hash in the database. Changing `ADMIN_PASSWORD` in `.env` only takes effect if the user row is deleted from the DB.

---

## Authentication

### Flow

1. `POST /api/v1/auth/login` with `{username, password}` → returns a JWT
2. JWT is stored in `localStorage` on the frontend
3. The `authInterceptor` attaches `Authorization: Bearer <token>` to every outgoing request
4. The `authGuard` blocks navigation to protected routes if the token is missing or expired
5. On any `401` response, the interceptor calls `logout()` → redirects to `/login`

### Token

- Algorithm: `HS256`
- Expiry: **30 days** (convenient for a personal mobile app)
- Payload: `{ sub: username, exp: ... }`

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Returns JWT |
| `GET` | `/api/v1/auth/me` | Required | Returns `{ username }` |
| `POST` | `/api/v1/auth/change-password` | Required | Updates password in DB |

All other `/api/v1/*` endpoints require a valid JWT.

---

## API Reference

Base URL: `/api/v1`

All endpoints except `/auth/login` require `Authorization: Bearer <token>`.

### Dashboard

| Method | Path | Query params | Description |
|---|---|---|---|
| `GET` | `/dashboard/summary` | `month`, `year` | Income, expenses, saved, savings rate |
| `GET` | `/dashboard/budget-vs-actual` | `month`, `year` | Planned vs actual per category |
| `GET` | `/dashboard/portfolio` | — | Total portfolio value + breakdown |
| `GET` | `/dashboard/goals` | — | Goals with progress percentage |

### Categories

| Method | Path | Description |
|---|---|---|
| `GET` | `/categories/` | List all categories |
| `GET` | `/categories/{id}` | Get one |
| `POST` | `/categories/` | Create |
| `PATCH` | `/categories/{id}` | Update |
| `DELETE` | `/categories/{id}` | Delete |

Category types: `fixed`, `variable`, `learning`, `family`

### Transactions

| Method | Path | Description |
|---|---|---|
| `GET` | `/transactions/` | List (filterable by `month`, `year`, `type`, `category_id`) |
| `GET` | `/transactions/{id}` | Get one |
| `POST` | `/transactions/` | Create |
| `PATCH` | `/transactions/{id}` | Update |
| `DELETE` | `/transactions/{id}` | Delete |
| `POST` | `/transactions/bulk` | Import a full month from JSON |

Transaction types: `income`, `expense`, `savings`

> Transactions of type `savings` automatically adjust the *Savings for Investments* investment entry.

**Bulk import payload:**
```json
{
  "month": "2026-03",
  "transactions": [
    { "description": "Salary", "amount": 3000, "type": "income", "day": 1 },
    { "description": "Rent", "amount": 750, "category_name": "Rent", "type": "expense", "day": 5 }
  ]
}
```

### Investments

| Method | Path | Description |
|---|---|---|
| `GET` | `/investments/` | List all investments |
| `GET` | `/investments/{id}` | Get one |
| `POST` | `/investments/` | Create |
| `PATCH` | `/investments/{id}` | Update value |
| `DELETE` | `/investments/{id}` | Delete |

Investment types: `stocks`, `cash`, `crypto`

### Goals

| Method | Path | Description |
|---|---|---|
| `GET` | `/goals/` | List goals (`current_amount` = sum of all investments) |
| `GET` | `/goals/{id}` | Get one |
| `POST` | `/goals/` | Create |
| `PATCH` | `/goals/{id}` | Update |
| `DELETE` | `/goals/{id}` | Delete |

> `current_amount` on a goal always reflects the live total of all investment values — it is not stored separately.

---

## Deployment (OVH)

### Prerequisites

- OVH VPS with Ubuntu/Debian
- A domain name with an A record pointing to the VPS IP
- Docker installed on the VPS

### Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

### Clone and configure

```bash
git clone https://github.com/halyed/Budget.git
cd Budget

# Create the backend .env with production values
cat > backend/.env <<EOF
DATABASE_URL=sqlite:////app/data/budget.db
ALLOWED_ORIGINS=*
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password
EOF
```

### Set your domain

Edit `Caddyfile` and replace `your-domain.com` with your actual domain:

```
your-domain.com {
    reverse_proxy frontend:80
}
```

### Build and start

```bash
docker compose up -d --build
```

Caddy will automatically obtain a TLS certificate from Let's Encrypt on first start. The app will be live at `https://your-domain.com`.

### Useful commands

```bash
# View logs
docker compose logs -f

# Restart a single service
docker compose restart backend

# Rebuild after code changes
docker compose up -d --build

# Stop everything
docker compose down

# Stop and remove volumes (WARNING: deletes the database)
docker compose down -v
```

### Updating

```bash
git pull
docker compose up -d --build
```

### Resetting a forgotten password

```bash
# SSH into the server, then:
docker compose exec backend sh
sqlite3 /app/data/budget.db "DELETE FROM users WHERE username='admin';"
exit

# Edit backend/.env with the new password, then restart
docker compose restart backend
# The startup event will recreate the admin user with the new password
```

---

## Database

SQLite database stored at `/app/data/budget.db` inside the container, persisted in the `db_data` Docker named volume.

### Tables

| Table | Description |
|---|---|
| `users` | Single admin user (username + bcrypt password hash) |
| `categories` | Budget categories with planned amounts |
| `transactions` | Income, expense, and savings entries |
| `investments` | Investment positions (stocks, cash, crypto) |
| `savings_goals` | Long-term savings targets |

### Schema creation

Tables are created automatically on app startup via `Base.metadata.create_all()` in the FastAPI lifespan event. No manual migration step is needed.

---

## Seeding Initial Data

A seed script pre-populates categories, investments, and goals with default values. It is idempotent (skips tables that already have data).

```bash
# Local
cd backend
.venv/Scripts/python -m app.db.seed

# On the deployed container
docker compose exec backend python -m app.db.seed
```

A monthly bulk-import template is available at `backend/templates/monthly_expenses.json`. Use it to pre-fill a month of recurring transactions:

```bash
curl -X POST https://your-domain.com/api/v1/transactions/bulk \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @backend/templates/monthly_expenses.json
```
