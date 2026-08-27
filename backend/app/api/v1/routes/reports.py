from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from decimal import Decimal
from dateutil.relativedelta import relativedelta

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.user import User

router = APIRouter()


@router.get("/monthly-summary")
def get_monthly_summary(
    months: int = Query(default=6, ge=1, le=24),
    # Last period of the trailing window. Defaults to the calendar's current
    # month, but callers pass the user's actual active budget month here (it
    # may already be ahead of the calendar, e.g. a month closed early) so the
    # report includes it instead of stopping at a now-finalized month.
    anchor_year: int = Query(default_factory=lambda: date.today().year),
    anchor_month: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    anchor = date(anchor_year, anchor_month, 1)
    # Build list of (year, month) for the last N months, oldest first
    periods = []
    for i in range(months - 1, -1, -1):
        d = anchor - relativedelta(months=i)
        periods.append((d.year, d.month))

    # --- Monthly totals ---
    monthly_data = []
    for year, month in periods:
        base_q = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.budget_year == year,
            Transaction.budget_month == month,
        )
        income = (
            base_q.filter(Transaction.type == "income")
            .with_entities(func.sum(Transaction.amount))
            .scalar() or Decimal("0.00")
        )
        expenses = (
            base_q.filter(Transaction.type == "expense")
            .with_entities(func.sum(Transaction.amount))
            .scalar() or Decimal("0.00")
        )
        savings = (
            base_q.filter(Transaction.type == "savings")
            .with_entities(func.sum(Transaction.amount))
            .scalar() or Decimal("0.00")
        )
        savings_rate = round((savings / income * 100) if income > 0 else 0.0, 1)
        monthly_data.append({
            "label": date(year, month, 1).strftime("%b %Y"),
            "month": month,
            "year": year,
            "income": round(income, 2),
            "expenses": round(expenses, 2),
            "savings": round(savings, 2),
            "savings_rate": savings_rate,
            "net": round(income - expenses - savings, 2),
        })

    # --- Category trends (all categories, filtered to expense transactions) ---
    categories = (
        db.query(Category)
        .filter(Category.user_id == current_user.id)
        .order_by(Category.name)
        .all()
    )

    category_trends = []
    for cat in categories:
        amounts = []
        for year, month in periods:
            total = (
                db.query(func.sum(Transaction.amount))
                .filter(
                    Transaction.user_id == current_user.id,
                    Transaction.category_id == cat.id,
                    Transaction.type == "expense",
                    Transaction.budget_year == year,
                    Transaction.budget_month == month,
                )
                .scalar() or Decimal("0.00")
            )
            amounts.append(round(total, 2))
        # Only include categories that have at least one non-zero month
        if any(a > 0 for a in amounts):
            category_trends.append({
                "category_id": cat.id,
                "category_name": cat.name,
                "amounts": amounts,
            })

    return {
        "labels": [p["label"] for p in monthly_data],
        "months": monthly_data,
        "category_trends": category_trends,
    }
