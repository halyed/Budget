from pydantic import BaseModel


class CloseMonthRequest(BaseModel):
    month: int
    year: int


class MonthStatusResponse(BaseModel):
    month: int
    year: int
    closed: bool
