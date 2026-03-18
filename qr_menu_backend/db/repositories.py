"""
Repository layer for users, products, orders, order_items.
All functions accept a sqlite3 connection as first argument.
"""
import sqlite3
import json
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
    rows = conn.execute(
        "SELECT id, item_id, price, img_path, type, type_name, name_en AS name, description_en AS description, "
        "short_description_en AS short_description, composition FROM products WHERE availability = 1"
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
        out[item_id] = d
    return out


def product_update(conn: sqlite3.Connection, product_id: int, **kwargs) -> None:
    allowed = {
        "item_id",
        "price", "img_path", "availability", "access_level", "type", "type_name",
        "name_en", "name_am", "name_ru", "description_en", "description_am", "description_ru",
        "short_description_en", "short_description_am", "short_description_ru", "composition",
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
) -> int:
    now = _now()
    cur = conn.execute(
        """INSERT INTO inventory_items (name, category, quantity, unit, low_stock_threshold, last_updated)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (name, category, float(quantity), unit, float(low_stock_threshold), now),
    )
    conn.commit()
    return cur.lastrowid


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

    current_qty = float(current.get("quantity") or 0)
    delta = float(amount)
    if action == "add":
        next_qty = current_qty + delta
    else:
        next_qty = max(0.0, current_qty - delta)

    now = _now()
    conn.execute(
        "UPDATE inventory_items SET quantity = ?, last_updated = ? WHERE id = ?",
        (next_qty, now, item_id),
    )
    conn.execute(
        """INSERT INTO inventory_adjustments (inventory_item_id, action, amount, reason, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (item_id, action, delta, reason, now),
    )
    conn.commit()
    return inventory_get_by_id(conn, item_id)
