from fastapi import APIRouter, Depends
from models import Product
from utils import read_json
from typing import List
from routes.auth import get_current_user
import json
from pathlib import Path

router = APIRouter(prefix="/api", tags=["products"])

def read_menu_am():
    """Читаем меню из services/menu_am.json"""
    menu_path = Path(__file__).parent.parent / "services" / "menu_am.json"
    with open(menu_path, 'r', encoding='utf-8') as f:
        return json.load(f)

@router.get("/products", response_model=List[Product])
async def get_menu_products(current_user: dict = Depends(get_current_user)):
    if not current_user:
        return []
    
    products = read_menu_am()
    user_menus = read_json("user_menus.json")
    
    user_id = str(current_user["id"])
    if user_id in user_menus:
        menu = user_menus[user_id]
    else:
        menu = user_menus.get("global", [])
    
    menu_products = [p for p in products if p["item_id"] in menu]
    
    for p in menu_products:
        if 'type_name' not in p:
            p['type_name'] = p.get('type', '')
    
    return menu_products
