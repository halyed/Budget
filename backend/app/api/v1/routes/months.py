from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.month_lock import is_month_closed, is_month_in_past
from app.models.closed_month import ClosedMonth
from app.models.user import User
from app.schemas.closed_month import CloseMonthRequest, MonthStatusResponse

router = APIRouter()


@router.get("/status", response_model=MonthStatusResponse)
def get_month_status(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    closed = is_month_closed(db, current_user.id, year, month)
    return MonthStatusResponse(month=month, year=year, closed=closed)


@router.post("/close", response_model=MonthStatusResponse)
def close_month(
    body: CloseMonthRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_month_closed(db, current_user.id, body.year, body.month):
        db.add(ClosedMonth(user_id=current_user.id, year=body.year, month=body.month))
        db.commit()
    return MonthStatusResponse(month=body.month, year=body.year, closed=True)


@router.post("/reopen", response_model=MonthStatusResponse)
def reopen_month(
    body: CloseMonthRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if is_month_in_past(body.year, body.month):
        raise HTTPException(status_code=403, detail="Past months are permanently closed and cannot be reopened.")

    db.query(ClosedMonth).filter(
        ClosedMonth.user_id == current_user.id,
        ClosedMonth.year == body.year,
        ClosedMonth.month == body.month,
    ).delete()
    db.commit()
    return MonthStatusResponse(month=body.month, year=body.year, closed=False)
