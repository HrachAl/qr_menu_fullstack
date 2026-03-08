"""
Public API: get menu by language.
"""
import sqlite3
from fastapi import APIRouter, Depends
from db.database import get_db
from db import repositories

router = APIRouter(prefix="/api", tags=["menu"])


@router.get("/menu")
def get_menu(language: str = "en", conn: sqlite3.Connection = Depends(get_db)):
    return repositories.product_list_for_menu(conn, language=language)
