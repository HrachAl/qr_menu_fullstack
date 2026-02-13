import json
import os

print("=================================")
print("QR Menu - Data Migration Script")
print("=================================")

# Читаем армянское меню (основной язык)
print("\nReading menu_am.json...")
with open('services/menu_am.json', 'r', encoding='utf-8') as f:
    menu_am = json.load(f)

# Создаем products.json из армянского меню
print("Creating products.json...")
products = []
for item in menu_am:
    products.append({
        "item_id": item["item_id"],
        "name": item["name"],
        "description": item["description"],
        "short_description": item["short_description"],
        "price": item["price"],
        "composition": item["composition"],
        "type": item["type"],
        "type_name": item.get("type_name", item["type"]),
        "image": item["image"]
    })

# Сохраняем products.json
with open('data/products.json', 'w', encoding='utf-8') as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

# Создаем menu.json со всеми ID продуктов
print("Creating menu.json...")
menu_ids = [item["item_id"] for item in menu_am]
with open('data/menu.json', 'w', encoding='utf-8') as f:
    json.dump(menu_ids, f, ensure_ascii=False, indent=2)

print("\n=================================")
print("Migration completed successfully!")
print("=================================")
print(f"Products created: {len(products)}")
print(f"Items added to menu: {len(menu_ids)}")
print("\nFiles created:")
print("  - data/products.json")
print("  - data/menu.json")
print("\nYou can now start the backend server!")
print("=================================")
