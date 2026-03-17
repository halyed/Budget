from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.category import Category
from app.ai.categorizer import suggest_category
from app.ai import insights as insights_service
from app.ai import chat as chat_service

router = APIRouter()


# ── Feature A: Auto-categorization ──────────────────────────────────────────

class SuggestRequest(BaseModel):
    description: str


class SuggestResponse(BaseModel):
    category: str | None


@router.post("/suggest-category", response_model=SuggestResponse)
def suggest_category_endpoint(
    body: SuggestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_categories = [c.name for c in db.query(Category).filter(Category.user_id == current_user.id).all()]
    result = suggest_category(body.description, user_categories)
    return SuggestResponse(category=result)


# ── Feature B: Spending Insights ─────────────────────────────────────────────

class InsightsRequest(BaseModel):
    months: int = 6


class InsightsResponse(BaseModel):
    insights: str


@router.post("/insights", response_model=InsightsResponse)
def get_insights(
    body: InsightsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Reuse report data logic
    from app.api.v1.routes.reports import get_monthly_summary
    from fastapi import Query

    report_data = get_monthly_summary(
        months=max(1, min(body.months, 24)),
        db=db,
        current_user=current_user,
    )
    try:
        text = insights_service.get_insights(report_data)
        return InsightsResponse(insights=text)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ── Feature C: Chat Assistant ─────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    answer: str


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        answer = chat_service.chat(
            question=body.question,
            history=[m.model_dump() for m in body.history],
            db=db,
            user=current_user,
        )
        return ChatResponse(answer=answer)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
