"""One-time migration runner for Phase 1 chef workflow schema changes.

Run from backend directory:
    python scripts/migrate_phase1_chef_schema.py
"""

import argparse
import sys
from pathlib import Path

# Add backend root to path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from db.database import DEFAULT_DB_PATH, get_connection, init_schema


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply Phase 1 schema migration for chef workflow tables"
    )
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help="SQLite DB path")
    args = parser.parse_args()

    conn = get_connection(args.db)
    try:
        init_schema(conn)
        print("Phase 1 schema migration applied successfully.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()