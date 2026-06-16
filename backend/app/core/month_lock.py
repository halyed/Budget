from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.closed_month import ClosedMonth


def is_month_in_past(year: int, month: int) -> bool:
    today = date.today()
    return (year, month) < (today.year, today.month)


def is_month_closed(db: Session, user_id: int, year: int, month: int) -> bool:
    if is_month_in_past(year, month):
        return True
    return db.query(ClosedMonth).filter(
        ClosedMonth.user_id == user_id,
        ClosedMonth.year == year,
        ClosedMonth.month == month,
    ).first() is not None


def assert_month_open(db: Session, user_id: int, year: int, month: int) -> None:
    if is_month_closed(db, user_id, year, month):
        raise HTTPException(status_code=403, detail="This month is closed. Reopen it to make changes.")
