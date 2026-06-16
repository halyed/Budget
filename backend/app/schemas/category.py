from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from app.schemas.types import DecimalAsFloat


class CategoryBase(BaseModel):
    name: str
    type: str
    planned_amount: DecimalAsFloat = Decimal("0.00")
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    planned_amount: Optional[DecimalAsFloat] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryRead(CategoryBase):
    id: int

    model_config = {"from_attributes": True}
