from datetime import date
from typing import Optional, List
from pydantic import BaseModel, computed_field


class LinkedInvestment(BaseModel):
    id: int
    name: str
    type: str
    value: float

    model_config = {"from_attributes": True}


class GoalBase(BaseModel):
    name: str
    description: Optional[str] = None
    target_amount: float
    current_amount: float = 0.0
    target_date: Optional[date] = None


class GoalCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_amount: float
    target_date: Optional[date] = None
    investment_ids: List[int] = []


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    target_date: Optional[date] = None
    investment_ids: Optional[List[int]] = None


class GoalRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    target_amount: float
    current_amount: float
    target_date: Optional[date] = None
    linked_investments: List[LinkedInvestment] = []

    @computed_field
    @property
    def progress_pct(self) -> float:
        if self.target_amount == 0:
            return 0.0
        return round((self.current_amount / self.target_amount) * 100, 1)

    model_config = {"from_attributes": True}
