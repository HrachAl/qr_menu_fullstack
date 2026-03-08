# QR Menu Fullstack

A full-stack QR menu application with an AI chatbot, role-based admin panel, product and order management, and optional user registration.

## Features

- **Customer app**: Browsable menu (EN/AM/RU), cart, AI chat and recommendations, order placement (guest or logged-in).
- **SQLite database**: Products, users, orders, and order items with foreign keys and indexes.
- **Role-based auth**: JWT login/register; roles: `user`, `vip_user`, `admin`, `superadmin`.
- **Admin panel**: Dashboard, users (superadmin), products (CRUD + image upload), orders (list, detail, status), statistics (top products, top users, hourly).
- **Public API**: Menu by language, order creation (supports `item_id` from cart).

---

## Prerequisites

- **Python 3.10+** (backend)
- **Node.js 18+** and npm (frontends)
- **OpenAI API key** (for chat and recommendations)

---

## Project structure

```
qr_menu_fullstack/
├── qr_menu_backend/          # FastAPI backend
│   ├── main.py               # App entry, routes, lifespan
│   ├── config.py             # Env and paths
│   ├── models.py             # Pydantic models
│   ├── db/                   # SQLite and repositories
│   ├── auth/                 # JWT and password hashing
│   ├── routers/              # auth, admin, orders, menu
│   ├── services/             # OpenAI, stats
│   ├── scripts/              # migrate_menu_to_db.py
│   ├── admin_panel/          # Built admin SPA (from frontend build)
│   └── build/                # Built customer SPA (copy from reactmenu build)
├── qr_menu_front/
│   ├── reactmenu/            # Customer React app
│   └── admin/                # Admin React app (Vite)
└── README.md
```

---

## Backend setup

### 1. Environment

From the repo root:

```bash
cd qr_menu_backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment variables

Create a `.env` file in `qr_menu_backend/` (or export variables):

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for chat/recommendations | (required) |
| `QR_MENU_DB_PATH` | SQLite database file path | `qr_menu_backend/menu.db` |
| `JWT_SECRET` | Secret for JWT signing | `change-me-in-production` |
| `QR_MENU_UPLOAD_DIR` | Directory for uploaded product images | `qr_menu_backend/build/new_menu` |
| `SUPERADMIN_EMAIL` | Email of default superadmin (created if DB has no users) | `admin@example.com` |
| `SUPERADMIN_PASSWORD` | Password of default superadmin | `admin` |
| `SUPERADMIN_FULLNAME` | Full name of default superadmin | `Admin` |

**Production:** set a strong `JWT_SECRET` and secure `SUPERADMIN_*` or remove defaults and create the first user manually.

### 3. Database and menu data

On first run, the app creates the SQLite schema and, if there are no users, a default superadmin.

To load the initial menu from JSON into the database (if the DB is empty of products):

```bash
cd qr_menu_backend
# Use frontend menu files (more items)
python3 scripts/migrate_menu_to_db.py --dir ../qr_menu_front/reactmenu/src
# Or use backend services/ menu files
python3 scripts/migrate_menu_to_db.py
```

### 4. Run the backend

```bash
cd qr_menu_backend
python3 main.py
```

Server runs at **http://localhost:8000**.

- **Root:** `GET /` — info message  
- **Customer SPA:** `GET /build` → serves `build/index.html`  
- **Admin SPA:** `GET /admin_panel` → serves `admin_panel/index.html`  
- **API docs:** http://localhost:8000/docs  

---

## Customer frontend (reactmenu)

### Build and serve via backend

```bash
cd qr_menu_front/reactmenu
npm install
npm run build
cp -r build/* ../../qr_menu_backend/build/
```

Then open **http://localhost:8000/build** (or the route that serves the customer app).

### Development with proxy

```bash
cd qr_menu_front/reactmenu
npm install
echo "REACT_APP_API_BASE_URL=http://localhost:8000" > .env
npm start
```

Runs on port 3000 and uses the backend at 8000 for API and menu.

---

## Admin frontend

### Build (output goes to backend)

```bash
cd qr_menu_front/admin
npm install
npm run build
```

This writes the built SPA into `qr_menu_backend/admin_panel/`. No copy step needed.

### Access

With the backend running, open **http://localhost:8000/admin_panel/**.

- **Login:** `/admin_panel/#/login`  
- **Dashboard:** `/admin_panel/#/admin`  
- **Users / Products / Orders / Statistics:** from the sidebar  

**Default admin login:** **admin@example.com** / **admin**  
(Created automatically on first backend start when the database has no users. Override with env: `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_FULLNAME`.)

### Development

When running the admin with `npm run dev` (e.g. at http://localhost:5173), the app must call the backend API on port 8000. A `.env` file with `VITE_API_BASE_URL=http://localhost:8000` is included; if you open the admin at 5173 without it, login will hit 5173 and return "Not found".

```bash
cd qr_menu_front/admin
npm install
# .env with VITE_API_BASE_URL=http://localhost:8000 is already present
npm run dev
```

Keep the backend running on 8000 and use the default login above.

---

## API overview

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/menu?language=en` | Menu products (en/am/ru). |
| POST | `/api/orders` | Create order; body: `{ "items": [ { "item_id", "count" } ] }`. Optional `Authorization: Bearer <token>` to link to user. |
| POST | `/api/auth/login` | Body: `{ "email", "password" }` → JWT. |
| POST | `/api/auth/register` | Body: `{ "fullname", "email", "password", "access_level?" }` → JWT. |
| GET | `/recommend/time?language=` | Time-based recommendations. |
| POST | `/recommend/orders?language=` | Order-based recommendations (same contract as before). |
| WS | `/chat` | AI chat (JSON in/out). |

### Admin (Bearer token required)

All under `/api/admin/`; require `Authorization: Bearer <token>` and role `admin` or `superadmin` (users CRUD is superadmin only).

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/admin/users` | List, create user. |
| GET/PATCH/DELETE | `/api/admin/users/{id}` | Get, update, delete user. |
| GET/POST | `/api/admin/products` | List, create product. |
| GET/PATCH/DELETE | `/api/admin/products/{id}` | Get, update, delete product. |
| POST | `/api/admin/products/upload-image` | Upload image (multipart); returns `img_path`. |
| GET | `/api/admin/orders` | List orders (optional `?status=confirmed`). |
| GET | `/api/admin/orders/{id}` | Order detail with items. |
| PATCH | `/api/admin/orders/{id}/status` | Body: `{ "status": "created" \| "confirmed" \| "completed" }`. |
| GET | `/api/admin/stats/dashboard` | Counts and top products/users. |
| GET | `/api/admin/stats/top-products` | Top products by quantity. |
| GET | `/api/admin/stats/top-users-by-count` | Top users by order count. |
| GET | `/api/admin/stats/top-users-by-price` | Top users by total order price. |
| GET | `/api/admin/stats/hourly` | Orders per hour (optional `date_from`, `date_to`). |

---

## Database

- **File:** By default `qr_menu_backend/menu.db` (override with `QR_MENU_DB_PATH`).
- **Tables:** `users`, `products` (with `item_id` for menu compatibility), `orders`, `order_items`.
- **Schema:** Created automatically on startup in `db/database.py`. Foreign keys enabled (`PRAGMA foreign_keys = ON`).

---

## Product images

- **Storage:** Backend uses `QR_MENU_UPLOAD_DIR` (default: `qr_menu_backend/build/new_menu`). Admin uploads go there.
- **Paths:** Stored as e.g. `new_menu/filename.png`. Customer app loads them from the same origin as the app (e.g. `/build/new_menu/` when served from backend).

---

## License and support

Use and modify as needed. For issues, check env vars, DB path, and that both backend and frontend builds are in place for the URLs you use.
