import os
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = os.environ.get("QR_MENU_DB_PATH", str(BASE_DIR / "menu.db"))


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys = OFF")
        row = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'"
        ).fetchone()
        if not row or not row[0]:
            raise RuntimeError("Orders table schema not found in sqlite_master.")
        original_sql = str(row[0])

        updated_sql = original_sql.replace("'created'", "'pending'").replace("'confirmed'", "'preparing'")

        conn.execute("PRAGMA writable_schema = ON")
        conn.execute(
            "UPDATE sqlite_master SET sql = ? WHERE type = 'table' AND name = 'orders'",
            (updated_sql,),
        )
        conn.execute("PRAGMA writable_schema = OFF")

        conn.execute("UPDATE orders SET status = 'pending' WHERE status = 'created'")
        conn.execute("UPDATE orders SET status = 'preparing' WHERE status = 'confirmed'")

        conn.commit()
    finally:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.close()


if __name__ == "__main__":
    main()
