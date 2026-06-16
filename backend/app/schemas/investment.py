from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.types import DecimalAsFloat


class InvestmentBase(BaseModel):
    name: str
    type: str  # etf, crypto, cash, stocks
    value: DecimalAsFloat


class InvestmentCreate(InvestmentBase):
    pass


class InvestmentUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    value: Optional[DecimalAsFloat] = None


class InvestmentRead(InvestmentBase):
    id: int
    updated_at: datetime

    model_config = {"from_attributes": True}
