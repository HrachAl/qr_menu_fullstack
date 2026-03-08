"""
One-time migration: load menu_en.json, menu_am.json, menu_ru.json into SQLite products table.
Run from backend directory: python scripts/migrate_menu_to_db.py
Expects services/menu_en.json, services/menu_am.json, services/menu_ru.json (or pass --dir).
"""
import json
import os
import sys
from pathlib import Path

# Add backend root to path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from db.database import get_connection, init_db, DEFAULT_DB_PATH
from db import repositories


def load_json(path: Path) -> list:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    import argparse
    p = argparse.ArgumentParser(description="Migrate menu JSON files to SQLite products")
    p.add_argument("--dir", default=str(BACKEND_ROOT / "services"), help="Directory containing menu_en.json, menu_am.json, menu_ru.json")
    p.add_argument("--db", default=DEFAULT_DB_PATH, help="SQLite DB path")
    args = p.parse_args()
    base = Path(args.dir)
    en_path = base / "menu_en.json"
    am_path = base / "menu_am.json"
    ru_path = base / "menu_ru.json"
    for p in (en_path, am_path, ru_path):
        if not p.exists():
            print(f"Missing {p}. Copy menu_*.json to {base} or use --dir.")
            sys.exit(1)

    menu_en = {item["item_id"]: item for item in load_json(en_path)}
    menu_am = {item["item_id"]: item for item in load_json(am_path)}
    menu_ru = {item["item_id"]: item for item in load_json(ru_path)}
    all_ids = sorted(set(menu_en) | set(menu_am) | set(menu_ru))

    init_db(args.db)
    conn = get_connection(args.db)
    try:
        # Check if already migrated
        existing = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        if existing > 0:
            print(f"Products table already has {existing} rows. Skip or clear first.")
            return
        for item_id in all_ids:
            e = menu_en.get(item_id) or menu_am.get(item_id) or menu_ru.get(item_id)
            img_path = "new_menu/" + e.get("image", f"{item_id}.png")
            composition = e.get("composition")
            composition_str = json.dumps(composition) if composition else None
            repositories.product_create(
                conn,
                item_id=item_id,
                price=e["price"],
                img_path=img_path,
                type_=e["type"],
                type_name=e.get("type_name", ""),
                availability=1,
                name_en=menu_en.get(item_id, {}).get("name"),
                name_am=menu_am.get(item_id, {}).get("name"),
                name_ru=menu_ru.get(item_id, {}).get("name"),
                description_en=menu_en.get(item_id, {}).get("description"),
                description_am=menu_am.get(item_id, {}).get("description"),
                description_ru=menu_ru.get(item_id, {}).get("description"),
                short_description_en=menu_en.get(item_id, {}).get("short_description"),
                short_description_am=menu_am.get(item_id, {}).get("short_description"),
                short_description_ru=menu_ru.get(item_id, {}).get("short_description"),
                composition=composition_str,
            )
        print(f"Inserted {len(all_ids)} products.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
