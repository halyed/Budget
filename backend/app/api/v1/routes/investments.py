from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.investment import Investment
from app.schemas.investment import InvestmentCreate, InvestmentUpdate, InvestmentRead

router = APIRouter()


@router.get("", response_model=list[InvestmentRead])
def list_investments(db: Session = Depends(get_db)):
    return db.query(Investment).order_by(Investment.type).all()


@router.get("/{investment_id}", response_model=InvestmentRead)
def get_investment(investment_id: int, db: Session = Depends(get_db)):
    inv = db.get(Investment, investment_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    return inv


@router.post("", response_model=InvestmentRead, status_code=201)
def create_investment(payload: InvestmentCreate, db: Session = Depends(get_db)):
    inv = Investment(**payload.model_dump())
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


@router.patch("/{investment_id}", response_model=InvestmentRead)
def update_investment(investment_id: int, payload: InvestmentUpdate, db: Session = Depends(get_db)):
    inv = db.get(Investment, investment_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(inv, field, value)
    db.commit()
    db.refresh(inv)
    return inv


@router.delete("/{investment_id}", status_code=204)
def delete_investment(investment_id: int, db: Session = Depends(get_db)):
    inv = db.get(Investment, investment_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    db.delete(inv)
    db.commit()
