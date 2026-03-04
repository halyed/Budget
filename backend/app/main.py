from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.database import engine
    from app.core.security import hash_password
    from app.models import Base, User
    from sqlalchemy.orm import Session

    Base.metadata.create_all(bind=engine)

    with Session(engine) as db:
        if not db.query(User).filter(User.username == settings.admin_username).first():
            db.add(User(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
            ))
            db.commit()

    yield


app = FastAPI(
    title="Budget API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
