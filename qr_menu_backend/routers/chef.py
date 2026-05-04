"""Chef/Admin workflow endpoints for inventory adjustment handling and chef replies."""

import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status

from auth.deps import get_current_user, require_admin
from db.database import get_db
from db import repositories
from models import (
    ChefInventoryAdjustmentCreate,
    ChefReplyAiRequest,
    InventoryAdjustmentApproveRejectRequest,
)
from services.ai_service import ChatBot


router = APIRouter(tags=["chef"])
admin_router = APIRouter(tags=["admin-inventory-adjustments"])


def require_chef_panel_access(user=Depends(get_current_user)):
    if user.get("access_level") not in ("chef", "admin", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chef panel access required",
        )
    return user


@router.get("/chef/active-orders")
def chef_active_orders(
    limit: int = 100,
    conn: sqlite3.Connection = Depends(get_db),
    user=Depends(require_chef_panel_access),
):
    return repositories.chef_list_active_orders(conn, limit=limit)


@router.post("/chef/inventory-adjust")
def chef_inventory_adjust(
    data: ChefInventoryAdjustmentCreate,
    conn: sqlite3.Connection = Depends(get_db),
    user=Depends(require_chef_panel_access),
):
    if not repositories.order_get_by_id(conn, data.order_id):
        raise HTTPException(status_code=404, detail="Order not found")
    if not repositories.inventory_get_by_id(conn, data.ingredient_id):
        raise HTTPException(status_code=404, detail="Ingredient not found")

    return repositories.inventory_adjustment_request_create(
        conn,
        order_id=data.order_id,
        ingredient_id=data.ingredient_id,
    )


@router.post("/chef/reply-ai")
async def chef_reply_ai(
    data: ChefReplyAiRequest,
    conn: sqlite3.Connection = Depends(get_db),
    user=Depends(require_chef_panel_access),
):
    updated = repositories.ai_chef_message_set_chef_reply(
        conn,
        message_id=data.ai_chef_message_id,
        chef_reply_text=data.chef_reply_text,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="AI chef message not found")
    try:
        delivery = await ChatBot.process_chef_reply_delivery(data.ai_chef_message_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process chef reply delivery: {exc}") from exc
    return delivery


@admin_router.get("/admin/inventory-adjustments")
def admin_inventory_adjustments(
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
    conn: sqlite3.Connection = Depends(get_db),
    user=Depends(require_admin),
):
    allowed = {"pending", "approved", "auto-approved", "rejected"}
    if status and status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status filter")
    return repositories.inventory_adjustment_request_list(
        conn,
        status=status,
        limit=limit,
        offset=offset,
    )


@admin_router.post("/admin/inventory-adjustments/{request_id}/approve-reject")
def admin_approve_reject_inventory_adjustment(
    request_id: int,
    data: InventoryAdjustmentApproveRejectRequest,
    conn: sqlite3.Connection = Depends(get_db),
    user=Depends(require_admin),
):
    existing = repositories.inventory_adjustment_request_get_by_id(conn, request_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Inventory adjustment request not found")
    if existing.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be approved or rejected")

    next_status = "approved" if data.decision == "approve" else "rejected"
    updated = repositories.inventory_adjustment_request_set_status(conn, request_id, next_status)
    if not updated:
        raise HTTPException(status_code=404, detail="Inventory adjustment request not found")
    return updated