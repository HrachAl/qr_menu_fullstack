from fastapi import APIRouter, HTTPException, Depends
from models import OrderCreate, Order, CartItem, Event
from utils import read_json, write_json, get_next_id
from routes.auth import require_auth, get_current_user
from datetime import datetime
from typing import List, Optional

router = APIRouter(prefix="/api", tags=["orders"])

@router.post("/cart/add")
async def add_to_cart_event(item: CartItem, user: Optional[dict] = Depends(get_current_user)):
    events = read_json("events.json")
    
    user_id = user["id"] if user else 0
    
    new_event = {
        "id": get_next_id(events),
        "user_id": user_id,
        "action": "ADD_TO_CART",
        "items": [item.model_dump()],
        "created_at": datetime.now().isoformat()
    }
    
    events.append(new_event)
    write_json("events.json", events)
    
    return {"message": "Item added to cart", "event": new_event}

@router.post("/orders/checkout", response_model=Order)
async def checkout(order_data: OrderCreate, user: Optional[dict] = Depends(get_current_user)):
    orders = read_json("orders.json")
    events = read_json("events.json")
    
    user_id = user["id"] if user else order_data.user_id
    
    new_order = {
        "id": get_next_id(orders),
        "user_id": user_id,
        "items": [item.model_dump() for item in order_data.items],
        "total": order_data.total,
        "created_at": datetime.now().isoformat(),
        "status": "completed"
    }
    
    orders.append(new_order)
    write_json("orders.json", orders)
    
    checkout_event = {
        "id": get_next_id(events),
        "user_id": user_id,
        "action": "CHECKOUT",
        "items": [item.model_dump() for item in order_data.items],
        "created_at": datetime.now().isoformat()
    }
    
    events.append(checkout_event)
    write_json("events.json", events)
    
    return new_order

@router.get("/orders/my", response_model=List[Order])
async def get_my_orders(user: dict = Depends(require_auth)):
    orders = read_json("orders.json")
    user_orders = [o for o in orders if o["user_id"] == user["id"]]
    return user_orders

@router.get("/recommendations")
async def get_recommendations(user: Optional[dict] = Depends(get_current_user)):
    events = read_json("events.json")
    products = read_json("products.json")
    menu = read_json("menu.json")
    
    user_id = user["id"] if user else 0
    
    user_events = [e for e in events if e["user_id"] == user_id]
    
    if not user_events:
        menu_products = [p for p in products if p["item_id"] in menu]
        return menu_products[:5] if len(menu_products) >= 5 else menu_products
    
    user_events.sort(key=lambda x: x["created_at"], reverse=True)
    
    recent_items = []
    for event in user_events[:10]:
        if event.get("items"):
            for item in event["items"]:
                item_id = item.get("id")
                if item_id and item_id not in recent_items:
                    recent_items.append(item_id)
    
    recommended_products = []
    for item_id in recent_items[:5]:
        product = next((p for p in products if p["item_id"] == item_id and p["item_id"] in menu), None)
        if product:
            recommended_products.append(product)
    
    if len(recommended_products) < 5:
        menu_products = [p for p in products if p["item_id"] in menu and p["item_id"] not in recent_items]
        recommended_products.extend(menu_products[:5 - len(recommended_products)])
    
    return recommended_products
