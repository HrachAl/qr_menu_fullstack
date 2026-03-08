"""
Statistics: top products, top users by count/price, hourly orders.
"""
import sqlite3
from typing import Optional


def top_products(conn: sqlite3.Connection, limit: int = 5) -> list[dict]:
    """Top products by total quantity ordered (all orders regardless of status)."""
    rows = conn.execute("""
        SELECT p.id, p.item_id, p.name_en AS name, p.img_path, SUM(oi.count) AS total
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        GROUP BY oi.product_id
        ORDER BY total DESC
        LIMIT ?
    """, (limit,)).fetchall()
    return [dict(zip(r.keys(), r)) for r in rows]


def top_users_by_order_count(conn: sqlite3.Connection, limit: int = 5) -> list[dict]:
    rows = conn.execute("""
        SELECT u.id, u.fullname, u.email, COUNT(o.id) AS order_count
        FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE o.user_id IS NOT NULL
        GROUP BY o.user_id
        ORDER BY order_count DESC
        LIMIT ?
    """, (limit,)).fetchall()
    return [dict(zip(r.keys(), r)) for r in rows]


def top_users_by_order_price(conn: sqlite3.Connection, limit: int = 5) -> list[dict]:
    rows = conn.execute("""
        SELECT u.id, u.fullname, u.email, SUM(o.price) AS total_price
        FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE o.user_id IS NOT NULL
        GROUP BY o.user_id
        ORDER BY total_price DESC
        LIMIT ?
    """, (limit,)).fetchall()
    return [dict(zip(r.keys(), r)) for r in rows]


def hourly_orders(conn: sqlite3.Connection, date_from: Optional[str] = None, date_to: Optional[str] = None) -> list[dict]:
    q = """
        SELECT strftime('%H', created_at) AS hour, COUNT(*) AS count
        FROM orders
        WHERE 1=1
    """
    params = []
    if date_from:
        q += " AND date(created_at) >= date(?)"
        params.append(date_from)
    if date_to:
        q += " AND date(created_at) <= date(?)"
        params.append(date_to)
    q += " GROUP BY hour ORDER BY hour"
    rows = conn.execute(q, params).fetchall()
    return [dict(zip(r.keys(), r)) for r in rows]
