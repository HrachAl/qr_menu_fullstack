"""
Auth routes: login, register.
"""
import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status
from db.database import get_db
from db import repositories
from auth.service import verify_password, hash_password, create_access_token
from models import LoginRequest, UserCreate, Token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(data: LoginRequest, conn: sqlite3.Connection = Depends(get_db)):
    user = repositories.user_get_by_email(conn, data.email)
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(data={"sub": str(user["id"])})
    return Token(access_token=token, token_type="bearer")


@router.post("/register", response_model=Token)
def register(data: UserCreate, conn: sqlite3.Connection = Depends(get_db)):
    if not data.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email required for registration")
    if repositories.user_get_by_email(conn, data.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    allowed = ("user", "vip_user")
    if data.access_level not in allowed:
        data.access_level = "user"
    user_id = repositories.user_create(
        conn, fullname=data.fullname, password=hash_password(data.password),
        access_level=data.access_level, email=data.email,
    )
    token = create_access_token(data={"sub": str(user_id)})
    return Token(access_token=token, token_type="bearer")
