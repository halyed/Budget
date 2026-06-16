from datetime import date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import String, Numeric, Date, Text, ForeignKey, Table, Column, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


# Junction table
goal_investments = Table(
    'goal_investments',
    Base.metadata,
    Column('goal_id', Integer, ForeignKey('savings_goals.id', ondelete='CASCADE'), primary_key=True),
    Column('investment_id', Integer, ForeignKey('investments.id', ondelete='CASCADE'), primary_key=True),
)


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    target_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    investments: Mapped[List["Investment"]] = relationship(  # type: ignore[name-defined]
        "Investment", secondary=goal_investments, lazy="joined"
    )
