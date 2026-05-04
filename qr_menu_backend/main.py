import asyncio
from fastapi import FastAPI, Query, Request, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from services.ai_service import ChatBot, MODEL_NAME, client, STREAM_MARKER
import uvicorn
import logging
import json
from prompts import prompt_rec_time, prompt_rec_orders
from typing import Dict, List
from contextlib import asynccontextmanager
from models import EntryLog, ButtonRequests, ChatHistory, Recommendation, GPT_Message
from datetime import datetime
from services.inventory_adjustment_tasks import run_inventory_adjustment_auto_approval

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
ADMIN_PANEL_DIR = BASE_DIR / "admin_panel"
BUILD_DIR = BASE_DIR / "build"
NEW_MENU_DIR = BUILD_DIR / "new_menu"

sessions: Dict[str, ChatBot] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application starting up")
    from db.database import get_connection, init_db
    from db import repositories
    init_db()
    conn = get_connection()
    try:
        app.state.menu = repositories.product_list_as_menu_dict(conn)
        app.state.popularity = repositories.popularity_summary(conn)
        seeded_inventory = repositories.seed_inventory(conn)
        if seeded_inventory:
            logger.info("Seeded inventory with %s items", seeded_inventory)
        # Create default superadmin if no users exist (from env)
        if repositories.user_list(conn):
            pass
        else:
            import os
            from auth.service import hash_password
            email = os.getenv("SUPERADMIN_EMAIL", "admin@example.com")
            password = os.getenv("SUPERADMIN_PASSWORD", "admin")
            fullname = os.getenv("SUPERADMIN_FULLNAME", "Admin")
            repositories.user_create(conn, fullname=fullname, password=hash_password(password), access_level="superadmin", email=email)
            logger.info("Created default superadmin user")
    finally:
        conn.close()
    # Cleanup old chat sessions on startup
    try:
        result = ChatBot.cleanup_old_sessions()
        logger.info("Chat memory cleanup on startup: %s", result)
    except Exception as e:
        logger.warning("Chat cleanup failed: %s", e)

    stop_event = asyncio.Event()
    auto_approve_task = asyncio.create_task(
        run_inventory_adjustment_auto_approval(stop_event)
    )
    app.state.inventory_adjustment_stop_event = stop_event
    app.state.inventory_adjustment_task = auto_approve_task
    logger.info("Inventory adjustment auto-approve task started")

    yield

    stop_event = getattr(app.state, "inventory_adjustment_stop_event", None)
    task = getattr(app.state, "inventory_adjustment_task", None)
    if stop_event is not None:
        stop_event.set()
    if task is not None:
        try:
            await task
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("Inventory adjustment auto-approve task stopped with error: %s", e)

    sessions.clear()
    logger.info("Application shutting down")

app = FastAPI(lifespan=lifespan)

from routers import auth, admin, orders, menu, chef

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(orders.router)
app.include_router(menu.router)
app.include_router(chef.router)
app.include_router(chef.admin_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/admin_panel", StaticFiles(directory=str(ADMIN_PANEL_DIR), html=True), name="admin")
app.mount("/build", StaticFiles(directory=str(BUILD_DIR), html=True), name="main")
app.mount("/new_menu", StaticFiles(directory=str(NEW_MENU_DIR), html=True), name="new_menu")

orders = {}


@app.get("/")
async def info():
    return "Welcome to the AI Chatbot API! version 07.05, count to 0 for simillar items: test: /admin_panel"

@app.get("/api/image/{filename:path}", include_in_schema=False)
async def get_image(filename: str):
    """Serve menu images with CORS headers (for canvas share card)."""
    safe = Path(filename).name
    fpath = NEW_MENU_DIR / safe
    if not fpath.exists():
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(str(fpath), headers={"Access-Control-Allow-Origin": "*"})

@app.get("/admin_panel", include_in_schema=False)
async def admin_index():
    return FileResponse(str(ADMIN_PANEL_DIR / "index.html"))

@app.get("/build", include_in_schema=False)
async def main_page():
    return FileResponse(str(BUILD_DIR / "index.html"))

@app.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    chatbot: ChatBot | None = None
    active_session_id = "default_session"
    customer_id: int | None = None

    while True:
        try:
            data = await websocket.receive_text()
            parsed = json.loads(data)
            message = parsed.get("message")
            session_id = str(parsed.get("session_id", active_session_id) or active_session_id)

            lang = parsed.get("lang", "am")
            prompt_language = str(lang).lower()

            # Extract customer_id from token (every message until found)
            token = parsed.get("token")
            if token and customer_id is None:
                from auth.service import decode_access_token
                payload_tok = decode_access_token(token)
                if payload_tok:
                    try:
                        customer_id = int(payload_tok.get("sub"))
                    except (TypeError, ValueError):
                        customer_id = None
                    logger.info("Extracted customer_id=%s from token", customer_id)

            if not chatbot:
                menu = getattr(app.state, "menu", {})
                popularity = getattr(app.state, "popularity", [])
                # Load user dietary preferences
                user_prefs = ""
                if customer_id:
                    try:
                        from db.database import get_connection as _gc
                        from db import repositories as _repo
                        _c = _gc()
                        user_prefs = _repo.user_get_preferences(_c, int(customer_id))
                        _c.close()
                    except Exception:
                        pass
                chatbot = ChatBot(
                    websocket,
                    prompt_language=prompt_language,
                    menu=menu,
                    session_id=session_id,
                    customer_id=customer_id,
                    popularity=popularity,
                    user_preferences=user_prefs,
                )
                active_session_id = session_id
            elif customer_id and not chatbot.customer_id:
                # Token arrived after chatbot was already created — update it
                chatbot.customer_id = customer_id
                try:
                    from db.database import get_connection as _gc
                    from db import repositories as _repo
                    _c = _gc()
                    chatbot.user_preferences = _repo.user_get_preferences(_c, int(customer_id))
                    _c.close()
                except Exception:
                    pass
                logger.info("Updated chatbot with customer_id=%s", customer_id)

            active_session_id = session_id
            ChatBot.register_live_connection(
                session_id=active_session_id,
                connection=websocket,
                customer_id=customer_id,
            )

            payload = {
                "message": message,
                "language": prompt_language,
                "time": datetime.now().strftime("%H:%M"),
                "session_id": session_id,
                "order_id": parsed.get("order_id"),
            }
            await chatbot.ask(json.dumps(payload), return_only_response=True)

        except WebSocketDisconnect:
            print("Chat client disconnected.")
            ChatBot.unregister_live_connection(
                session_id=active_session_id,
                customer_id=customer_id,
                connection=websocket,
            )
            break

        except Exception as e:
            print("Error:", e)
            await websocket.send_json({"error": str(e)})

@app.post("/chat/image")
async def chat_image(
    request: Request,
    file: UploadFile = File(...),
    message: str = Form("What is this? Do you have something similar?"),
    session_id: str = Form("default_session"),
    lang: str = Form("en"),
    token: str = Form(""),
):
    """Analyze an uploaded food image and compare to menu."""
    from services.ai_service import ChatBot as _CB
    from auth.service import decode_access_token
    customer_id = None
    user_prefs = ""
    if token:
        payload_tok = decode_access_token(token)
        if payload_tok:
            customer_id = payload_tok.get("sub")
            try:
                from db.database import get_connection as _gc
                from db import repositories as _repo
                _c = _gc()
                user_prefs = _repo.user_get_preferences(_c, int(customer_id))
                _c.close()
            except Exception:
                pass
    image_bytes = await file.read()
    mime = file.content_type or "image/jpeg"
    menu = getattr(request.app.state, "menu", {})
    popularity = getattr(request.app.state, "popularity", [])
    chatbot = _CB(
        None, prompt_language=lang, menu=menu, session_id=session_id,
        customer_id=customer_id, popularity=popularity, user_preferences=user_prefs,
    )
    try:
        from google.genai import types as _types
        persona = chatbot._default_persona()
        sys_instruction = chatbot._system_instruction(persona)
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[
                _types.Content(parts=[
                    _types.Part.from_text(text=message),
                    _types.Part.from_bytes(data=image_bytes, mime_type=mime),
                ], role="user"),
            ],
            config=_types.GenerateContentConfig(
                system_instruction=sys_instruction,
                temperature=0.4,
            ),
        )
        text = response.text or ""
        # Parse structured response
        if STREAM_MARKER in text:
            parts = text.split(STREAM_MARKER, 1)
            response_text = parts[0].strip()
            try:
                json_data = json.loads(parts[1].strip())
            except Exception:
                json_data = {}
        else:
            response_text = text.strip()
            json_data = {}
        return {
            "response": response_text,
            "options": json_data.get("options", []),
            "options_description": json_data.get("options_description", ""),
            "suggestions": json_data.get("suggestions", []),
        }
    except Exception as e:
        logger.exception("Image chat error")
        return {"response": f"Error analyzing image: {str(e)}", "options": [], "options_description": "", "suggestions": []}


@app.post("/entry-log")
async def log_entry(entry: EntryLog):
    logger.info(f"Entry log received: {entry}")
    return {"status": "success", "received": entry}

@app.post("/button-requests")
async def log_button_requests(button_requests: ButtonRequests):
    logger.info(f"Button requests received: {button_requests.root}")
    return {"status": "success", "received": button_requests.root}

@app.post("/chat-history")
async def log_chat_history(chat_history: ChatHistory):
    logger.info(f"Chat history received: {chat_history.root}")
    return {"status": "success", "received": chat_history.root}

@app.post("/chat/reset")
async def reset_chat(session_id: str):
    from services.ai_service import ChatBot
    safe_id = ChatBot._sanitize_session_id(session_id)
    # Don't delete the old file — keep it for analytics.
    # Frontend already generates a new session_id, so the old file is just archived.
    logger.info(f"Chat reset requested, old session archived: {safe_id}")
    return {"status": "ok", "session_id": safe_id}

@app.get("/recommend/time", response_model=List[Recommendation])
async def recommend_by_time(request: Request, language: str = "en", session_id: str = "default_session"):
    language = language.lower()
    menu = getattr(request.app.state, "menu", {})
    chatbot = ChatBot(None, prompt_language=language, menu=menu, session_id=session_id)
    prompt = prompt_rec_time[language].format(current_time=datetime.now().strftime("%H:%M"))
    payload = {
        "message": prompt,
        "language": language,
        "time": datetime.now().strftime("%H:%M"),
        "session_id": session_id,
    }
    response = await chatbot.ask(json.dumps(payload), return_only_response=True)
    return response.options or []

@app.post("/recommend/orders", response_model=GPT_Message)
async def recommend_by_orders(
    request: Request,
    button_requests: ButtonRequests,
    language: str = "en",
    session_id: str = "default_session",
):
    language = language.lower()
    user_id = session_id
    new_orders = set(req.id for req in button_requests.root)
    if not orders.get(user_id) or orders.get(user_id) != new_orders:
        orders[user_id] = {
            "orders": new_orders,
            "response": None
        }
    elif orders[user_id]["response"]:
        return orders[user_id]["response"]
    menu = getattr(request.app.state, "menu", {})
    chatbot = ChatBot(None, prompt_language=language, menu=menu, session_id=session_id)
    order_summary = ", ".join([f"Button ID {req.id} at {req.timestamp}" for req in button_requests.root])
    prompt = prompt_rec_orders[language].format(orders=order_summary)
    payload = {
        "message": prompt,
        "language": language,
        "time": datetime.now().strftime("%H:%M"),
        "session_id": session_id,
    }
    response = await chatbot.ask(json.dumps(payload), return_only_response=True)
    orders[user_id]['response'] = response
    return response

def run_server():
    try:
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            log_level="info",
            timeout_keep_alive=30
        )
    except Exception as e:
        logger.error(f"Server failed to start: {str(e)}")
        raise

if __name__ == "__main__":
    run_server()