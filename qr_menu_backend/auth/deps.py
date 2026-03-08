"""
FastAPI dependencies: get_current_user, require_admin, require_superadmin.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyCookie
from db.database import get_db
from db import repositories
from auth.service import decode_access_token

security = HTTPBearer(auto_error=False)


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    conn=Depends(get_db),
):
    """Return user dict if valid token, else None. Use for optional auth (e.g. orders)."""
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        return None
    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        return None
    user = repositories.user_get_by_id(conn, user_id)
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    conn=Depends(get_db),
):
    """Return user dict or raise 401."""
    user = get_current_user_optional(credentials, conn)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(user=Depends(get_current_user)):
    """Require access_level in ('admin', 'superadmin')."""
    if user.get("access_level") not in ("admin", "superadmin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def require_superadmin(user=Depends(get_current_user)):
    """Require access_level == 'superadmin'."""
    if user.get("access_level") != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin access required")
    return user
