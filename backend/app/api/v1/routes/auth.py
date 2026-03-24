import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email_service import send_verification_email
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.verification_token import VerificationToken
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResendVerificationRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)

router = APIRouter()

_COOKIE = "refresh_token"
_COOKIE_PATH = "/api/v1/auth"
_VERIFY_TOKEN_EXPIRE_HOURS = 24


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key=_COOKIE,
        value=raw_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path=_COOKIE_PATH,
    )


def _store_refresh_token(user_id: int, db: Session) -> str:
    raw, token_hash = create_refresh_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at))
    db.commit()
    return raw


def _create_and_send_verification(user: User, db: Session) -> None:
    """Generate a verification token, store it, and send the email."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=_VERIFY_TOKEN_EXPIRE_HOURS)

    # Invalidate any previous unused tokens for this user
    db.query(VerificationToken).filter(
        VerificationToken.user_id == user.id,
        VerificationToken.used == False,
    ).update({"used": True})

    db.add(VerificationToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at))
    db.commit()

    send_verification_email(user.email, raw_token)


@router.post("/register", response_model=MessageResponse, status_code=201)
@limiter.limit("3/hour")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)) -> MessageResponse:
    if not settings.registration_enabled:
        raise HTTPException(status_code=403, detail="Registration is disabled")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    is_active = settings.debug  # auto-activate in debug mode, require email verify in production
    user = User(
        username=body.email,
        email=body.email,
        password_hash=hash_password(body.password),
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    from app.db.seed import seed
    seed(user.id)

    if settings.debug:
        return MessageResponse(message="Account created. You can sign in immediately (debug mode).")

    _create_and_send_verification(user, db)

    return MessageResponse(message="Account created. Please check your inbox to verify your email.")


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(body: VerifyEmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()

    record = db.query(VerificationToken).filter(
        VerificationToken.token_hash == token_hash,
        VerificationToken.used == False,
        VerificationToken.expires_at > datetime.now(timezone.utc),
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")

    user = db.get(User, record.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = True
    record.used = True
    db.commit()

    return MessageResponse(message="Email verified successfully. You can now sign in.")


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("3/hour")
def resend_verification(
    request: Request,
    body: ResendVerificationRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    user = db.query(User).filter(User.email == body.email).first()

    # Always return the same message to avoid leaking whether an email exists
    if not user or user.is_active:
        return MessageResponse(message="If that email is registered and unverified, a new link has been sent.")

    _create_and_send_verification(user, db)
    return MessageResponse(message="If that email is registered and unverified, a new link has been sent.")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Please verify your email address before signing in.")

    from app.db.seed import seed
    seed(user.id)

    raw_refresh = _store_refresh_token(user.id, db)
    _set_refresh_cookie(response, raw_refresh)

    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
) -> TokenResponse:
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == hash_refresh_token(refresh_token),
        RefreshToken.revoked == False,
        RefreshToken.expires_at > datetime.now(timezone.utc),
    ).first()

    if not record:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = db.get(User, record.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    record.revoked = True
    raw_refresh = _store_refresh_token(user.id, db)
    _set_refresh_cookie(response, raw_refresh)

    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
) -> dict:
    if refresh_token:
        record = db.query(RefreshToken).filter(
            RefreshToken.token_hash == hash_refresh_token(refresh_token)
        ).first()
        if record:
            record.revoked = True
            db.commit()
    response.delete_cookie(key=_COOKIE, path=_COOKIE_PATH)
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(id=current_user.id, email=current_user.email, username=current_user.username)


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"detail": "Password updated"}
