from fastapi import APIRouter, HTTPException, Depends, Header
from models import UserRegister, UserLogin, Token, User
from utils import read_json, write_json, hash_password, verify_password, create_access_token, decode_token, get_next_id
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/api/auth", tags=["auth"])

def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        return None
    users = read_json("users.json")
    user = next((u for u in users if u["id"] == payload.get("user_id")), None)
    return user

def require_auth(authorization: Optional[str] = Header(None)) -> dict:
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = require_auth(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@router.post("/register", response_model=Token)
async def register(user_data: UserRegister):
    users = read_json("users.json")
    
    if any(u["username"] == user_data.username for u in users):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    new_user = {
        "id": get_next_id(users),
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "role": "user",
        "created_at": datetime.now().isoformat()
    }
    
    users.append(new_user)
    write_json("users.json", users)
    
    access_token = create_access_token({"user_id": new_user["id"], "username": new_user["username"]})
    return Token(access_token=access_token)

@router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    users = read_json("users.json")
    
    user = next((u for u in users if u["username"] == user_data.username), None)
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token({"user_id": user["id"], "username": user["username"], "role": user.get("role", "user")})
    return Token(access_token=access_token)

@router.get("/me")
async def get_me(user: dict = Depends(require_auth)):
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user.get("role", "user"),
        "created_at": user["created_at"]
    }
