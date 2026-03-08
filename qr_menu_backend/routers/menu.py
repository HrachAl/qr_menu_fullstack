"""
Public API: get menu by language. Optional auth: filter products by viewer access level.
No caching: response is always fresh for current user/role.
"""
import sqlite3
from fastapi import APIRouter, Depends, Response
from db.database import get_db
from db import repositories
from auth.deps import get_current_user_optional

router = APIRouter(prefix="/api", tags=["menu"])


@router.get("/menu")
def get_menu(
    response: Response,
    language: str = "en",
    conn: sqlite3.Connection = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    viewer_level = user.get("access_level") if user else None
    return repositories.product_list_for_menu(
        conn, language=language, viewer_access_level=viewer_level
    )
