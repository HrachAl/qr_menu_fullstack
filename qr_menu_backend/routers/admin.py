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


def _to_int(value, default: int | None = None) -> int | None:
    if value is None:
        return default
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    s = str(value).strip()
    if not s:
        return default
    try:
        return int(float(s))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid integer value: {value}") from exc


def _normalize_img_path(path: str | None) -> str:
    raw = (path or "").strip().replace("\\", "/")
    if not raw:
        return "new_menu/placeholder.png"
    if raw.startswith("http://") or raw.startswith("https://"):
        raw = raw.split("?")[0]
        if "/build/" in raw:
            raw = raw.split("/build/", 1)[1]
        else:
            raw = raw.rsplit("/", 1)[-1]
    raw = raw.lstrip("/")
    if raw.startswith("build/"):
        raw = raw[len("build/"):]
    if raw.startswith("new_menu/"):
        return raw
    return f"new_menu/{raw.rsplit('/', 1)[-1]}"


def _normalize_composition(value):
    if value is None:
        return None
    if isinstance(value, list):
        parts = [str(x).strip() for x in value if str(x).strip()]
        return json.dumps(parts) if parts else None
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            parts = [str(x).strip() for x in parsed if str(x).strip()]
            return json.dumps(parts) if parts else None
    except Exception:
        pass
    parts = [p.strip() for p in text.replace("\r", "").replace("\n", ",").split(",") if p.strip()]
    return json.dumps(parts) if parts else None


def _normalize_product_payload(data: dict, existing: dict | None = None, *, for_create: bool = False) -> dict:
    out = dict(data)

    if "price" in out or for_create:
        out["price"] = _to_int(out.get("price"), default=_to_int((existing or {}).get("price"), default=0))
    if "availability" in out or for_create:
        out["availability"] = _to_int(out.get("availability"), default=_to_int((existing or {}).get("availability"), default=1))
        out["availability"] = 1 if out["availability"] else 0
    if "item_id" in out:
        item_id = _to_int(out.get("item_id"), default=None)
        out["item_id"] = item_id
    elif for_create:
        out["item_id"] = None

    if "img_path" in out or for_create:
        out["img_path"] = _normalize_img_path(out.get("img_path"))

    if "access_level" in out:
        level = out.get("access_level")
        out["access_level"] = level if level in {"user", "vip_user", "admin", "superadmin"} else None
    elif for_create:
        out["access_level"] = None

    if "type" in out or for_create:
        type_val = str(out.get("type") or (existing or {}).get("type") or "main_course").strip()
        out["type"] = type_val or "main_course"
    if "type_name" in out or for_create:
        type_name_val = str(out.get("type_name") or (existing or {}).get("type_name") or "Main").strip()
        out["type_name"] = type_name_val or "Main"

    if "composition" in out or for_create:
        out["composition"] = _normalize_composition(out.get("composition"))

    existing = existing or {}
    names = {
        "name_en": (out.get("name_en") if "name_en" in out else existing.get("name_en")),
        "name_am": (out.get("name_am") if "name_am" in out else existing.get("name_am")),
        "name_ru": (out.get("name_ru") if "name_ru" in out else existing.get("name_ru")),
    }
    base_name = next((str(v).strip() for v in names.values() if v is not None and str(v).strip()), "New item")
    for key in ("name_en", "name_am", "name_ru"):
        if for_create or key in out:
            val = names.get(key)
            out[key] = str(val).strip() if val is not None and str(val).strip() else base_name

    desc_keys = ["description_en", "description_am", "description_ru"]
    short_keys = ["short_description_en", "short_description_am", "short_description_ru"]
    for d_key, s_key, n_key in zip(desc_keys, short_keys, ["name_en", "name_am", "name_ru"]):
        current_desc = out.get(d_key) if d_key in out else existing.get(d_key)
        current_short = out.get(s_key) if s_key in out else existing.get(s_key)
        fallback_name = out.get(n_key) or existing.get(n_key) or base_name
        fallback_short = str(current_desc).strip() if current_desc is not None and str(current_desc).strip() else str(fallback_name)
        fallback_short = fallback_short[:120]
        if for_create or d_key in out:
            out[d_key] = str(current_desc).strip() if current_desc is not None and str(current_desc).strip() else str(fallback_name)
        if for_create or s_key in out:
            out[s_key] = str(current_short).strip() if current_short is not None and str(current_short).strip() else fallback_short

    return out


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
    payload = _normalize_product_payload(data.model_dump(), for_create=True)
    try:
        pid = repositories.product_create(
            conn,
            item_id=payload.get("item_id"),
            price=payload["price"],
            img_path=payload["img_path"],
            type_=payload["type"],
            type_name=payload["type_name"],
            availability=payload["availability"],
            access_level=payload.get("access_level"),
            name_en=payload.get("name_en"),
            name_am=payload.get("name_am"),
            name_ru=payload.get("name_ru"),
            description_en=payload.get("description_en"),
            description_am=payload.get("description_am"),
            description_ru=payload.get("description_ru"),
            short_description_en=payload.get("short_description_en"),
            short_description_am=payload.get("short_description_am"),
            short_description_ru=payload.get("short_description_ru"),
            composition=payload.get("composition"),
        )
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid product data: {exc}") from exc
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
    kwargs = _normalize_product_payload(data.model_dump(exclude_unset=True), existing=p, for_create=False)
    try:
        repositories.product_update(conn, product_id, **kwargs)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid product update: {exc}") from exc
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
    ext = (os.path.splitext(file.filename or "")[1] or ".png").lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        ext = ".png"
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
