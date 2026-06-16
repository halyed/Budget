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
    pass


class TransactionUpdate(BaseModel):
    date: datetime.date | None = None
    amount: DecimalAsFloat | None = None
    description: str | None = None
    type: str | None = None
    category_id: int | None = None


class TransactionRead(TransactionBase):
    id: int
    category: Optional[CategoryRead] = None

    model_config = {"from_attributes": True}
