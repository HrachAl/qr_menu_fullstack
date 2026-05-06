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
            access_level TEXT NOT NULL CHECK(access_level IN ('user', 'vip_user', 'admin', 'superadmin', 'chef')),
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
            composition TEXT,
            recipe TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
        CREATE INDEX IF NOT EXISTS idx_products_availability ON products(availability);
        CREATE INDEX IF NOT EXISTS idx_products_access_level ON products(access_level);

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NULL REFERENCES users(id),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('pending', 'preparing', 'completed')),
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
            quantity REAL NOT NULL CHECK(quantity >= 0),
            unit TEXT NOT NULL CHECK(unit IN ('kg', 'L', 'pcs', 'bottles')),
            low_stock_threshold REAL NOT NULL CHECK(low_stock_threshold >= 0),
            overstock_threshold REAL NOT NULL CHECK(overstock_threshold >= 0),
            kcal_per_unit REAL NOT NULL DEFAULT 0 CHECK(kcal_per_unit >= 0),
            protein_per_unit REAL NOT NULL DEFAULT 0 CHECK(protein_per_unit >= 0),
            fat_per_unit REAL NOT NULL DEFAULT 0 CHECK(fat_per_unit >= 0),
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
    _migrate_products_schema(conn)
    _migrate_users_schema(conn)
    _migrate_inventory_schema(conn)
    _migrate_chef_workflows_schema(conn)
    conn.commit()


def _migrate_products_schema(conn: sqlite3.Connection) -> None:
    """Ensure recipe column exists in older DB files."""
    columns = [row[1] for row in conn.execute("PRAGMA table_info(products)").fetchall()]
    if "recipe" not in columns:
        try:
            conn.execute("ALTER TABLE products ADD COLUMN recipe TEXT")
        except sqlite3.OperationalError:
            # Ignore duplicate-column races or unsupported alteration edge cases.
            pass
    if "total_calories" not in columns:
        try:
            conn.execute("ALTER TABLE products ADD COLUMN total_calories REAL NOT NULL DEFAULT 0")
        except sqlite3.OperationalError:
            pass
    if "cooking_time" not in columns:
        try:
            conn.execute("ALTER TABLE products ADD COLUMN cooking_time INTEGER")
        except sqlite3.OperationalError:
            pass


def _migrate_users_schema(conn: sqlite3.Connection) -> None:
    """Ensure preferences column exists in older DB files."""
    columns = [row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()]
    if "preferences" not in columns:
        try:
            conn.execute("ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass

    users_table_sql_row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    ).fetchone()
    users_table_sql = str(users_table_sql_row[0] if users_table_sql_row and users_table_sql_row[0] else "").lower()
    if "'chef'" not in users_table_sql:
        conn.executescript("""
            ALTER TABLE users RENAME TO users_old;

            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                fullname TEXT NOT NULL,
                password TEXT NOT NULL,
                access_level TEXT NOT NULL CHECK(access_level IN ('user', 'vip_user', 'admin', 'superadmin', 'chef')),
                email TEXT UNIQUE,
                preferences TEXT DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_users_access_level ON users(access_level);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

            INSERT INTO users (id, created_at, updated_at, fullname, password, access_level, email, preferences)
            SELECT id, created_at, updated_at, fullname, password, access_level, email, COALESCE(preferences, '')
            FROM users_old;

            DROP TABLE users_old;
        """)


def _migrate_inventory_schema(conn: sqlite3.Connection) -> None:
    """Ensure new inventory columns exist in older DB files."""
    columns = [row[1] for row in conn.execute("PRAGMA table_info(inventory_items)").fetchall()]
    if "overstock_threshold" not in columns:
        try:
            conn.execute("ALTER TABLE inventory_items ADD COLUMN overstock_threshold REAL")
        except sqlite3.OperationalError:
            # Ignore duplicate-column races or unsupported alteration edge cases.
            pass
    conn.execute(
        """
        UPDATE inventory_items
        SET overstock_threshold = low_stock_threshold * 3
        WHERE overstock_threshold IS NULL
        """
    )
    if "kcal_per_unit" not in columns:
        try:
            conn.execute("ALTER TABLE inventory_items ADD COLUMN kcal_per_unit REAL NOT NULL DEFAULT 0")
        except sqlite3.OperationalError:
            pass
    if "protein_per_unit" not in columns:
        try:
            conn.execute("ALTER TABLE inventory_items ADD COLUMN protein_per_unit REAL NOT NULL DEFAULT 0")
        except sqlite3.OperationalError:
            pass
    if "fat_per_unit" not in columns:
        try:
            conn.execute("ALTER TABLE inventory_items ADD COLUMN fat_per_unit REAL NOT NULL DEFAULT 0")
        except sqlite3.OperationalError:
            pass


def _migrate_chef_workflows_schema(conn: sqlite3.Connection) -> None:
    """Create chef workflow tables for inventory adjustments and AI-mediated messages."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS inventory_adjustment_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            ingredient_id INTEGER NOT NULL REFERENCES inventory_items(id),
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'auto-approved', 'rejected')),
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_inventory_adjustment_requests_order_id
            ON inventory_adjustment_requests(order_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_adjustment_requests_ingredient_id
            ON inventory_adjustment_requests(ingredient_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_adjustment_requests_status
            ON inventory_adjustment_requests(status);
        CREATE INDEX IF NOT EXISTS idx_inventory_adjustment_requests_created_at
            ON inventory_adjustment_requests(created_at);

        CREATE TABLE IF NOT EXISTS ai_chef_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            complex_request_text TEXT NOT NULL,
            chef_reply_text TEXT,
            ai_filtered_reply TEXT,
            status TEXT NOT NULL DEFAULT 'pending_chef'
                CHECK(status IN ('pending_chef', 'replied_by_chef', 'delivered_to_customer'))
        );
        CREATE INDEX IF NOT EXISTS idx_ai_chef_messages_order_id
            ON ai_chef_messages(order_id);
        CREATE INDEX IF NOT EXISTS idx_ai_chef_messages_status
            ON ai_chef_messages(status);
    """)




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
