from fastapi import APIRouter, HTTPException, Depends
from models import Product, ProductCreate, ProductUpdate
from utils import read_json, write_json, get_next_id
from routes.auth import require_admin
from typing import List
import json
from pathlib import Path

router = APIRouter(prefix="/api/admin", tags=["admin"])

def read_menu_am():
    """Читаем меню из services/menu_am.json"""
    menu_path = Path(__file__).parent.parent / "services" / "menu_am.json"
    with open(menu_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def write_menu_am(data):
    """Записываем меню в services/menu_am.json"""
    menu_path = Path(__file__).parent.parent / "services" / "menu_am.json"
    with open(menu_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@router.get("/products", response_model=List[Product])
async def get_all_products(user: dict = Depends(require_admin)):
    products = read_menu_am()
    for p in products:
        if 'type_name' not in p:
            p['type_name'] = p.get('type', '')
    return products

@router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, user: dict = Depends(require_admin)):
    products = read_menu_am()
    
    new_product = {
        "item_id": get_next_id(products),
        **product_data.model_dump()
    }
    
    products.append(new_product)
    write_menu_am(products)
    
    if 'type_name' not in new_product:
        new_product['type_name'] = new_product.get('type', '')
    
    return new_product

@router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: int, product_data: ProductUpdate, user: dict = Depends(require_admin)):
    products = read_menu_am()
    
    product = next((p for p in products if p["item_id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_data.model_dump(exclude_unset=True)
    product.update(update_data)
    
    write_menu_am(products)
    
    if 'type_name' not in product:
        product['type_name'] = product.get('type', '')
    
    return product

@router.delete("/products/{product_id}")
async def delete_product(product_id: int, user: dict = Depends(require_admin)):
    products = read_menu_am()
    user_menus = read_json("user_menus.json")
    
    product = next((p for p in products if p["item_id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    products = [p for p in products if p["item_id"] != product_id]
    write_menu_am(products)
    
    if "global" in user_menus:
        user_menus["global"] = [item_id for item_id in user_menus["global"] if item_id != product_id]
    
    for user_id in list(user_menus.keys()):
        if user_id != "global":
            user_menus[user_id] = [item_id for item_id in user_menus[user_id] if item_id != product_id]
    
    write_json("user_menus.json", user_menus)
    
    return {"message": "Product deleted successfully"}

@router.get("/users")
async def get_all_users(user: dict = Depends(require_admin)):
    users = read_json("users.json")
    user_menus = read_json("user_menus.json")
    
    users_list = []
    for u in users:
        if u.get("role") != "admin":
            user_id = str(u["id"])
            menu_count = len(user_menus.get(user_id, user_menus.get("global", [])))
            users_list.append({
                "id": u["id"],
                "username": u["username"],
                "created_at": u["created_at"],
                "menu_count": menu_count,
                "has_custom_menu": user_id in user_menus
            })
    
    return users_list

@router.get("/users/{user_id}/menu")
async def get_user_menu(user_id: int, user: dict = Depends(require_admin)):
    user_menus = read_json("user_menus.json")
    products = read_menu_am()
    
    user_id_str = str(user_id)
    if user_id_str in user_menus:
        menu = user_menus[user_id_str]
    else:
        menu = user_menus.get("global", [])
    
    menu_products = [p for p in products if p["item_id"] in menu]
    for p in menu_products:
        if 'type_name' not in p:
            p['type_name'] = p.get('type', '')
    
    return {"menu_ids": menu, "products": menu_products, "is_custom": user_id_str in user_menus}

@router.post("/users/{user_id}/menu/{product_id}")
async def add_to_user_menu(user_id: int, product_id: int, user: dict = Depends(require_admin)):
    products = read_menu_am()
    user_menus = read_json("user_menus.json")
    
    product = next((p for p in products if p["item_id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    user_id_str = str(user_id)
    if user_id_str not in user_menus:
        user_menus[user_id_str] = user_menus.get("global", []).copy()
    
    if product_id not in user_menus[user_id_str]:
        user_menus[user_id_str].append(product_id)
        write_json("user_menus.json", user_menus)
    
    return {"message": "Product added to user menu"}

@router.delete("/users/{user_id}/menu/{product_id}")
async def remove_from_user_menu(user_id: int, product_id: int, user: dict = Depends(require_admin)):
    user_menus = read_json("user_menus.json")
    
    user_id_str = str(user_id)
    if user_id_str in user_menus and product_id in user_menus[user_id_str]:
        user_menus[user_id_str] = [item_id for item_id in user_menus[user_id_str] if item_id != product_id]
        write_json("user_menus.json", user_menus)
    
    return {"message": "Product removed from user menu"}

@router.delete("/users/{user_id}/menu")
async def reset_user_menu(user_id: int, user: dict = Depends(require_admin)):
    user_menus = read_json("user_menus.json")
    
    user_id_str = str(user_id)
    if user_id_str in user_menus:
        del user_menus[user_id_str]
        write_json("user_menus.json", user_menus)
    
    return {"message": "User menu reset to global"}

@router.get("/menu")
async def get_global_menu(user: dict = Depends(require_admin)):
    user_menus = read_json("user_menus.json")
    products = read_menu_am()
    
    menu = user_menus.get("global", [])
    menu_products = [p for p in products if p["item_id"] in menu]
    for p in menu_products:
        if 'type_name' not in p:
            p['type_name'] = p.get('type', '')
    
    return {"menu_ids": menu, "products": menu_products}

@router.post("/menu/{product_id}")
async def add_to_global_menu(product_id: int, user: dict = Depends(require_admin)):
    products = read_menu_am()
    user_menus = read_json("user_menus.json")
    
    product = next((p for p in products if p["item_id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if "global" not in user_menus:
        user_menus["global"] = []
    
    if product_id not in user_menus["global"]:
        user_menus["global"].append(product_id)
        write_json("user_menus.json", user_menus)
    
    return {"message": "Product added to global menu"}

@router.delete("/menu/{product_id}")
async def remove_from_global_menu(product_id: int, user: dict = Depends(require_admin)):
    user_menus = read_json("user_menus.json")
    
    if "global" in user_menus and product_id in user_menus["global"]:
        user_menus["global"].remove(product_id)
        write_json("user_menus.json", user_menus)
    
    return {"message": "Product removed from global menu"}

@router.delete("/events/{event_id}")
async def delete_event(event_id: int, user: dict = Depends(require_admin)):
    events = read_json("events.json")
    events = [e for e in events if e["id"] != event_id]
    write_json("events.json", events)
    return {"message": "Event deleted successfully"}

@router.delete("/orders/{order_id}")
async def delete_order(order_id: int, user: dict = Depends(require_admin)):
    orders = read_json("orders.json")
    orders = [o for o in orders if o["id"] != order_id]
    write_json("orders.json", orders)
    return {"message": "Order deleted successfully"}

@router.get("/stats")
async def get_stats(user: dict = Depends(require_admin)):
    events = read_json("events.json")
    orders = read_json("orders.json")
    users_data = read_json("users.json")
    
    stats = {
        "total_events": len(events),
        "total_orders": len(orders),
        "total_users": len([u for u in users_data if u.get("role") != "admin"]),
        "events": events,
        "orders": orders
    }
    
    return stats
