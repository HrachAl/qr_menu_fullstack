# Руководство по миграции данных

## Миграция существующих данных меню

У вас уже есть файлы меню в `qr_menu_backend/services/`:
- `menu_am.json`
- `menu_en.json`
- `menu_ru.json`

Эти файлы содержат полные данные о продуктах на разных языках.

### Шаг 1: Создание скрипта миграции

Создайте файл `qr_menu_backend/migrate_menu.py`:

```python
import json

# Читаем армянское меню (основной язык)
with open('services/menu_am.json', 'r', encoding='utf-8') as f:
    menu_am = json.load(f)

# Создаем products.json из армянского меню
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
menu_ids = [item["item_id"] for item in menu_am]
with open('data/menu.json', 'w', encoding='utf-8') as f:
    json.dump(menu_ids, f, ensure_ascii=False, indent=2)

print(f"Миграция завершена!")
print(f"Создано продуктов: {len(products)}")
print(f"Добавлено в меню: {len(menu_ids)}")
```

### Шаг 2: Запуск миграции

```bash
cd qr_menu_backend
source venv/bin/activate
python migrate_menu.py
```

### Шаг 3: Проверка

После миграции проверьте файлы:
- `data/products.json` - должен содержать все продукты
- `data/menu.json` - должен содержать все ID продуктов

## Мультиязычность

### Текущая реализация

Сейчас в админ-панели продукты создаются только на армянском языке.

### Для полной мультиязычности

Если нужна полная поддержка 3 языков в админке:

1. Расширьте модель Product:
```python
class Product(BaseModel):
    item_id: int
    name_am: str
    name_en: str
    name_ru: str
    description_am: str
    description_en: str
    description_ru: str
    # и т.д.
```

2. Обновите формы в админке для ввода данных на всех языках

3. В LangContext.js загружайте данные из API вместо локальных JSON файлов:
```javascript
useEffect(() => {
    fetch(`${API_URL}/api/products`)
        .then(res => res.json())
        .then(data => {
            // Фильтруйте по языку
            const langData = data.map(item => ({
                ...item,
                name: item[`name_${lang.toLowerCase()}`],
                description: item[`description_${lang.toLowerCase()}`]
            }));
            setLangItems(langData);
        });
}, [lang]);
```

## Важные замечания

1. **Существующий AI чат** продолжит работать с файлами в `services/menu_*.json`
2. **Новая система** (админка, заказы) работает с `data/products.json` и `data/menu.json`
3. **Рекомендуется**: После миграции использовать только новую систему
4. **Для упрощения**: Можно удалить старые JSON файлы из `services/` после миграции

## Альтернативный подход (без миграции)

Если хотите использовать существующие файлы напрямую:

1. Измените `routes/products.py`:
```python
@router.get("/products", response_model=List[Product])
async def get_menu_products():
    # Читаем из services/menu_am.json
    with open("services/menu_am.json", "r", encoding="utf-8") as f:
        products = json.load(f)
    return products
```

2. Админка будет редактировать файлы в `services/`
3. Не нужна миграция, но сложнее управлять

## Рекомендация

Используйте миграцию для чистой архитектуры и разделения данных.
