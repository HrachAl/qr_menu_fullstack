"""
SQLite database connection and schema initialization.
"""
import json
import random
import re
import sqlite3
import os
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path

# Default DB path: same directory as backend, file menu.db
_BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = os.environ.get("QR_MENU_DB_PATH", str(_BASE_DIR / "menu.db"))


# Map menu composition terms to canonical raw materials (normalized keys).
INGREDIENT_EXPANSIONS: dict[str, list[str]] = {
    "grilled crispy angus beef": ["beef"],
    "grilled angus beef patty": ["beef"],
    "crispy angus beef": ["beef"],
    "angus smashed beef": ["beef"],
    "fried crispy chicken fillet": ["chicken breast"],
    "crispy chicken": ["chicken breast"],
    "curly lettuce": ["lettuce"],
    "iceberg lettuce": ["lettuce"],
    "mixed greens": ["mixed greens"],
    "diced onion": ["onion"],
    "onion rings": ["onion"],
    "diced jalapeno": ["jalapeno"],
    "double jalapeno sauce": ["jalapeno", "vinegar", "sugar"],
    "relish-mayo sauce": ["mayonnaise", "mustard", "vinegar", "sugar", "pickles"],
    "twins special sauce": ["mayonnaise", "ketchup", "mustard", "vinegar", "sugar"],
    "caesar sauce": ["mayonnaise", "garlic", "lemon juice", "vinegar"],
    "milky potato buns": ["potato buns"],
    "oreo cookies": ["oreo cookies"],
    "corona extra": ["corona extra"],
    "pepsi": ["pepsi"],
    "mirinda": ["mirinda"],
    "mineral water": ["mineral water"],
    "water": ["still water"],
}


# Canonical inventory profiles for realistic stock snapshots.
INVENTORY_PROFILES: dict[str, dict[str, object]] = {
    "beef": {"name": "Beef", "category": "Meat", "unit": "kg", "quantity": 6.8, "threshold": 7.5},
    "chicken breast": {"name": "Chicken Breast", "category": "Meat", "unit": "kg", "quantity": 11.4, "threshold": 5.0},
    "potato": {"name": "Potato", "category": "Produce", "unit": "kg", "quantity": 36.0, "threshold": 15.0},
    "tomato": {"name": "Tomato", "category": "Produce", "unit": "kg", "quantity": 9.2, "threshold": 5.0},
    "cucumber": {"name": "Cucumber", "category": "Produce", "unit": "kg", "quantity": 5.0, "threshold": 2.0},
    "lettuce": {"name": "Lettuce", "category": "Produce", "unit": "kg", "quantity": 4.2, "threshold": 2.5},
    "mixed greens": {"name": "Mixed Greens", "category": "Produce", "unit": "kg", "quantity": 3.1, "threshold": 1.5},
    "onion": {"name": "Onion", "category": "Produce", "unit": "kg", "quantity": 12.3, "threshold": 6.0},
    "jalapeno": {"name": "Jalapeno", "category": "Produce", "unit": "kg", "quantity": 1.0, "threshold": 1.2},
    "garlic": {"name": "Garlic", "category": "Produce", "unit": "kg", "quantity": 1.8, "threshold": 0.8},
    "pickles": {"name": "Pickles", "category": "Produce", "unit": "kg", "quantity": 3.5, "threshold": 1.2},
    "olives": {"name": "Olives", "category": "Produce", "unit": "kg", "quantity": 2.4, "threshold": 1.0},
    "strawberry": {"name": "Strawberry", "category": "Produce", "unit": "kg", "quantity": 2.0, "threshold": 1.0},
    "raspberry": {"name": "Raspberry", "category": "Produce", "unit": "kg", "quantity": 1.4, "threshold": 0.8},
    "cheese": {"name": "Cheese", "category": "Dairy", "unit": "kg", "quantity": 8.7, "threshold": 3.0},
    "cheddar cheese": {"name": "Cheddar Cheese", "category": "Dairy", "unit": "kg", "quantity": 3.1, "threshold": 1.2},
    "milk": {"name": "Milk", "category": "Dairy", "unit": "L", "quantity": 16.0, "threshold": 5.0},
    "cream": {"name": "Cream", "category": "Dairy", "unit": "L", "quantity": 6.5, "threshold": 2.0},
    "yogurt": {"name": "Yogurt", "category": "Dairy", "unit": "kg", "quantity": 4.0, "threshold": 1.5},
    "butter": {"name": "Butter", "category": "Dairy", "unit": "kg", "quantity": 3.2, "threshold": 1.0},
    "ketchup": {"name": "Ketchup", "category": "Dry Goods", "unit": "L", "quantity": 4.5, "threshold": 1.5},
    "mustard": {"name": "Mustard", "category": "Dry Goods", "unit": "L", "quantity": 2.6, "threshold": 0.9},
    "mayonnaise": {"name": "Mayonnaise", "category": "Dry Goods", "unit": "L", "quantity": 7.0, "threshold": 2.0},
    "vinegar": {"name": "Vinegar", "category": "Dry Goods", "unit": "L", "quantity": 3.8, "threshold": 1.2},
    "lemon juice": {"name": "Lemon Juice", "category": "Dry Goods", "unit": "L", "quantity": 2.2, "threshold": 0.8},
    "sugar": {"name": "Sugar", "category": "Dry Goods", "unit": "kg", "quantity": 18.0, "threshold": 7.0},
    "brown sugar": {"name": "Brown Sugar", "category": "Dry Goods", "unit": "kg", "quantity": 6.5, "threshold": 2.0},
    "paprika": {"name": "Paprika", "category": "Dry Goods", "unit": "kg", "quantity": 1.9, "threshold": 0.6},
    "wild oregano": {"name": "Wild Oregano", "category": "Dry Goods", "unit": "kg", "quantity": 0.7, "threshold": 0.3},
    "tomato paste": {"name": "Tomato Paste", "category": "Dry Goods", "unit": "kg", "quantity": 5.5, "threshold": 2.0},
    "coffee": {"name": "Coffee Beans", "category": "Dry Goods", "unit": "kg", "quantity": 3.4, "threshold": 1.2},
    "cocoa": {"name": "Cocoa", "category": "Dry Goods", "unit": "kg", "quantity": 1.8, "threshold": 0.7},
    "honey": {"name": "Honey", "category": "Dry Goods", "unit": "kg", "quantity": 4.2, "threshold": 1.5},
    "croutons": {"name": "Croutons", "category": "Dry Goods", "unit": "pcs", "quantity": 120.0, "threshold": 40.0},
    "potato buns": {"name": "Potato Buns", "category": "Sweets/Bakery", "unit": "pcs", "quantity": 45.0, "threshold": 55.0},
    "oreo cookies": {"name": "Oreo Cookies", "category": "Sweets/Bakery", "unit": "pcs", "quantity": 180.0, "threshold": 60.0},
    "still water": {"name": "Still Water", "category": "Beverages", "unit": "bottles", "quantity": 36.0, "threshold": 12.0},
    "mineral water": {"name": "Mineral Water", "category": "Beverages", "unit": "bottles", "quantity": 28.0, "threshold": 10.0},
    "pepsi": {"name": "Pepsi", "category": "Beverages", "unit": "bottles", "quantity": 40.0, "threshold": 14.0},
    "mirinda": {"name": "Mirinda", "category": "Beverages", "unit": "bottles", "quantity": 24.0, "threshold": 10.0},
    "corona extra": {"name": "Corona Extra", "category": "Alcohol", "unit": "bottles", "quantity": 9.0, "threshold": 12.0},
}


def _normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9\s\-/]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def _extract_ingredients_from_products(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT composition FROM products WHERE composition IS NOT NULL AND TRIM(composition) != ''"
    ).fetchall()
    ingredients: set[str] = set()
    for row in rows:
        raw = row["composition"]
        parts: list[str] = []
        if isinstance(raw, str):
            try:
                loaded = json.loads(raw)
                if isinstance(loaded, list):
                    parts = [str(x) for x in loaded if str(x).strip()]
                elif isinstance(loaded, str):
                    parts = [loaded]
            except Exception:
                parts = [p.strip() for p in raw.split(",") if p.strip()]
        elif isinstance(raw, list):
            parts = [str(x) for x in raw if str(x).strip()]

        for part in parts:
            normalized = _normalize_text(part)
            if normalized:
                ingredients.add(normalized)
    return ingredients


def _extract_ingredients_from_menu_file() -> set[str]:
    menu_path = _BASE_DIR / "services" / "menu_en.json"
    if not menu_path.exists():
        return set()

    try:
        with open(menu_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return set()

    ingredients: set[str] = set()
    for item in data if isinstance(data, list) else []:
        composition = item.get("composition") if isinstance(item, dict) else None
        if not composition:
            continue
        if isinstance(composition, list):
            for part in composition:
                normalized = _normalize_text(str(part))
                if normalized:
                    ingredients.add(normalized)
        elif isinstance(composition, str):
            normalized = _normalize_text(composition)
            if normalized:
                ingredients.add(normalized)
    return ingredients


def _canonical_ingredients(conn: sqlite3.Connection) -> list[str]:
    tokens = _extract_ingredients_from_products(conn)
    if not tokens:
        tokens = _extract_ingredients_from_menu_file()

    canonical: set[str] = set()
    for token in tokens:
        expanded = INGREDIENT_EXPANSIONS.get(token, [token])
        for item in expanded:
            normalized = _normalize_text(item)
            if normalized:
                canonical.add(normalized)
    return sorted(canonical)


def _fallback_inventory_profile(key: str) -> dict[str, object]:
    # Reasonable default for any ingredient not covered by known profiles.
    title = " ".join(part.capitalize() for part in key.split())
    return {
        "name": title,
        "category": "Dry Goods",
        "unit": "kg",
        "quantity": 2.5,
        "threshold": 0.8,
    }


def seed_inventory(conn: sqlite3.Connection) -> int:
    """Seed inventory with realistic stock snapshot extracted from menu composition fields.

    Seeding runs only when inventory_items is empty.
    """
    existing = conn.execute("SELECT COUNT(*) AS c FROM inventory_items").fetchone()["c"]
    if existing:
        return 0

    canonical = _canonical_ingredients(conn)
    if not canonical:
        return 0

    # Snapshot at a deterministic pseudo-random moment in the recent past.
    rng = random.Random(20260318)
    minutes_back = rng.randint(45, 18 * 60)
    snapshot_time = (datetime.utcnow() - timedelta(minutes=minutes_back)).isoformat(timespec="seconds")

    rows: list[tuple[object, ...]] = []
    for key in canonical:
        profile = INVENTORY_PROFILES.get(key, _fallback_inventory_profile(key))
        rows.append(
            (
                profile["name"],
                profile["category"],
                float(profile["quantity"]),
                profile["unit"],
                float(profile["threshold"]),
                snapshot_time,
            )
        )

    conn.executemany(
        """
        INSERT INTO inventory_items (name, category, quantity, unit, low_stock_threshold, last_updated)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    conn.commit()
    return len(rows)


def get_connection(db_path: str | None = None):
    """Return a connection with foreign keys enabled. Uses check_same_thread=False so the
    connection can be closed from any thread (FastAPI may run dependency cleanup in a different thread)."""
    path = db_path or DEFAULT_DB_PATH
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    """Create tables if they do not exist."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            fullname TEXT NOT NULL,
            password TEXT NOT NULL,
            access_level TEXT NOT NULL CHECK(access_level IN ('user', 'vip_user', 'admin', 'superadmin')),
            email TEXT UNIQUE
        );
        CREATE INDEX IF NOT EXISTS idx_users_access_level ON users(access_level);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER UNIQUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            price INTEGER NOT NULL,
            img_path TEXT NOT NULL,
            availability INTEGER NOT NULL DEFAULT 1,
            access_level TEXT CHECK(access_level IN ('user', 'vip_user', 'admin', 'superadmin')),
            type TEXT NOT NULL,
            type_name TEXT NOT NULL,
            name_en TEXT,
            name_am TEXT,
            name_ru TEXT,
            description_en TEXT,
            description_am TEXT,
            description_ru TEXT,
            short_description_en TEXT,
            short_description_am TEXT,
            short_description_ru TEXT,
            composition TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
        CREATE INDEX IF NOT EXISTS idx_products_availability ON products(availability);
        CREATE INDEX IF NOT EXISTS idx_products_access_level ON products(access_level);

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NULL REFERENCES users(id),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('created', 'confirmed', 'completed')),
            price INTEGER NOT NULL,
            completed_at TEXT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id),
            count INTEGER NOT NULL CHECK(count > 0)
        );
        CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
        CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

        CREATE TABLE IF NOT EXISTS inventory_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL CHECK(category IN ('Meat', 'Produce', 'Beverages', 'Alcohol', 'Sweets/Bakery', 'Dairy', 'Dry Goods')),
            quantity REAL NOT NULL DEFAULT 0,
            unit TEXT NOT NULL,
            low_stock_threshold REAL NOT NULL DEFAULT 0,
            last_updated TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items(name);
        CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);

        CREATE TABLE IF NOT EXISTS inventory_adjustments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
            action TEXT NOT NULL CHECK(action IN ('add', 'deduct')),
            amount REAL NOT NULL CHECK(amount > 0),
            reason TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_item_id ON inventory_adjustments(inventory_item_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_created_at ON inventory_adjustments(created_at);
    """)
    conn.commit()


def init_db(db_path: str | None = None) -> None:
    """Initialize database file and schema."""
    path = db_path or DEFAULT_DB_PATH
    conn = get_connection(path)
    try:
        init_schema(conn)
        seed_inventory(conn)
    finally:
        conn.close()


def get_db(db_path: str | None = None):
    """Dependency that yields a DB connection and closes it after use."""
    conn = get_connection(db_path or DEFAULT_DB_PATH)
    try:
        yield conn
    finally:
        conn.close()
