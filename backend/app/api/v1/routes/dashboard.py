from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from datetime import date
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.investment import Investment
from app.models.goal import SavingsGoal
from app.models.user import User

router = APIRouter()


@router.get("/summary")
def get_monthly_summary(
    month: int = Query(default=date.today().month, ge=1, le=12),
    year: int = Query(default=date.today().year),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_q = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        extract("month", Transaction.date) == month,
        extract("year", Transaction.date) == year,
    )

    total_income = base_q.filter(Transaction.type == "income").with_entities(func.sum(Transaction.amount)).scalar() or 0.0
    total_expenses = base_q.filter(Transaction.type.in_(["expense", "savings"])).with_entities(func.sum(Transaction.amount)).scalar() or 0.0
    saved = total_income - total_expenses

    return {
        "month": month,
        "year": year,
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "saved": round(saved, 2),
        "savings_rate": round((saved / total_income * 100) if total_income > 0 else 0, 1),
    }


@router.get("/budget-vs-actual")
def get_budget_vs_actual(
    month: int = Query(default=date.today().month, ge=1, le=12),
    year: int = Query(default=date.today().year),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    categories = db.query(Category).filter(Category.user_id == current_user.id).all()
    result = []

    for cat in categories:
        actual = (
            db.query(func.sum(Transaction.amount))
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.category_id == cat.id,
                Transaction.type == "expense",
                extract("month", Transaction.date) == month,
                extract("year", Transaction.date) == year,
            )
            .scalar() or 0.0
        )
        result.append({
            "category_id": cat.id,
            "category_name": cat.name,
            "category_type": cat.type,
            "planned": cat.planned_amount,
            "actual": round(actual, 2),
            "difference": round(cat.planned_amount - actual, 2),
        })

    return result


@router.get("/portfolio")
def get_portfolio_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    investments = db.query(Investment).filter(Investment.user_id == current_user.id).all()
    total = sum(i.value for i in investments)
    breakdown = [{"id": i.id, "name": i.name, "type": i.type, "value": i.value} for i in investments]
    return {"total_portfolio": round(total, 2), "breakdown": breakdown}


@router.get("/goals")
def get_goals_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == current_user.id).all()
    return [
        {
            "id": g.id,
            "name": g.name,
            "target_amount": g.target_amount,
            "current_amount": g.current_amount,
            "progress_pct": round((g.current_amount / g.target_amount * 100) if g.target_amount > 0 else 0, 1),
            "target_date": g.target_date,
        }
        for g in goals
    ]
