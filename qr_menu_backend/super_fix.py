import sqlite3
import os

# 1. Գտնել .db ֆայլը ընթացիկ պանակում
db_files = [f for f in os.listdir('.') if f.endswith('.db')]
if not db_files:
    print("Սխալ: .db ֆայլ չի գտնվել այս պանակում:")
    exit()

db_name = db_files[0]
print(f"Վերանորոգվում է {db_name} բազան...")

conn = sqlite3.connect(db_name)
conn.execute("PRAGMA foreign_keys = OFF")
conn.execute("PRAGMA writable_schema = ON")

# 2. Ուղղել orders_old հղումները բոլոր աղյուսակներում (հատկապես order_items-ում)
tables = conn.execute("SELECT name, sql FROM sqlite_master WHERE type='table'").fetchall()
for name, sql in tables:
    if sql and "orders_old" in sql:
        new_sql = sql.replace("orders_old", "orders")
        conn.execute("UPDATE sqlite_master SET sql = ? WHERE type = 'table' AND name = ?", (new_sql, name))
        print(f" [+] Ուղղվեց Foreign Key-ն '{name}' աղյուսակում:")

# 3. Ուղղել հին ստատուսների անունները orders աղյուսակում
orders_row = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").fetchone()
if orders_row and orders_row[0]:
    new_sql = orders_row[0].replace("'created'", "'pending'").replace("'confirmed'", "'preparing'")
    conn.execute("UPDATE sqlite_master SET sql = ? WHERE type = 'table' AND name = 'orders'", (new_sql,))
    print(" [+] Ուղղվեցին ստատուսները 'orders' աղյուսակում:")

conn.execute("PRAGMA writable_schema = OFF")

# 4. Թարմացնել առկա տվյալների անունները բազայում
conn.execute("UPDATE orders SET status = 'pending' WHERE status = 'created'")
conn.execute("UPDATE orders SET status = 'preparing' WHERE status = 'confirmed'")

conn.commit()
conn.close()
print("Բազան հաջողությամբ վերականգնված և մաքրված է! Կարող եք միացնել սերվերը:")