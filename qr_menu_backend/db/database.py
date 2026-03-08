"""
SQLite database connection and schema initialization.
"""
import sqlite3
import os
from pathlib import Path

# Default DB path: same directory as backend, file menu.db
_BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = os.environ.get("QR_MENU_DB_PATH", str(_BASE_DIR / "menu.db"))


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
    """)
    conn.commit()


def init_db(db_path: str | None = None) -> None:
    """Initialize database file and schema."""
    path = db_path or DEFAULT_DB_PATH
    conn = get_connection(path)
    try:
        init_schema(conn)
    finally:
        conn.close()


def get_db(db_path: str | None = None):
    """Dependency that yields a DB connection and closes it after use."""
    conn = get_connection(db_path or DEFAULT_DB_PATH)
    try:
        yield conn
    finally:
        conn.close()
