from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract
from datetime import date
from pydantic import BaseModel
from app.core.database import get_db
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.investment import Investment
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionRead

router = APIRouter()


# --- Bulk import schema ---

class BulkTransactionItem(BaseModel):
    description: Optional[str] = None
    amount: float
    category_name: Optional[str] = None
    type: str  # income | expense
    day: int   # day of month (1–31)


class BulkImportPayload(BaseModel):
    month: str          # "YYYY-MM"
    transactions: List[BulkTransactionItem]


class BulkImportResult(BaseModel):
    created: int
    skipped: int
    errors: List[str]


# --- CRUD ---

_SAVINGS_INVESTMENT_NAME = "Savings for Investments"

def _adjust_savings(db: Session, delta: float):
    """Add delta to the dedicated savings investment, creating it if needed."""
    inv = db.query(Investment).filter(Investment.name == _SAVINGS_INVESTMENT_NAME).first()
    if inv:
        inv.value = max(0.0, inv.value + delta)
    else:
        inv = Investment(name=_SAVINGS_INVESTMENT_NAME, type='cash', value=max(0.0, delta))
        db.add(inv)
    db.flush()

@router.post("/bulk", response_model=BulkImportResult, status_code=201)
def bulk_import(payload: BulkImportPayload, db: Session = Depends(get_db)):
    """
    Import a full month of transactions from a JSON template.
    Resolves category_name to category_id automatically.
    Skips duplicates (same date + description + amount already exist).
    """
    try:
        year_str, month_str = payload.month.split("-")
        year, month = int(year_str), int(month_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="month must be in YYYY-MM format")

    # Pre-load category map: name -> id
    categories = {c.name: c.id for c in db.query(Category).all()}

    created = 0
    skipped = 0
    errors = []

    for item in payload.transactions:
        try:
            import calendar
            max_day = calendar.monthrange(year, month)[1]
            day = min(item.day, max_day)
            tx_date = date(year, month, day)

            # Resolve category
            category_id = None
            if item.category_name:
                if item.category_name not in categories:
                    errors.append(f"Category '{item.category_name}' not found — skipped '{item.description}'")
                    skipped += 1
                    continue
                category_id = categories[item.category_name]

            # Skip duplicate (same date + description + amount)
            exists = db.query(Transaction).filter(
                Transaction.date == tx_date,
                Transaction.description == item.description,
                Transaction.amount == item.amount,
            ).first()
            if exists:
                skipped += 1
                continue

            db.add(Transaction(
                date=tx_date,
                amount=item.amount,
                description=item.description,
                type=item.type,
                category_id=category_id,
            ))
            created += 1

        except Exception as e:
            errors.append(f"Error on '{item.description}': {str(e)}")
            skipped += 1

    db.commit()
    return BulkImportResult(created=created, skipped=skipped, errors=errors)


@router.get("", response_model=List[TransactionRead])
def list_transactions(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Transaction).options(joinedload(Transaction.category))
    if month:
        q = q.filter(extract("month", Transaction.date) == month)
    if year:
        q = q.filter(extract("year", Transaction.date) == year)
    if type:
        q = q.filter(Transaction.type == type)
    if category_id:
        q = q.filter(Transaction.category_id == category_id)
    return q.order_by(Transaction.date.desc()).all()


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    t = db.query(Transaction).options(joinedload(Transaction.category)).filter(Transaction.id == transaction_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return t


@router.post("", response_model=TransactionRead, status_code=201)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
    transaction = Transaction(**payload.model_dump())
    db.add(transaction)
    if payload.type == 'savings':
        _adjust_savings(db, payload.amount)
    db.commit()
    db.refresh(transaction)
    return db.query(Transaction).options(joinedload(Transaction.category)).filter(Transaction.id == transaction.id).first()


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(transaction_id: int, payload: TransactionUpdate, db: Session = Depends(get_db)):
    t = db.get(Transaction, transaction_id)
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    old_type = t.type
    old_amount = t.amount
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(t, field, value)
    new_type = t.type
    new_amount = t.amount
    if old_type == 'savings' and new_type == 'savings':
        _adjust_savings(db, new_amount - old_amount)
    elif old_type == 'savings':
        _adjust_savings(db, -old_amount)
    elif new_type == 'savings':
        _adjust_savings(db, new_amount)
    db.commit()
    return db.query(Transaction).options(joinedload(Transaction.category)).filter(Transaction.id == transaction_id).first()


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    t = db.get(Transaction, transaction_id)
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if t.type == 'savings':
        _adjust_savings(db, -t.amount)
    db.delete(t)
    db.commit()
