import logging
from datetime import date
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from sqlalchemy import extract, func

from groq import Groq

from app.core.config import settings
from app.models.transaction import Transaction
from app.models.goal import SavingsGoal
from app.models.category import Category
from app.models.user import User
from app.models.investment import Investment

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are a helpful personal finance assistant. \
You have access to the user's financial data provided below. \
Answer questions concisely and practically. \
If the data doesn't contain enough information to answer, say so honestly. \
Never make up numbers that aren't in the provided data."""


def _build_snapshot(db: Session, user: User) -> str:
    today = date.today()
    month, year = today.month, today.year

    # ── Current month summary ─────────────────────────────────────────────────
    base = db.query(Transaction).filter(
        Transaction.user_id == user.id,
        extract("year", Transaction.date) == year,
        extract("month", Transaction.date) == month,
    )
    income = base.filter(Transaction.type == "income").with_entities(func.sum(Transaction.amount)).scalar() or 0.0
    expenses = base.filter(Transaction.type.in_(["expense", "savings"])).with_entities(func.sum(Transaction.amount)).scalar() or 0.0
    saved = income - expenses

    lines = [
        f"=== Financial Snapshot ({today.strftime('%B %Y')}) ===",
        f"Income this month: {income:.2f}",
        f"Expenses this month: {expenses:.2f}",
        f"Saved this month: {saved:.2f}",
        f"Savings rate: {round(saved / income * 100, 1) if income > 0 else 0}%",
    ]

    # ── Budget vs actual (all categories) ────────────────────────────────────
    categories = db.query(Category).filter(Category.user_id == user.id).all()
    if categories:
        lines.append("\nBudget vs Actual this month:")
        for cat in categories:
            actual = (
                db.query(func.sum(Transaction.amount))
                .filter(
                    Transaction.user_id == user.id,
                    Transaction.category_id == cat.id,
                    Transaction.type == "expense",
                    extract("year", Transaction.date) == year,
                    extract("month", Transaction.date) == month,
                )
                .scalar() or 0.0
            )
            diff = cat.planned_amount - actual
            status = "under" if diff >= 0 else "OVER"
            lines.append(f"  - {cat.name} ({cat.type}): planned {cat.planned_amount:.2f} / actual {actual:.2f} [{status} by {abs(diff):.2f}]")

    # ── Recent transactions (last 30) ─────────────────────────────────────────
    recent_txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.date.desc())
        .limit(30)
        .all()
    )
    if recent_txs:
        lines.append("\nRecent transactions (last 30):")
        for t in recent_txs:
            cat_name = next((c.name for c in categories if c.id == t.category_id), "uncategorized")
            lines.append(f"  - {t.date} | {t.description} | {t.type} | {t.amount:.2f} | {cat_name}")

    # ── Last 3 months summary ─────────────────────────────────────────────────
    lines.append("\nLast 3 months summary:")
    for i in range(1, 4):
        past = today - relativedelta(months=i)
        p_income = db.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user.id,
            Transaction.type == "income",
            extract("year", Transaction.date) == past.year,
            extract("month", Transaction.date) == past.month,
        ).scalar() or 0.0
        p_expenses = db.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user.id,
            Transaction.type.in_(["expense", "savings"]),
            extract("year", Transaction.date) == past.year,
            extract("month", Transaction.date) == past.month,
        ).scalar() or 0.0
        lines.append(f"  - {past.strftime('%B %Y')}: income {p_income:.2f} / expenses {p_expenses:.2f} / saved {p_income - p_expenses:.2f}")

    # ── Goals ─────────────────────────────────────────────────────────────────
    goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == user.id).all()
    if goals:
        lines.append("\nSavings goals:")
        for g in goals:
            pct = round(g.current_amount / g.target_amount * 100, 1) if g.target_amount > 0 else 0
            deadline = f" (target: {g.target_date})" if g.target_date else ""
            lines.append(f"  - {g.name}: {g.current_amount:.2f} / {g.target_amount:.2f} ({pct}%){deadline}")

    # ── Investments ───────────────────────────────────────────────────────────
    investments = db.query(Investment).filter(Investment.user_id == user.id).all()
    if investments:
        total_invested = sum(i.value for i in investments)
        lines.append(f"\nInvestments (total: {total_invested:.2f}):")
        for i in investments:
            lines.append(f"  - {i.name} ({i.type}): {i.value:.2f}")

    return "\n".join(lines)


def chat(question: str, history: list[dict], db: Session, user: User) -> str:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    client = Groq(api_key=settings.groq_api_key)

    system_content = f"{SYSTEM_PROMPT}\n\n{_build_snapshot(db, user)}"

    messages = [{"role": "system", "content": system_content}]

    for msg in history:
        role = "user" if msg.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("content", "")})

    messages.append({"role": "user", "content": question})

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=512,
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        logger.error("Groq error: %s", e)
        raise RuntimeError(f"Chat service error: {str(e)}")
