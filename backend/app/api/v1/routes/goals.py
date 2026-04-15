from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.goal import SavingsGoal
from app.models.investment import Investment
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalUpdate, GoalRead, LinkedInvestment

router = APIRouter()


def _to_read(goal: SavingsGoal) -> GoalRead:
    linked = goal.investments or []
    current = sum(i.value for i in linked) if linked else goal.current_amount
    return GoalRead(
        id=goal.id,
        name=goal.name,
        description=goal.description,
        target_amount=goal.target_amount,
        current_amount=round(current, 2),
        target_date=goal.target_date,
        linked_investments=[
            LinkedInvestment(id=i.id, name=i.name, type=i.type, value=i.value)
            for i in linked
        ],
    )


def _sync_investments(db: Session, goal: SavingsGoal, user_id: int, investment_ids: list[int]) -> None:
    investments = (
        db.query(Investment)
        .filter(Investment.id.in_(investment_ids), Investment.user_id == user_id)
        .all()
        if investment_ids else []
    )
    goal.investments = investments


@router.get("", response_model=list[GoalRead])
def list_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goals = db.query(SavingsGoal).filter(
        SavingsGoal.user_id == current_user.id
    ).order_by(SavingsGoal.target_date).all()
    return [_to_read(g) for g in goals]


@router.get("/{goal_id}", response_model=GoalRead)
def get_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.user_id == current_user.id,
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return _to_read(goal)


@router.post("", response_model=GoalRead, status_code=201)
def create_goal(
    payload: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = SavingsGoal(
        name=payload.name,
        description=payload.description,
        target_amount=payload.target_amount,
        target_date=payload.target_date,
        user_id=current_user.id,
    )
    db.add(goal)
    db.flush()
    _sync_investments(db, goal, current_user.id, payload.investment_ids)
    db.commit()
    db.refresh(goal)
    return _to_read(goal)


@router.patch("/{goal_id}", response_model=GoalRead)
def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.user_id == current_user.id,
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    data = payload.model_dump(exclude_none=True)
    investment_ids = data.pop('investment_ids', None)

    for field, value in data.items():
        setattr(goal, field, value)

    if investment_ids is not None:
        _sync_investments(db, goal, current_user.id, investment_ids)

    db.commit()
    db.refresh(goal)
    return _to_read(goal)


@router.delete("/{goal_id}", status_code=204)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.user_id == current_user.id,
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()
