from datetime import date
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Numeric, Date, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    # The month this transaction counts toward for budgeting purposes (dashboard,
    # reports, month lock, ...). Independent of `date`: e.g. a salary that
    # actually arrives Aug 27 can still be booked against September.
    budget_year: Mapped[int] = mapped_column(Integer, nullable=False)
    budget_month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    category: Mapped[Optional["Category"]] = relationship(back_populates="transactions")
