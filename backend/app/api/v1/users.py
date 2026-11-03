from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import AdminUser, DbSession
from app.core.security import hash_password
from app.db.models import User
from app.schemas.auth import UserCreate, UserRead, UserUpdate
from app.services.common import commit, get_or_404, log_audit, model_to_dict

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(db: DbSession, _: AdminUser) -> list[User]:
    return list(db.scalars(select(User).order_by(User.email)).all())


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(db: DbSession, payload: UserCreate, actor: AdminUser) -> User:
    email = payload.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese correo")
    user = User(
        email=email,
        full_name=payload.full_name,
        role=payload.role,
        active=payload.active,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    log_audit(db, actor, "create", "user", user.id, after=model_to_dict(user))
    commit(db)
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(db: DbSession, user_id: int, payload: UserUpdate, actor: AdminUser) -> User:
    user = get_or_404(db, User, user_id, "Usuario")
    before = model_to_dict(user)
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"]:
        data["email"] = data["email"].lower().strip()
    if "password" in data:
        password = data.pop("password")
        if password:
            user.hashed_password = hash_password(password)
    for field, value in data.items():
        setattr(user, field, value)
    db.flush()
    log_audit(db, actor, "update", "user", user.id, before=before, after=model_to_dict(user))
    commit(db)
    db.refresh(user)
    return user


@router.delete("/{user_id}", response_model=UserRead)
def deactivate_user(db: DbSession, user_id: int, actor: AdminUser) -> User:
    user = get_or_404(db, User, user_id, "Usuario")
    if user.id == actor.id:
        raise HTTPException(status_code=400, detail="No puede desactivar su propio usuario")
    before = model_to_dict(user)
    user.active = False
    log_audit(db, actor, "deactivate", "user", user.id, before=before, after=model_to_dict(user))
    commit(db)
    db.refresh(user)
    return user
