from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.goal import SavingsGoal
from app.models.investment import Investment
from app.schemas.goal import GoalCreate, GoalUpdate, GoalRead

router = APIRouter()


def _investment_total(db: Session) -> float:
    return db.query(func.sum(Investment.value)).scalar() or 0.0


def _to_read(goal: SavingsGoal, total: float) -> GoalRead:
    return GoalRead(
        id=goal.id,
        name=goal.name,
        description=goal.description,
        target_amount=goal.target_amount,
        current_amount=total,
        target_date=goal.target_date,
    )


@router.get("", response_model=list[GoalRead])
def list_goals(db: Session = Depends(get_db)):
    total = _investment_total(db)
    goals = db.query(SavingsGoal).order_by(SavingsGoal.target_date).all()
    return [_to_read(g, total) for g in goals]


@router.get("/{goal_id}", response_model=GoalRead)
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.get(SavingsGoal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return _to_read(goal, _investment_total(db))


@router.post("", response_model=GoalRead, status_code=201)
def create_goal(payload: GoalCreate, db: Session = Depends(get_db)):
    goal = SavingsGoal(**payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=GoalRead)
def update_goal(goal_id: int, payload: GoalUpdate, db: Session = Depends(get_db)):
    goal = db.get(SavingsGoal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.get(SavingsGoal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()
