import datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.category import CategoryRead
from app.schemas.types import DecimalAsFloat


class TransactionBase(BaseModel):
    date: datetime.date
    amount: DecimalAsFloat
    description: Optional[str] = None
    type: str  # income | expense
    category_id: Optional[int] = None


class TransactionCreate(TransactionBase):
    # Month this transaction counts toward. Optional — if omitted, defaults to
    # the calendar month of `date` (e.g. bulk import). The app normally sends
    # this explicitly, set to whichever month tab is open, so a transaction
    # dated today can still be booked to a different (open) budget month.
    budget_year: int | None = None
    budget_month: int | None = None


class TransactionUpdate(BaseModel):
    date: datetime.date | None = None
    amount: DecimalAsFloat | None = None
    description: str | None = None
    type: str | None = None
    category_id: int | None = None
    budget_year: int | None = None
    budget_month: int | None = None


class TransactionRead(TransactionBase):
    id: int
    budget_year: int
    budget_month: int
    category: Optional[CategoryRead] = None

    model_config = {"from_attributes": True}
