from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class InvestmentBase(BaseModel):
    name: str
    type: str  # etf, crypto, cash, stocks
    value: Decimal


class InvestmentCreate(InvestmentBase):
    pass


class InvestmentUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    value: Optional[Decimal] = None


class InvestmentRead(InvestmentBase):
    id: int
    updated_at: datetime

    model_config = {"from_attributes": True}
