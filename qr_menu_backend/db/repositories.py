"""
Repository layer for users, products, orders, order_items.
All functions accept a sqlite3 connection as first argument.
"""
import sqlite3
import json
import re
import random
from datetime import datetime, timezone
from typing import Optional


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------- Users ----------

def user_create(conn: sqlite3.Connection, fullname: str, password: str, access_level: str, email: Optional[str] = None) -> int:
    now = _now()
    cur = conn.execute(
        "INSERT INTO users (created_at, updated_at, fullname, password, access_level, email) VALUES (?, ?, ?, ?, ?, ?)",
        (now, now, fullname, password, access_level, email),
    )
    conn.commit()
    return cur.lastrowid


def user_get_by_id(conn: sqlite3.Connection, user_id: int) -> Optional[dict]:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _row_to_dict(row) if row else None


def user_get_by_email(conn: sqlite3.Connection, email: str) -> Optional[dict]:
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    return _row_to_dict(row) if row else None


def user_list(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM users ORDER BY id").fetchall()
    return [_row_to_dict(r) for r in rows]


def user_update(conn: sqlite3.Connection, user_id: int, **kwargs) -> None:
    allowed = {"fullname", "password", "access_level", "email"}
    now = _now()
    updates = ["updated_at = ?"]
    values = [now]
    for k, v in kwargs.items():
        if k in allowed:
            updates.append(f"{k} = ?")
            values.append(v)
    if len(values) == 1:
        return
    values.append(user_id)
    conn.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", values)
    conn.commit()


def user_delete(conn: sqlite3.Connection, user_id: int) -> None:
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()


# ---------- Products ----------

def product_create(
    conn: sqlite3.Connection,
    price: int,
    img_path: str,
    type_: str,
    type_name: str,
    availability: int = 1,
    access_level: Optional[str] = None,
    item_id: Optional[int] = None,
    name_en: Optional[str] = None,
    name_am: Optional[str] = None,
    name_ru: Optional[str] = None,
    description_en: Optional[str] = None,
    description_am: Optional[str] = None,
    description_ru: Optional[str] = None,
    short_description_en: Optional[str] = None,
    short_description_am: Optional[str] = None,
    short_description_ru: Optional[str] = None,
    composition: Optional[str] = None,
) -> int:
    now = _now()
    cur = conn.execute(
        """INSERT INTO products (
            item_id, created_at, updated_at, price, img_path, availability, access_level,
            type, type_name, name_en, name_am, name_ru,
            description_en, description_am, description_ru,
            short_description_en, short_description_am, short_description_ru,
            composition
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            item_id, now, now, price, img_path, availability, access_level,
            type_, type_name, name_en, name_am, name_ru,
            description_en, description_am, description_ru,
            short_description_en, short_description_am, short_description_ru,
            composition,
        ),
    )
    conn.commit()
    return cur.lastrowid


def product_get_by_id(conn: sqlite3.Connection, product_id: int) -> Optional[dict]:
    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    return _row_to_dict(row) if row else None


def product_get_id_by_item_id(conn: sqlite3.Connection, item_id: int) -> Optional[int]:
    row = conn.execute("SELECT id FROM products WHERE item_id = ?", (item_id,)).fetchone()
    return row["id"] if row else None


def product_list(conn: sqlite3.Connection, availability: Optional[int] = None) -> list[dict]:
    if availability is not None:
        rows = conn.execute("SELECT * FROM products WHERE availability = ? ORDER BY type, id", (availability,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM products ORDER BY type, id").fetchall()
    return [_row_to_dict(r) for r in rows]


def _allowed_access_levels(viewer_level: Optional[str]) -> Optional[tuple]:
    """Allowed product access_level values for a viewer. None = no filter (show all)."""
    if viewer_level == "superadmin":
        return None  # all
    if viewer_level == "admin":
        return (None, "user", "vip_user", "admin")
    if viewer_level == "vip_user":
        return (None, "user", "vip_user")
    # guest or "user" -> no restriction + user only
    return (None, "user")


def product_list_for_menu(
    conn: sqlite3.Connection,
    language: str = "en",
    viewer_access_level: Optional[str] = None,
) -> list[dict]:
    """Return products as menu items with name/description/short_description for the given language.
    Filter by viewer_access_level: guest/None and 'user' see (no restriction, user); vip_user sees + vip_user;
    admin sees + admin; superadmin sees all."""
    lang = language.lower()
    if lang not in ("en", "am", "ru"):
        lang = "en"
    suffix = {"en": "_en", "am": "_am", "ru": "_ru"}[lang]
    name_col = "name" + suffix
    desc_col = "description" + suffix
    short_col = "short_description" + suffix
    allowed = _allowed_access_levels(viewer_access_level)
    if allowed is not None:
        non_null = [a for a in allowed if a is not None]
        if non_null:
            placeholders = ",".join("?" for _ in non_null)
            cond = "(access_level IS NULL OR access_level IN ({}))".format(placeholders)
        else:
            cond = "access_level IS NULL"
        sql = (
            f"""SELECT id, item_id, price, img_path, type, type_name, {name_col} AS name, {desc_col} AS description,
            {short_col} AS short_description, composition
            FROM products WHERE availability = 1 AND {cond}
            ORDER BY type, id"""
        )
        rows = conn.execute(sql, non_null).fetchall()
    else:
        rows = conn.execute(
            f"""SELECT id, item_id, price, img_path, type, type_name, {name_col} AS name, {desc_col} AS description,
            {short_col} AS short_description, composition
            FROM products WHERE availability = 1 ORDER BY type, id"""
        ).fetchall()
    out = []
    for r in rows:
        d = _row_to_dict(r)
        d["item_id"] = d.get("item_id") if d.get("item_id") is not None else d.get("id")
        d.pop("id", None)
        d["type_name"] = d.get("type_name") or (d.get("type") or "Menu").replace("_", " ").title()
        d["name"] = d.get("name") or d["type_name"]
        d["description"] = d.get("description") or d["name"]
        d["short_description"] = d.get("short_description") or str(d["description"])[:120]
        d["image"] = d.get("img_path", "").split("/")[-1] if d.get("img_path") else ""
        if not d["image"]:
            d["image"] = "placeholder.png"
        if d.get("composition"):
            try:
                d["composition"] = json.loads(d["composition"]) if isinstance(d["composition"], str) else d["composition"]
            except Exception:
                d["composition"] = []
        else:
            d["composition"] = []
        out.append(d)
    return out


def product_list_as_menu_dict(conn: sqlite3.Connection) -> dict:
    """Return dict keyed by item_id (or id if item_id null) for openai_service (same shape as old menu_am.json)."""
    product_columns = {row["name"] for row in conn.execute("PRAGMA table_info(products)").fetchall()}
    recipe_select = "recipe" if "recipe" in product_columns else "NULL AS recipe"
    calories_select = "total_calories" if "total_calories" in product_columns else "0 AS total_calories"
    cooking_time_select = "cooking_time" if "cooking_time" in product_columns else "NULL AS cooking_time"
    rows = conn.execute(
        "SELECT id, item_id, price, img_path, type, type_name, name_en AS name, description_en AS description, "
        f"short_description_en AS short_description, composition, {recipe_select}, {calories_select}, {cooking_time_select} FROM products WHERE availability = 1"
    ).fetchall()
    out = {}
    for r in rows:
        d = _row_to_dict(r)
        pk = d.pop("id")
        item_id = d.get("item_id") if d.get("item_id") is not None else pk
        d.pop("item_id", None)
        d["item_id"] = item_id
        d["type_name"] = d.get("type_name") or (d.get("type") or "Menu").replace("_", " ").title()
        d["name"] = d.get("name") or d["type_name"]
        d["description"] = d.get("description") or d["name"]
        d["short_description"] = d.get("short_description") or str(d["description"])[:120]
        d["image"] = d.get("img_path", "").split("/")[-1] if d.get("img_path") else ""
        if not d["image"]:
            d["image"] = "placeholder.png"
        if d.get("composition"):
            try:
                d["composition"] = json.loads(d["composition"]) if isinstance(d["composition"], str) else d["composition"]
            except Exception:
                d["composition"] = []
        else:
            d["composition"] = []
        if d.get("recipe"):
            try:
                d["recipe"] = json.loads(d["recipe"]) if isinstance(d["recipe"], str) else d["recipe"]
            except Exception:
                d["recipe"] = []
        else:
            d["recipe"] = []
        try:
            d["total_calories"] = int(d.get("total_calories") or 0)
        except Exception:
            d["total_calories"] = 0
        ct = d.get("cooking_time")
        d["cooking_time"] = int(ct) if ct is not None else None
        out[item_id] = d
    return out


def product_update(conn: sqlite3.Connection, product_id: int, **kwargs) -> None:
    allowed = {
        "item_id",
        "price", "img_path", "availability", "access_level", "type", "type_name",
        "name_en", "name_am", "name_ru", "description_en", "description_am", "description_ru",
        "short_description_en", "short_description_am", "short_description_ru", "composition",
        "cooking_time",
    }
    now = _now()
    updates = ["updated_at = ?"]
    values = [now]
    for k, v in kwargs.items():
        if k in allowed:
            updates.append(f"{k} = ?")
            values.append(v)
    if len(values) == 1:
        return
    values.append(product_id)
    conn.execute(f"UPDATE products SET {', '.join(updates)} WHERE id = ?", values)
    conn.commit()


def product_delete(conn: sqlite3.Connection, product_id: int) -> None:
    conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()


# ---------- Orders ----------

def order_create(conn: sqlite3.Connection, price: int, user_id: Optional[int] = None, status: str = "created") -> int:
    now = _now()
    cur = conn.execute(
        "INSERT INTO orders (user_id, created_at, updated_at, status, price, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, now, now, status, price, None),
    )
    conn.commit()
    return cur.lastrowid


def order_get_by_id(conn: sqlite3.Connection, order_id: int) -> Optional[dict]:
    row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    return _row_to_dict(row) if row else None


def order_list(
    conn: sqlite3.Connection,
    status: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    q = "SELECT * FROM orders WHERE 1=1"
    params = []
    if status:
        q += " AND status = ?"
        params.append(status)
    if user_id is not None:
        q += " AND user_id = ?"
        params.append(user_id)
    q += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = conn.execute(q, params).fetchall()
    return [_row_to_dict(r) for r in rows]


def order_update_status(conn: sqlite3.Connection, order_id: int, status: str) -> None:
    now = _now()
    completed_at = now if status == "completed" else None
    conn.execute(
        "UPDATE orders SET updated_at = ?, status = ?, completed_at = ? WHERE id = ?",
        (now, status, completed_at, order_id),
    )
    conn.commit()


def order_latest_active_for_user(conn: sqlite3.Connection, user_id: int) -> Optional[dict]:
    row = conn.execute(
        """
        SELECT *
        FROM orders
        WHERE user_id = ?
          AND status IN ('created', 'confirmed')
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()
    return _row_to_dict(row) if row else None


def chef_list_active_orders(conn: sqlite3.Connection, limit: int = 100) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM orders WHERE status IN ('created', 'confirmed') ORDER BY created_at ASC LIMIT ?",
        (limit,),
    ).fetchall()
    out = []
    for row in rows:
        order = _row_to_dict(row)
        order_id = order["id"]
        out.append(
            {
                "order": order,
                "items": order_items_by_order_id(conn, order_id),
                "pending_ai_messages": ai_chef_messages_by_order_id(conn, order_id, status="pending_chef"),
                "kitchen_notes": ai_chef_messages_by_order_id(conn, order_id, status="delivered_to_customer"),
                "inventory_adjustment_requests": inventory_adjustment_requests_by_order_id(conn, order_id),
            }
        )
    return out


# ---------- Inventory adjustment requests ----------

def inventory_adjustment_request_get_by_id(conn: sqlite3.Connection, request_id: int) -> Optional[dict]:
    row = conn.execute(
        """
        SELECT iar.*, ii.name AS ingredient_name, o.status AS order_status
        FROM inventory_adjustment_requests iar
        LEFT JOIN inventory_items ii ON ii.id = iar.ingredient_id
        LEFT JOIN orders o ON o.id = iar.order_id
        WHERE iar.id = ?
        """,
        (request_id,),
    ).fetchone()
    return _row_to_dict(row) if row else None


def inventory_adjustment_requests_by_order_id(
    conn: sqlite3.Connection,
    order_id: int,
    status: Optional[str] = None,
) -> list[dict]:
    q = (
        "SELECT iar.*, ii.name AS ingredient_name "
        "FROM inventory_adjustment_requests iar "
        "LEFT JOIN inventory_items ii ON ii.id = iar.ingredient_id "
        "WHERE iar.order_id = ?"
    )
    params = [order_id]
    if status:
        q += " AND iar.status = ?"
        params.append(status)
    q += " ORDER BY iar.created_at DESC, iar.id DESC"
    rows = conn.execute(q, params).fetchall()
    return [_row_to_dict(r) for r in rows]


def inventory_adjustment_request_list(
    conn: sqlite3.Connection,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    q = (
        "SELECT iar.*, ii.name AS ingredient_name, o.status AS order_status "
        "FROM inventory_adjustment_requests iar "
        "LEFT JOIN inventory_items ii ON ii.id = iar.ingredient_id "
        "LEFT JOIN orders o ON o.id = iar.order_id "
        "WHERE 1=1"
    )
    params = []
    if status:
        q += " AND iar.status = ?"
        params.append(status)
    q += " ORDER BY iar.created_at DESC, iar.id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = conn.execute(q, params).fetchall()
    return [_row_to_dict(r) for r in rows]


def inventory_adjustment_request_create(
    conn: sqlite3.Connection,
    order_id: int,
    ingredient_id: int,
) -> dict:
    now = _now()
    cur = conn.execute(
        """
        INSERT INTO inventory_adjustment_requests (
            order_id,
            ingredient_id,
            status,
            created_at,
            updated_at
        ) VALUES (?, ?, 'pending', ?, ?)
        """,
        (order_id, ingredient_id, now, now),
    )
    conn.commit()
    return inventory_adjustment_request_get_by_id(conn, cur.lastrowid) or {}


def inventory_adjustment_request_set_status(
    conn: sqlite3.Connection,
    request_id: int,
    status: str,
) -> Optional[dict]:
    existing = inventory_adjustment_request_get_by_id(conn, request_id)
    if not existing:
        return None
    now = _now()
    conn.execute(
        "UPDATE inventory_adjustment_requests SET status = ?, updated_at = ? WHERE id = ?",
        (status, now, request_id),
    )
    conn.commit()
    return inventory_adjustment_request_get_by_id(conn, request_id)


def inventory_adjustment_auto_approve_expired(
    conn: sqlite3.Connection,
    older_than_minutes: int = 10,
) -> int:
    minutes = max(1, int(older_than_minutes))
    cutoff_expr = f"-{minutes} minutes"
    now = _now()
    before = conn.total_changes
    conn.execute(
        """
        UPDATE inventory_adjustment_requests
        SET status = 'auto-approved', updated_at = ?
        WHERE status = 'pending'
          AND datetime(replace(replace(created_at, 'T', ' '), 'Z', '')) <= datetime('now', ?)
        """,
        (now, cutoff_expr),
    )
    conn.commit()
    return conn.total_changes - before


# ---------- AI chef messages ----------

def ai_chef_message_get_by_id(conn: sqlite3.Connection, message_id: int) -> Optional[dict]:
    row = conn.execute("SELECT * FROM ai_chef_messages WHERE id = ?", (message_id,)).fetchone()
    return _row_to_dict(row) if row else None


def ai_chef_message_get_enriched(conn: sqlite3.Connection, message_id: int) -> Optional[dict]:
    row = conn.execute(
        """
        SELECT m.*, o.user_id AS order_user_id, o.status AS order_status
        FROM ai_chef_messages m
        LEFT JOIN orders o ON o.id = m.order_id
        WHERE m.id = ?
        """,
        (message_id,),
    ).fetchone()
    return _row_to_dict(row) if row else None


def ai_chef_message_create(
    conn: sqlite3.Connection,
    order_id: int,
    complex_request_text: str,
    status: str = "pending_chef",
    chef_reply_text: Optional[str] = None,
    ai_filtered_reply: Optional[str] = None,
) -> dict:
    cur = conn.execute(
        """
        INSERT INTO ai_chef_messages (
            order_id,
            complex_request_text,
            chef_reply_text,
            ai_filtered_reply,
            status
        ) VALUES (?, ?, ?, ?, ?)
        """,
        (
            order_id,
            complex_request_text,
            chef_reply_text,
            ai_filtered_reply,
            status,
        ),
    )
    conn.commit()
    return ai_chef_message_get_by_id(conn, cur.lastrowid) or {}


def ai_chef_messages_by_order_id(
    conn: sqlite3.Connection,
    order_id: int,
    status: Optional[str] = None,
) -> list[dict]:
    q = "SELECT * FROM ai_chef_messages WHERE order_id = ?"
    params = [order_id]
    if status:
        q += " AND status = ?"
        params.append(status)
    q += " ORDER BY id DESC"
    rows = conn.execute(q, params).fetchall()
    return [_row_to_dict(r) for r in rows]


def ai_chef_message_set_chef_reply(
    conn: sqlite3.Connection,
    message_id: int,
    chef_reply_text: str,
) -> Optional[dict]:
    existing = ai_chef_message_get_by_id(conn, message_id)
    if not existing:
        return None
    conn.execute(
        """
        UPDATE ai_chef_messages
        SET chef_reply_text = ?, status = 'replied_by_chef'
        WHERE id = ?
        """,
        (chef_reply_text, message_id),
    )
    conn.commit()
    return ai_chef_message_get_by_id(conn, message_id)


def ai_chef_message_set_filtered_reply(
    conn: sqlite3.Connection,
    message_id: int,
    ai_filtered_reply: str,
) -> Optional[dict]:
    existing = ai_chef_message_get_by_id(conn, message_id)
    if not existing:
        return None
    conn.execute(
        """
        UPDATE ai_chef_messages
        SET ai_filtered_reply = ?, status = 'delivered_to_customer'
        WHERE id = ?
        """,
        (ai_filtered_reply, message_id),
    )
    conn.commit()
    return ai_chef_message_get_by_id(conn, message_id)


# ---------- Order items ----------

def order_items_add(conn: sqlite3.Connection, order_id: int, product_id: int, count: int) -> int:
    cur = conn.execute(
        "INSERT INTO order_items (order_id, product_id, count) VALUES (?, ?, ?)",
        (order_id, product_id, count),
    )
    conn.commit()
    return cur.lastrowid


def order_items_by_order_id(conn: sqlite3.Connection, order_id: int) -> list[dict]:
    rows = conn.execute(
        "SELECT oi.*, p.name_en AS product_name, p.price AS unit_price FROM order_items oi "
        "LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?",
        (order_id,),
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


def _row_to_dict(row) -> dict:
    if row is None:
        return {}
    return dict(zip(row.keys(), row))


# ---------- Inventory ----------

INVENTORY_CATEGORIES = {
    "Meat",
    "Produce",
    "Beverages",
    "Alcohol",
    "Sweets/Bakery",
    "Dairy",
    "Dry Goods",
}

INVENTORY_UNITS = {"kg", "L", "pcs", "bottles"}

READY_MADE_KEYWORDS = {
    "beverage": "Beverages",
    "drink": "Beverages",
    "alcohol": "Alcohol",
    "wine": "Alcohol",
    "beer": "Alcohol",
    "cocktail": "Alcohol",
    "dessert": "Sweets/Bakery",
    "sweet": "Sweets/Bakery",
    "cake": "Sweets/Bakery",
    "pastry": "Sweets/Bakery",
    "bread": "Sweets/Bakery",
}

INGREDIENT_CATEGORY_KEYWORDS = {
    "Meat": {
        "beef", "veal", "chicken", "duck", "turkey", "pork", "ham", "bacon", "sausage",
        "lamb", "salmon", "trout", "tuna", "fish", "shrimp", "prawn", "mussel", "octopus",
        "calamari", "seafood", "anchovy", "crab",
    },
    "Dairy": {
        "milk", "cheese", "mozzarella", "parmesan", "gouda", "butter", "cream", "yogurt",
        "sour cream", "curd", "feta",
    },
    "Dry Goods": {
        "flour", "rice", "pasta", "spaghetti", "fettuccine", "salt", "sugar", "pepper", "spice",
        "oregano", "basil", "yeast", "breadcrumbs", "lentil", "beans", "chickpea", "noodle",
        "semolina", "cornstarch", "cocoa", "coffee", "tea", "chocolate",
    },
    "Produce": {
        "tomato", "potato", "onion", "garlic", "pepper", "cucumber", "lettuce", "carrot", "mushroom",
        "eggplant", "zucchini", "broccoli", "spinach", "avocado", "lemon", "lime", "apple", "banana",
        "orange", "berry", "parsley", "cilantro", "mint", "cabbage", "olive", "pickle",
    },
}

LIQUID_HINTS = {"oil", "milk", "cream", "water", "syrup", "sauce", "vinegar", "juice"}

STRICT_ALCOHOL_KEYWORDS = {"ararat", "wine", "beer", "corona", "vodka"}
STRICT_MEAT_KEYWORDS = {"anchovy", "beef", "chicken"}


def inventory_list(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM inventory_items ORDER BY name COLLATE NOCASE, id"
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


def inventory_get_by_id(conn: sqlite3.Connection, item_id: int) -> Optional[dict]:
    row = conn.execute("SELECT * FROM inventory_items WHERE id = ?", (item_id,)).fetchone()
    return _row_to_dict(row) if row else None


def inventory_create(
    conn: sqlite3.Connection,
    name: str,
    category: str,
    quantity: float,
    unit: str,
    low_stock_threshold: float,
    overstock_threshold: Optional[float] = None,
    kcal_per_unit: float = 0.0,
    protein_per_unit: float = 0.0,
    fat_per_unit: float = 0.0,
) -> int:
    if category not in INVENTORY_CATEGORIES:
        raise ValueError("Invalid category")
    if unit not in INVENTORY_UNITS:
        raise ValueError("Invalid unit")
    now = _now()
    low_stock_threshold = float(max(0.0, low_stock_threshold))
    overstock_threshold = float(max(0.0, overstock_threshold)) if overstock_threshold is not None else low_stock_threshold * 3.0
    kcal_per_unit = float(max(0.0, kcal_per_unit))
    protein_per_unit = float(max(0.0, protein_per_unit))
    fat_per_unit = float(max(0.0, fat_per_unit))
    cur = conn.execute(
        """INSERT INTO inventory_items (
            name,
            category,
            quantity,
            unit,
            low_stock_threshold,
            overstock_threshold,
            kcal_per_unit,
            protein_per_unit,
            fat_per_unit,
            last_updated
        )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            name,
            category,
            float(max(0.0, quantity)),
            unit,
            low_stock_threshold,
            overstock_threshold,
            kcal_per_unit,
            protein_per_unit,
            fat_per_unit,
            now,
        ),
    )
    conn.commit()
    return cur.lastrowid


def inventory_update(conn: sqlite3.Connection, item_id: int, **kwargs) -> Optional[dict]:
    current = inventory_get_by_id(conn, item_id)
    if not current:
        return None

    updates = []
    values = []

    if "name" in kwargs and kwargs["name"] is not None:
        name = str(kwargs["name"]).strip()
        if not name:
            raise ValueError("Name is required")
        updates.append("name = ?")
        values.append(name)

    if "category" in kwargs and kwargs["category"] is not None:
        category = str(kwargs["category"])
        if category not in INVENTORY_CATEGORIES:
            raise ValueError("Invalid category")
        updates.append("category = ?")
        values.append(category)

    if "quantity" in kwargs and kwargs["quantity"] is not None:
        quantity = float(kwargs["quantity"])
        if quantity < 0:
            raise ValueError("Quantity must be non-negative")
        updates.append("quantity = ?")
        values.append(quantity)

    if "unit" in kwargs and kwargs["unit"] is not None:
        unit = str(kwargs["unit"])
        if unit not in INVENTORY_UNITS:
            raise ValueError("Invalid unit")
        updates.append("unit = ?")
        values.append(unit)

    low_stock_value = None
    if "low_stock_threshold" in kwargs and kwargs["low_stock_threshold"] is not None:
        low_stock_value = float(kwargs["low_stock_threshold"])
        if low_stock_value < 0:
            raise ValueError("Low stock threshold must be non-negative")
        updates.append("low_stock_threshold = ?")
        values.append(low_stock_value)

    if "overstock_threshold" in kwargs and kwargs["overstock_threshold"] is not None:
        overstock_value = float(kwargs["overstock_threshold"])
        if overstock_value < 0:
            raise ValueError("Overstock threshold must be non-negative")
        updates.append("overstock_threshold = ?")
        values.append(overstock_value)
    elif low_stock_value is not None:
        updates.append("overstock_threshold = ?")
        values.append(low_stock_value * 3.0)

    if "kcal_per_unit" in kwargs and kwargs["kcal_per_unit"] is not None:
        kcal_per_unit = float(kwargs["kcal_per_unit"])
        if kcal_per_unit < 0:
            raise ValueError("kcal_per_unit must be non-negative")
        updates.append("kcal_per_unit = ?")
        values.append(kcal_per_unit)

    if "protein_per_unit" in kwargs and kwargs["protein_per_unit"] is not None:
        protein_per_unit = float(kwargs["protein_per_unit"])
        if protein_per_unit < 0:
            raise ValueError("protein_per_unit must be non-negative")
        updates.append("protein_per_unit = ?")
        values.append(protein_per_unit)

    if "fat_per_unit" in kwargs and kwargs["fat_per_unit"] is not None:
        fat_per_unit = float(kwargs["fat_per_unit"])
        if fat_per_unit < 0:
            raise ValueError("fat_per_unit must be non-negative")
        updates.append("fat_per_unit = ?")
        values.append(fat_per_unit)

    if not updates:
        return current

    now = _now()
    updates.append("last_updated = ?")
    values.append(now)
    values.append(item_id)

    conn.execute(f"UPDATE inventory_items SET {', '.join(updates)} WHERE id = ?", tuple(values))
    conn.commit()
    return inventory_get_by_id(conn, item_id)


def inventory_delete(conn: sqlite3.Connection, item_id: int) -> None:
    conn.execute("DELETE FROM inventory_items WHERE id = ?", (item_id,))
    conn.commit()


def inventory_adjust(
    conn: sqlite3.Connection,
    item_id: int,
    action: str,
    amount: float,
    reason: str,
) -> Optional[dict]:
    current = inventory_get_by_id(conn, item_id)
    if not current:
        return None
    delta = float(amount)
    if delta <= 0:
        raise ValueError("Amount must be positive")
    if action not in {"add", "deduct"}:
        raise ValueError("Invalid action")

    current_qty = float(current.get("quantity") or 0)
    next_qty = current_qty + delta if action == "add" else max(0.0, current_qty - delta)

    now = _now()
    conn.execute(
        "UPDATE inventory_items SET quantity = ?, last_updated = ? WHERE id = ?",
        (next_qty, now, item_id),
    )
    conn.execute(
        """INSERT INTO inventory_adjustments (inventory_item_id, action, amount, reason, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (item_id, action, delta, reason.strip(), now),
    )
    conn.commit()
    return inventory_get_by_id(conn, item_id)


def seed_inventory(conn: sqlite3.Connection) -> int:
    existing = conn.execute("SELECT COUNT(*) AS c FROM inventory_items").fetchone()["c"]
    if existing > 0:
        return 0

    products = product_list(conn, availability=1)
    if not products:
        return 0

    entries: list[dict] = []
    ingredient_names: set[str] = set()

    for product in products:
        ready_category = _ready_made_category(product)
        if ready_category:
            name = (product.get("name_en") or product.get("name_am") or product.get("name_ru") or "").strip()
            if not name:
                continue
            category_override, unit_override = _category_unit_from_name(name)
            effective_category = category_override or ready_category
            qty, threshold, unit = _ready_made_defaults(effective_category)
            if unit_override:
                unit = unit_override
            entries.append({
                "name": name,
                "category": effective_category,
                "quantity": qty,
                "unit": unit,
                "low_stock_threshold": threshold,
                "overstock_threshold": threshold * 3.0,
                "source": "ready",
            })
            continue

        for ingredient in _extract_ingredients(product.get("composition")):
            ingredient_names.add(ingredient)

    for ing in sorted(ingredient_names):
        category, unit = _ingredient_category_and_unit(ing)
        qty = 15.0 if unit == "L" else 20.0
        threshold = 4.0 if unit == "L" else 5.0
        entries.append({
            "name": ing,
            "category": category,
            "quantity": qty,
            "unit": unit,
            "low_stock_threshold": threshold,
            "overstock_threshold": threshold * 3.0,
            "source": "raw",
        })

    unique_entries: list[dict] = []
    seen = set()
    for item in entries:
        key = item["name"].strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        unique_entries.append(item)

    if not unique_entries:
        return 0

    _apply_seeded_quantities(unique_entries)
    now = _now()
    conn.executemany(
        """INSERT INTO inventory_items (
            name,
            category,
            quantity,
            unit,
            low_stock_threshold,
            overstock_threshold,
            kcal_per_unit,
            protein_per_unit,
            fat_per_unit,
            last_updated
        )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            (
                item["name"],
                item["category"],
                float(max(0.0, item["quantity"])),
                item["unit"],
                float(max(0.0, item["low_stock_threshold"])),
                float(max(0.0, item["overstock_threshold"])),
                0.0,
                0.0,
                0.0,
                now,
            )
            for item in unique_entries
        ],
    )
    conn.commit()
    return len(unique_entries)


def _ready_made_category(product: dict) -> Optional[str]:
    text = " ".join([
        str(product.get("type") or ""),
        str(product.get("type_name") or ""),
        str(product.get("name_en") or ""),
    ]).lower()
    category_override, _ = _category_unit_from_name(text)
    if category_override:
        return category_override
    for key, category in READY_MADE_KEYWORDS.items():
        if key in text:
            return category
    return None


def _ready_made_defaults(category: str) -> tuple[float, float, str]:
    if category == "Alcohol":
        return 24.0, 8.0, "bottles"
    if category == "Beverages":
        return 48.0, 12.0, "bottles"
    if category == "Sweets/Bakery":
        return 24.0, 8.0, "pcs"
    return 20.0, 5.0, "pcs"


def _extract_ingredients(composition_value) -> list[str]:
    if not composition_value:
        return []
    raw_items: list[str]
    if isinstance(composition_value, list):
        raw_items = [str(v) for v in composition_value]
    elif isinstance(composition_value, str):
        text = composition_value.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                raw_items = [str(v) for v in parsed]
            else:
                raw_items = re.split(r"[,;\n]", text)
        except Exception:
            raw_items = re.split(r"[,;\n]", text)
    else:
        return []

    out = []
    for raw in raw_items:
        cleaned = _normalize_ingredient_name(raw)
        if cleaned:
            out.append(cleaned)
    return out


def _normalize_ingredient_name(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"\b\d+[\d.,]*\s*(kg|g|gr|l|ml|pcs|piece|tbsp|tsp)\b", "", text)
    text = re.sub(r"\s+", " ", text).strip(" ,.-")
    if not text or len(text) < 2:
        return ""
    return " ".join(word.capitalize() for word in text.split())


def _ingredient_category_and_unit(name: str) -> tuple[str, str]:
    text = name.lower()
    category_override, unit_override = _category_unit_from_name(text)
    if category_override:
        return category_override, unit_override or "kg"
    for category, keywords in INGREDIENT_CATEGORY_KEYWORDS.items():
        for word in keywords:
            if word in text:
                if category == "Dairy" and any(liq in text for liq in LIQUID_HINTS):
                    return category, "L"
                return category, "kg"
    if any(liq in text for liq in LIQUID_HINTS):
        return "Dry Goods", "L"
    return "Produce", "kg"


def _category_unit_from_name(name: str) -> tuple[Optional[str], Optional[str]]:
    text = str(name or "").lower()
    if any(keyword in text for keyword in STRICT_ALCOHOL_KEYWORDS):
        return "Alcohol", "bottles"
    if any(keyword in text for keyword in STRICT_MEAT_KEYWORDS):
        return "Meat", "kg"
    return None, None


def _round_seed_quantity(value: float, unit: str) -> float:
    if unit in {"pcs", "bottles"}:
        return float(max(0, int(round(value))))
    return round(max(0.0, value), 2)


def _apply_seeded_quantities(entries: list[dict]) -> None:
    rng = random.Random()
    for item in entries:
        threshold = float(max(0.1, item.get("low_stock_threshold") or 0.1))
        overstock_threshold = threshold * 3.0
        item["overstock_threshold"] = overstock_threshold
        quantity = threshold * rng.uniform(0.55, 3.9)
        item["quantity"] = _round_seed_quantity(quantity, item.get("unit") or "kg")

    low_candidates = [item for item in entries if float(item.get("low_stock_threshold") or 0) > 0]
    over_candidates = [item for item in entries if float(item.get("low_stock_threshold") or 0) > 0]

    low_count = sum(
        1 for item in entries
        if float(item.get("quantity") or 0) <= float(item.get("low_stock_threshold") or 0)
    )
    over_count = sum(
        1 for item in entries
        if float(item.get("quantity") or 0) >= float(item.get("overstock_threshold") or 0)
    )

    rng.shuffle(low_candidates)
    rng.shuffle(over_candidates)

    for item in low_candidates:
        if low_count >= 2:
            break
        threshold = float(item.get("low_stock_threshold") or 0)
        if threshold <= 0:
            continue
        forced = threshold * rng.uniform(0.55, 0.9)
        item["quantity"] = _round_seed_quantity(forced, item.get("unit") or "kg")
        if float(item.get("quantity") or 0) >= threshold:
            item["quantity"] = _round_seed_quantity(max(0.0, threshold - 0.1), item.get("unit") or "kg")
        low_count = sum(
            1 for row in entries
            if float(row.get("quantity") or 0) <= float(row.get("low_stock_threshold") or 0)
        )

    for item in over_candidates:
        if over_count >= 2:
            break
        threshold = float(item.get("low_stock_threshold") or 0)
        overstock_threshold = float(item.get("overstock_threshold") or (threshold * 3.0))
        if threshold <= 0:
            continue
        forced = threshold * rng.uniform(3.2, 4.0)
        item["quantity"] = _round_seed_quantity(forced, item.get("unit") or "kg")
        if float(item.get("quantity") or 0) < overstock_threshold:
            item["quantity"] = _round_seed_quantity(overstock_threshold * 1.1, item.get("unit") or "kg")
        over_count = sum(
            1 for row in entries
            if float(row.get("quantity") or 0) >= float(row.get("overstock_threshold") or 0)
        )


# ---------- User Preferences ----------

def user_get_preferences(conn: sqlite3.Connection, user_id: int) -> str:
    row = conn.execute("SELECT preferences FROM users WHERE id = ?", (user_id,)).fetchone()
    return str(row["preferences"] or "") if row else ""


def user_set_preferences(conn: sqlite3.Connection, user_id: int, preferences: str) -> None:
    conn.execute("UPDATE users SET preferences = ?, updated_at = ? WHERE id = ?",
                 (preferences, _now(), user_id))
    conn.commit()


def popularity_summary(conn: sqlite3.Connection, limit: int = 10) -> list[dict]:
    """Top products by order count for AI context."""
    rows = conn.execute("""
        SELECT p.item_id, p.name_en AS name, SUM(oi.count) AS total_orders
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        GROUP BY oi.product_id
        ORDER BY total_orders DESC
        LIMIT ?
    """, (limit,)).fetchall()
    return [dict(zip(r.keys(), r)) for r in rows]
