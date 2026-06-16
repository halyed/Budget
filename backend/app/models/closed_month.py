from datetime import datetime
from sqlalchemy import Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class ClosedMonth(Base):
    __tablename__ = "closed_months"
    __table_args__ = (UniqueConstraint("user_id", "year", "month", name="uq_closed_month_user_year_month"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    closed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
