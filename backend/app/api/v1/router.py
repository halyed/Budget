from fastapi import APIRouter, Depends
from app.api.v1.routes import categories, transactions, investments, goals, dashboard
from app.api.v1.routes import auth
from app.core.deps import get_current_user

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])

_protected = {"dependencies": [Depends(get_current_user)]}

api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"], **_protected)
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"], **_protected)
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"], **_protected)
api_router.include_router(investments.router, prefix="/investments", tags=["Investments"], **_protected)
api_router.include_router(goals.router, prefix="/goals", tags=["Goals"], **_protected)
