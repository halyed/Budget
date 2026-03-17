import logging
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import extract, func

import google.generativeai as genai

from app.core.config import settings
from app.models.transaction import Transaction
from app.models.goal import SavingsGoal
from app.models.category import Category
from app.models.user import User

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a helpful personal finance assistant. \
You have access to the user's financial data provided below. \
Answer questions concisely and practically. \
If the data doesn't contain enough information to answer, say so honestly. \
Never make up numbers that aren't in the provided data."""


def _build_snapshot(db: Session, user: User) -> str:
    today = date.today()
    month, year = today.month, today.year

    # Current month totals
    base = db.query(Transaction).filter(
        Transaction.user_id == user.id,
        extract("year", Transaction.date) == year,
        extract("month", Transaction.date) == month,
    )
    income = base.filter(Transaction.type == "income").with_entities(func.sum(Transaction.amount)).scalar() or 0.0
    expenses = base.filter(Transaction.type.in_(["expense", "savings"])).with_entities(func.sum(Transaction.amount)).scalar() or 0.0
    saved = income - expenses

    # Active goals
    goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == user.id).all()

    # Top categories this month
    categories = db.query(Category).filter(Category.user_id == user.id).all()
    cat_spending = []
    for cat in categories:
        total = (
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
        if total > 0:
            cat_spending.append((cat.name, total))
    cat_spending.sort(key=lambda x: x[1], reverse=True)

    lines = [
        f"=== Financial Snapshot ({today.strftime('%B %Y')}) ===",
        f"Income this month: {income:.2f}€",
        f"Expenses this month: {expenses:.2f}€",
        f"Saved this month: {saved:.2f}€",
        f"Savings rate: {round(saved / income * 100, 1) if income > 0 else 0}%",
    ]

    if cat_spending:
        lines.append("\nTop spending categories:")
        for name, amount in cat_spending[:6]:
            lines.append(f"  - {name}: {amount:.2f}€")

    if goals:
        lines.append("\nSavings goals:")
        for g in goals:
            pct = round(g.current_amount / g.target_amount * 100, 1) if g.target_amount > 0 else 0
            lines.append(f"  - {g.name}: {g.current_amount:.2f}€ / {g.target_amount:.2f}€ ({pct}%)")

    return "\n".join(lines)


def chat(question: str, history: list[dict], db: Session, user: User) -> str:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=f"{SYSTEM_PROMPT}\n\n{_build_snapshot(db, user)}",
    )

    # Build conversation history for Gemini
    gemini_history = []
    for msg in history:
        role = "user" if msg.get("role") == "user" else "model"
        gemini_history.append({"role": role, "parts": [msg.get("content", "")]})

    chat_session = model.start_chat(history=gemini_history)

    try:
        response = chat_session.send_message(question)
        return response.text.strip()
    except Exception as e:
        logger.error("Gemini error: %s", e)
        raise RuntimeError(f"Chat service error: {str(e)}")
