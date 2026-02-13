# Быстрый старт

## 1. Установка зависимостей

```bash
./install.sh
```

## 2. Миграция данных меню

```bash
cd qr_menu_backend
source venv/bin/activate
python migrate_menu.py
cd ..
```

## 3. Создание .env файлов

### Backend (.env)
```bash
cd qr_menu_backend
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
cd ..
```

### Frontend (.env)
```bash
cd qr_menu_front/reactmenu
echo "REACT_APP_API_URL=http://localhost:8000" > .env
cd ../..
```

## 4. Запуск приложения

### Терминал 1 - Backend:
```bash
./start_backend.sh
```

### Терминал 2 - Frontend:
```bash
./start_frontend.sh
```

## 5. Доступ к приложению

- **Основное приложение**: http://localhost:3000
- **Вход для пользователей**: http://localhost:3000/login
- **Вход в админ панель**: http://localhost:3000/admin/login
- **Админ панель**: http://localhost:3000/admin
- **API документация**: http://localhost:8000/docs

## Учетные данные админа

- **Логин**: admin
- **Пароль**: 123456

**Важно**: Для входа в админ панель используйте `/admin/login`, а не `/login`

## Что дальше?

1. Войдите в админ панель
2. Создайте новые продукты или управляйте существующими
3. Добавьте/удалите продукты из меню
4. Просматривайте статистику заказов и событий

## Структура данных

Все данные хранятся в `qr_menu_backend/data/`:
- `users.json` - пользователи
- `products.json` - все продукты
- `menu.json` - ID продуктов в меню
- `orders.json` - заказы
- `events.json` - события пользователей

## Возможные проблемы

### Backend не запускается
- Проверьте, что создан .env файл с OPENAI_API_KEY
- Убедитесь, что виртуальное окружение активировано
- Проверьте, что порт 8000 свободен

### Frontend не запускается
- Убедитесь, что установлены node_modules: `npm install`
- Проверьте, что создан .env файл
- Проверьте, что порт 3000 свободен

### Ошибки CORS
- Убедитесь, что backend запущен на http://localhost:8000
- Проверьте REACT_APP_API_URL в .env файле frontend

## Дополнительная информация

Смотрите `README.md` для полной документации.
