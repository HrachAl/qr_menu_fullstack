"""
Public API: create order (guest or with user), get my orders (authenticated).
"""
import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status
from db.database import get_db
from db import repositories
from auth.deps import get_current_user_optional, get_current_user
from models import OrderCreate, OrderResponse

router = APIRouter(prefix="/api", tags=["orders"])


@router.get("/my-orders")
def get_my_orders(
    limit: int = 50,
    conn: sqlite3.Connection = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return orders for the authenticated user (order history)."""
    orders = repositories.order_list(conn, user_id=user["id"], limit=limit)
    out = []
    for o in orders:
        items = repositories.order_items_by_order_id(conn, o["id"])
        out.append({"order": o, "items": items})
    return out


@router.post("/orders", response_model=OrderResponse)
def create_order(data: OrderCreate, conn: sqlite3.Connection = Depends(get_db), user=Depends(get_current_user_optional)):
    user_id = user["id"] if user else None
    if not data.items:
        raise HTTPException(status_code=400, detail="At least one item required")
    total = 0
    resolved = []
    for it in data.items:
        product_id = it.product_id
        if product_id is None and it.item_id is not None:
            product_id = repositories.product_get_id_by_item_id(conn, it.item_id)
        if product_id is None:
            raise HTTPException(status_code=400, detail=f"Unknown product/item_id for count {it.count}")
        p = repositories.product_get_by_id(conn, product_id)
        if not p:
            raise HTTPException(status_code=400, detail=f"Product {product_id} not found")
        total += p["price"] * it.count
        resolved.append((product_id, it.count))
    order_id = repositories.order_create(conn, price=total, user_id=user_id)
    for product_id, count in resolved:
        repositories.order_items_add(conn, order_id, product_id, count)
    o = repositories.order_get_by_id(conn, order_id)
    return o
