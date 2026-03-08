"""
Admin API: users (superadmin), products, orders, statistics.
"""
import json
import sqlite3
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from db.database import get_db
from db import repositories
from auth.deps import require_admin, require_superadmin, get_current_user
from auth.service import hash_password
from models import UserCreate, UserUpdate, UserResponse, ProductCreate, ProductUpdate, ProductResponse, OrderResponse, OrderStatusUpdate
from config import UPLOAD_DIR
from services import stats_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _user_to_response(u: dict) -> dict:
    return {k: v for k, v in u.items() if k != "password"}


# ---------- Users (superadmin only) ----------
@router.get("/users", response_model=list[UserResponse])
def admin_list_users(conn: sqlite3.Connection = Depends(get_db), user=Depends(require_superadmin)):
    users = repositories.user_list(conn)
    return [_user_to_response(u) for u in users]


@router.post("/users", response_model=UserResponse)
def admin_create_user(data: UserCreate, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_superadmin)):
    if data.email and repositories.user_get_by_email(conn, data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = repositories.user_create(
        conn, fullname=data.fullname, password=hash_password(data.password),
        access_level=data.access_level or "user", email=data.email,
    )
    u = repositories.user_get_by_id(conn, user_id)
    return _user_to_response(u)


@router.get("/users/{user_id}", response_model=UserResponse)
def admin_get_user(user_id: int, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_superadmin)):
    u = repositories.user_get_by_id(conn, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_response(u)


@router.patch("/users/{user_id}", response_model=UserResponse)
def admin_update_user(user_id: int, data: UserUpdate, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_superadmin)):
    u = repositories.user_get_by_id(conn, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    kwargs = data.model_dump(exclude_unset=True)
    if "password" in kwargs and kwargs["password"]:
        kwargs["password"] = hash_password(kwargs["password"])
    repositories.user_update(conn, user_id, **kwargs)
    return _user_to_response(repositories.user_get_by_id(conn, user_id))


@router.delete("/users/{user_id}", status_code=204)
def admin_delete_user(user_id: int, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_superadmin)):
    if user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    u = repositories.user_get_by_id(conn, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    repositories.user_delete(conn, user_id)


# ---------- Products (admin or superadmin) ----------
@router.get("/products", response_model=list[ProductResponse])
def admin_list_products(conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    return repositories.product_list(conn)


@router.post("/products", response_model=ProductResponse)
def admin_create_product(data: ProductCreate, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    pid = repositories.product_create(
        conn, price=data.price, img_path=data.img_path, type_=data.type, type_name=data.type_name,
        availability=data.availability, access_level=data.access_level,
        name_en=data.name_en, name_am=data.name_am, name_ru=data.name_ru,
        description_en=data.description_en, description_am=data.description_am, description_ru=data.description_ru,
        short_description_en=data.short_description_en, short_description_am=data.short_description_am, short_description_ru=data.short_description_ru,
        composition=data.composition,
    )
    return repositories.product_get_by_id(conn, pid)


@router.get("/products/{product_id}", response_model=ProductResponse)
def admin_get_product(product_id: int, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    p = repositories.product_get_by_id(conn, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


@router.patch("/products/{product_id}", response_model=ProductResponse)
def admin_update_product(product_id: int, data: ProductUpdate, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    p = repositories.product_get_by_id(conn, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    kwargs = data.model_dump(exclude_unset=True)
    repositories.product_update(conn, product_id, **kwargs)
    return repositories.product_get_by_id(conn, product_id)


@router.delete("/products/{product_id}", status_code=204)
def admin_delete_product(product_id: int, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    p = repositories.product_get_by_id(conn, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    repositories.product_delete(conn, product_id)


# ---------- Image upload ----------
@router.post("/products/upload-image")
def admin_upload_image(file: UploadFile = File(...), user=Depends(require_admin)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".png"
    name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, name)
    with open(path, "wb") as f:
        f.write(file.file.read())
    rel = os.path.join("new_menu", name).replace("\\", "/")
    return {"img_path": rel, "filename": name}


# ---------- Orders ----------
@router.get("/orders", response_model=list[OrderResponse])
def admin_list_orders(
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
    conn: sqlite3.Connection = Depends(get_db),
    user=Depends(require_admin),
):
    return repositories.order_list(conn, status=status, limit=limit, offset=offset)


@router.get("/orders/{order_id}")
def admin_get_order(order_id: int, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    o = repositories.order_get_by_id(conn, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    items = repositories.order_items_by_order_id(conn, order_id)
    return {"order": o, "items": items}


@router.patch("/orders/{order_id}/status")
def admin_update_order_status(order_id: int, data: OrderStatusUpdate, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    if data.status not in ("created", "confirmed", "completed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    o = repositories.order_get_by_id(conn, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    repositories.order_update_status(conn, order_id, data.status)
    return {"id": order_id, "status": data.status}


# ---------- Statistics ----------
@router.get("/stats/top-products")
def admin_stats_top_products(limit: int = 5, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    return stats_service.top_products(conn, limit=limit)


@router.get("/stats/top-users-by-count")
def admin_stats_top_users_count(limit: int = 5, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    return stats_service.top_users_by_order_count(conn, limit=limit)


@router.get("/stats/top-users-by-price")
def admin_stats_top_users_price(limit: int = 5, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    return stats_service.top_users_by_order_price(conn, limit=limit)


@router.get("/stats/hourly")
def admin_stats_hourly(date_from: str | None = None, date_to: str | None = None, conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    return stats_service.hourly_orders(conn, date_from=date_from, date_to=date_to)


@router.get("/stats/dashboard")
def admin_stats_dashboard(conn: sqlite3.Connection = Depends(get_db), user=Depends(require_admin)):
    users_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    products_count = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    orders_count = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    orders_today = conn.execute("SELECT COUNT(*) FROM orders WHERE date(created_at) = date('now')").fetchone()[0]
    return {
        "users_count": users_count,
        "products_count": products_count,
        "orders_count": orders_count,
        "orders_today": orders_today,
        "top_products": stats_service.top_products(conn, 5),
        "top_users_count": stats_service.top_users_by_order_count(conn, 5),
        "top_users_price": stats_service.top_users_by_order_price(conn, 5),
        "hourly": stats_service.hourly_orders(conn),
    }
