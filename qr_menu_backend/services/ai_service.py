from __future__ import annotations
# pyright: reportMissingImports=false, reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownParameterType=false, reportMissingTypeArgument=false, reportUnnecessaryIsInstance=false

import asyncio
import json
import logging
import re
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from google import genai  # type: ignore[reportMissingImports]
    from google.genai import types  # type: ignore[reportMissingImports]
except Exception:  # pragma: no cover
    genai = None  # type: ignore[assignment]
    types = None  # type: ignore[assignment]

from config import GEMINI_API_KEY
from models import GPT_Message
from prompts import PROMPT_DICT

logger = logging.getLogger(__name__)

MODEL_NAME = "gemini-3.1-flash-lite-preview"
BACKEND_ROOT = Path(__file__).resolve().parent.parent
CHAT_MEMORY_DIR = BACKEND_ROOT / "chat_memory"
SUMMARY_TRIGGER_MESSAGES = 10
PERSONA_MIN = 0
PERSONA_MAX = 10
DAILY_MESSAGE_LIMIT = 500
STREAM_MARKER = "<<<JSON>>>"
MODIFICATION_NONE = "NONE"
MODIFICATION_SIMPLE = "SIMPLE"
MODIFICATION_COMPLEX = "COMPLEX"
CHEF_HOLDING_MESSAGE = "I am checking with the chef right now..."
CHEF_REPLY_REWRITE_SYSTEM_PROMPT = (
    "You are a polite restaurant assistant. Rewrite the following raw message from the chef to the customer. "
    "Filter out any harsh, informal, or unprofessional language. Make it extremely hospitable and professional."
)


def _build_client() -> Optional[Any]:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is still missing after hard-load.")
    if genai is None:
        return None
    return genai.Client(api_key=GEMINI_API_KEY)


client = _build_client()


SESSION_MAX_AGE_DAYS = 30
SESSION_MAX_PER_USER = 50


class ChatBot:
    _active_session_connections: Dict[str, Any] = {}
    _active_customer_connections: Dict[int, Any] = {}
    _connections_lock = threading.Lock()

    def __init__(
        self,
        connection: Any,
        prompt_language: str = "am",
        menu: Optional[Dict[Any, Any]] = None,
        session_id: Optional[str] = None,
        customer_id: Optional[int] = None,
        popularity: Optional[List[Dict[str, Any]]] = None,
        user_preferences: Optional[str] = None,
    ):
        self.connection = connection
        self.language = prompt_language.lower()
        self.menu = menu or {}
        self.session_id = self._sanitize_session_id(session_id)
        self.customer_id = customer_id
        self.popularity = popularity or []
        self.user_preferences = (user_preferences or "").strip()
        self.memory_file_path = self._build_memory_file_path(self.session_id)
        self.user_message_times: List[str] = []
        self.menu_by_id = self._normalize_menu(self.menu)

    @classmethod
    def register_live_connection(
        cls,
        session_id: str,
        connection: Any,
        customer_id: Optional[int] = None,
    ) -> None:
        safe_session_id = cls._sanitize_session_id(session_id)
        with cls._connections_lock:
            cls._active_session_connections[safe_session_id] = connection
            if customer_id is not None:
                try:
                    customer_key = int(customer_id)
                except (TypeError, ValueError):
                    customer_key = None
                if customer_key is not None:
                    cls._active_customer_connections[customer_key] = connection

    @classmethod
    def unregister_live_connection(
        cls,
        session_id: Optional[str] = None,
        customer_id: Optional[int] = None,
        connection: Any = None,
    ) -> None:
        with cls._connections_lock:
            if session_id is not None:
                safe_session_id = cls._sanitize_session_id(session_id)
                existing = cls._active_session_connections.get(safe_session_id)
                if existing is not None and (connection is None or existing is connection):
                    cls._active_session_connections.pop(safe_session_id, None)
            if customer_id is not None:
                try:
                    customer_key = int(customer_id)
                except (TypeError, ValueError):
                    customer_key = None
                if customer_key is not None:
                    existing = cls._active_customer_connections.get(customer_key)
                    if existing is not None and (connection is None or existing is connection):
                        cls._active_customer_connections.pop(customer_key, None)

    @classmethod
    async def push_message_to_customer(cls, customer_id: int, payload: Dict[str, Any]) -> bool:
        try:
            customer_key = int(customer_id)
        except (TypeError, ValueError):
            return False

        with cls._connections_lock:
            connection = cls._active_customer_connections.get(customer_key)
        if connection is None:
            return False

        try:
            await connection.send_json(payload)
            return True
        except Exception:
            logger.exception("Failed to push message to live customer connection", extra={"customer_id": customer_key})
            cls.unregister_live_connection(customer_id=customer_key, connection=connection)
            return False

    @staticmethod
    def _sanitize_session_id(session_id: Optional[str]) -> str:
        raw = str(session_id or "default_session").strip()
        safe = re.sub(r"[^a-zA-Z0-9_-]", "_", raw)
        safe = safe.strip("._")
        return safe or "default_session"

    @staticmethod
    def _build_memory_file_path(session_id: str) -> Path:
        CHAT_MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        return CHAT_MEMORY_DIR / f"{session_id}.txt"

    @staticmethod
    def _normalize_menu(menu: Dict[Any, Any]) -> Dict[int, Dict[str, Any]]:
        normalized: Dict[int, Dict[str, Any]] = {}
        for raw_key, value in menu.items():
            try:
                item_id = int(raw_key)
            except (ValueError, TypeError):
                continue
            if isinstance(value, dict):
                normalized[item_id] = value
        return normalized

    def _menu_snapshot(self) -> str:
        if not self.menu_by_id:
            return "{}"
        return json.dumps(self.menu_by_id, ensure_ascii=False)

    def _popularity_context(self) -> str:
        if not self.popularity:
            return ""
        lines = ", ".join(f"{p['name']} ({p['total_orders']}x)" for p in self.popularity[:10])
        return f"POPULARITY DATA (mention naturally when relevant): Most ordered items: {lines}\n"

    def _preferences_context(self) -> str:
        if not self.user_preferences:
            return ""
        return f"USER DIETARY PREFERENCES (ALWAYS respect these): {self.user_preferences}\n"

    @staticmethod
    def _default_persona() -> Dict[str, int]:
        return {"humor": 5, "formality": 5, "analytical_detail": 5}

    @classmethod
    def _normalize_persona_scores(cls, persona: Any) -> Dict[str, int]:
        base = cls._default_persona()
        if not isinstance(persona, dict):
            return base
        normalized = dict(base)
        for key in base:
            try:
                raw_value = int(persona.get(key, base[key]))
            except (TypeError, ValueError):
                raw_value = base[key]
            normalized[key] = max(PERSONA_MIN, min(PERSONA_MAX, raw_value))
        return normalized

    def _system_instruction(self, persona: Dict[str, int]) -> str:
        language_prompt = PROMPT_DICT.get(self.language, PROMPT_DICT["en"])

        humor = int(persona.get("humor", 5))
        formality = int(persona.get("formality", 5))
        analytical_detail = int(persona.get("analytical_detail", 5))

        if humor <= 3:
            humor_rule = "You are a very serious and focused waiter. No jokes."
        elif humor <= 6:
            humor_rule = "You are a polite waiter with a warm, mild sense of humor."
        else:
            humor_rule = "You are a highly engaging, funny, and casual waiter. Use jokes and a relaxed tone."

        if formality <= 3:
            formality_rule = "Speak casually and intimately, like a close friend."
        elif formality <= 6:
            formality_rule = "Speak with standard professional restaurant etiquette."
        else:
            formality_rule = "Speak with aristocratic, highly respectful formal language."

        if analytical_detail <= 3:
            detail_rule = "Keep food descriptions very brief. Only mention the main items."
        elif analytical_detail <= 6:
            detail_rule = "Provide standard, appetizing food descriptions."
        else:
            detail_rule = "You are an expert, confident nutritionist. Confidently suggest a combination of compatible dishes to hit the user's macro/calorie goals. DO NOT apologize or say it is 'difficult with a single dish'. Just elegantly present the combined meal, state the total macros and calories seamlessly."

        return (
            f"{language_prompt}\n\n"
            "CRITICAL LANGUAGE RULE: ALWAYS respond in the exact same language the user writes in. Never mix languages.\n"
            "NATURAL CONVERSATION RULE: NEVER mention internal database IDs to the user. Always use the natural name of the product.\n"
            "Conversational Flow: NEVER repeat greetings if you have already greeted the user in this session.\n"
            f"PERSONA HUMOR RULE (score={humor}): {humor_rule}\n"
            f"PERSONA FORMALITY RULE (score={formality}): {formality_rule}\n"
            f"PERSONA ANALYTICAL DETAIL RULE (score={analytical_detail}): {detail_rule}\n"
            "DIETARY FLEXIBILITY RULE: NEVER say a diet is impossible. Find the closest matching combination from the menu.\n"
            "NUTRITIONAL KNOWLEDGE RULE: If the user asks about macronutrients and the data is NOT in the menu, use your internal AI knowledge to estimate confidently.\n"
            "Time Handling: Current time is for internal context only. DO NOT state the time to the user unless asked.\n"
            "RECIPE TRANSPARENCY RULE: If asked about ingredients, list them with precise quantities.\n"
            "COOKING TIME RULE: If a menu item has cooking_time (minutes), mention it naturally when recommending (e.g. 'ready in ~15 min').\n"
            "FOOD MODIFICATION CLASSIFICATION RULES:\n"
            " - If the user requests changing a dish (remove/add ingredient, cooking style tweak, seasoning change), classify it.\n"
            " - SIMPLE: one clear, low-risk change (examples: 'no salt', 'without meat', 'extra sauce').\n"
            " - COMPLEX: multiple constraints, unclear execution, or conflicting preparation details (example: 'double boiled meat but no potatoes').\n"
            " - If the message is not a modification request at all, set modification_classification to NONE.\n"
            " - If modification_classification is COMPLEX, PART 1 must ONLY be a short holding message that you are checking with the chef now. Do NOT provide a final decision.\n"
            f"{self._popularity_context()}"
            f"{self._preferences_context()}"
            "STRICT FIELD ROLES:\n"
            "MODE 1 — RECOMMENDATION (user asks for suggestions/wants to order):\n"
            " - PART 1 text: short 1-2 sentence polite acknowledgment only.\n"
            " - <<<JSON>>> options: array of recommended items.\n"
            " - <<<JSON>>> options_description: detailed description, macros, calories in natural flowing sentences.\n"
            "MODE 2 — CONVERSATIONAL Q&A (user asks a question or chats):\n"
            " - PART 1 text: your full detailed answer.\n"
            " - <<<JSON>>> options: []\n"
            " - <<<JSON>>> options_description: \"\"\n"
            "persona_update values MUST be RELATIVE MODIFIERS (deltas), not absolute scores.\n"
            "Menu JSON is included below as the source of truth for item IDs and names.\n"
            f"{self._menu_snapshot()}\n\n"
            "OUTPUT FORMAT — You MUST use this exact two-part structure:\n"
            "PART 1: Write ONLY the plain conversational response text. No JSON, no code blocks, no brackets.\n"
            f"PART 2: On a new line write {STREAM_MARKER} then immediately the JSON object:\n"
            f'{STREAM_MARKER}{{"options":[{{"item_id":123,"count":1}}],"options_description":"...","persona_update":{{"humor":0,"formality":0,"analytical_detail":0}},"suggestions":["short follow-up 1","short follow-up 2","short follow-up 3"],"dietary_update":"","modification_classification":"NONE"}}\n'
            "suggestions: 3 short follow-up questions in the SAME language as the user. Max 6 words each. Make them contextually relevant.\n"
            "dietary_update: If the user mentions ANY dietary preference, allergy, or restriction (e.g. 'I am vegan', 'allergic to nuts', 'no gluten'), set this to a short summary like 'vegan' or 'nut allergy, gluten-free'. Otherwise leave empty string.\n"
            "modification_classification: MUST be exactly one of NONE, SIMPLE, COMPLEX.\n"
            "If no recommendations, set options to [] and options_description to \"\".\n"
            "IMPORTANT: The <<<JSON>>> marker must appear on its own line. No text after the JSON.\n"
        )

    @staticmethod
    def _default_memory_state() -> Dict[str, Any]:
        return {
            "summary": "",
            "messages": [],
            "persona": ChatBot._default_persona(),
            "daily": {"date": "", "count": 0},
            "customer_id": None,
            "created_at": "",
            "updated_at": "",
        }

    @staticmethod
    def _normalize_persona_update(update: Any) -> Dict[str, int]:
        out = {"humor": 0, "formality": 0, "analytical_detail": 0}
        if not isinstance(update, dict):
            return out
        for key in out:
            try:
                out[key] = int(update.get(key, 0))
            except (TypeError, ValueError):
                out[key] = 0
        return out

    @staticmethod
    def _normalize_modification_classification(value: Any) -> str:
        text = str(value or "").strip().upper()
        if text in {MODIFICATION_SIMPLE, MODIFICATION_COMPLEX}:
            return text
        return MODIFICATION_NONE

    @staticmethod
    def _normalize_message_list(messages: Any) -> List[Dict[str, str]]:
        if not isinstance(messages, list):
            return []
        out: List[Dict[str, str]] = []
        for item in messages:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role", "")).strip().lower()
            if role == "assistant":
                role = "model"
            if role not in {"user", "model"}:
                continue
            text = str(item.get("text", "")).strip()
            if not text:
                continue
            out.append({"role": role, "text": text})
        return out

    def _read_previous_context(self) -> Dict[str, Any]:
        try:
            if not self.memory_file_path.exists():
                return self._default_memory_state()
            raw = self.memory_file_path.read_text(encoding="utf-8").strip()
            if not raw:
                return self._default_memory_state()
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                return {"summary": raw, "messages": [], "persona": self._default_persona(), "daily": {"date": "", "count": 0}}
            if not isinstance(parsed, dict):
                return self._default_memory_state()
            summary = str(parsed.get("summary", "") or "").strip()
            messages = self._normalize_message_list(parsed.get("messages", []))
            persona = self._normalize_persona_scores(parsed.get("persona"))
            daily = parsed.get("daily", {"date": "", "count": 0})
            if not isinstance(daily, dict):
                daily = {"date": "", "count": 0}
            customer_id = parsed.get("customer_id")
            created_at = str(parsed.get("created_at", "") or "")
            updated_at = str(parsed.get("updated_at", "") or "")
            return {
                "summary": summary, "messages": messages, "persona": persona, "daily": daily,
                "customer_id": customer_id, "created_at": created_at, "updated_at": updated_at,
            }
        except Exception:
            logger.exception("Failed to read chat memory", extra={"session_id": self.session_id})
            return self._default_memory_state()

    def _write_updated_context(self, state: Dict[str, Any]) -> None:
        try:
            summary = str(state.get("summary", "") or "").strip()
            messages = self._normalize_message_list(state.get("messages", []))
            persona = self._normalize_persona_scores(state.get("persona"))
            daily = state.get("daily", {"date": "", "count": 0})
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            created_at = state.get("created_at") or now
            customer_id = self.customer_id or state.get("customer_id")
            payload = {
                "summary": summary, "messages": messages, "persona": persona, "daily": daily,
                "customer_id": customer_id, "created_at": created_at, "updated_at": now,
            }
            self.memory_file_path.write_text(
                json.dumps(payload, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception:
            logger.exception("Failed to write chat memory", extra={"session_id": self.session_id})

    def _normalize_options(self, options: Any) -> List[Dict[str, Any]]:
        if not isinstance(options, list):
            return []
        normalized_options: List[Dict[str, Any]] = []
        normalized_item_ids: List[int] = []
        for rec in options:
            if not isinstance(rec, dict):
                continue
            raw_item_id = rec.get("item_id")
            if raw_item_id is None:
                continue
            try:
                item_id = int(raw_item_id)
            except (ValueError, TypeError):
                continue
            if self.menu_by_id and item_id not in self.menu_by_id:
                continue
            reason = str(rec.get("reason", "")).strip()
            count = rec.get("count", 0)
            if not isinstance(count, int):
                try:
                    count = int(count)
                except (ValueError, TypeError):
                    count = 0
            normalized_options.append({"item_id": item_id, "reason": reason, "count": count})
            normalized_item_ids.append(item_id)
        if normalized_item_ids and self.menu_by_id:
            types_unique = {
                self.menu_by_id[item_id].get("type")
                for item_id in normalized_item_ids
                if item_id in self.menu_by_id
            }
            if len(types_unique) <= 2:
                for rec in normalized_options:
                    rec["count"] = 0
        return normalized_options

    def _parse_split_response(self, accumulated: str) -> Dict[str, Any]:
        """Parse the split format: text <<<JSON>>> {...}"""
        if STREAM_MARKER in accumulated:
            parts = accumulated.split(STREAM_MARKER, 1)
            text_part = parts[0].strip()
            json_raw = parts[1].strip()
        else:
            # Fallback: try to parse entire thing as JSON (old format compat)
            text_part = ""
            json_raw = accumulated.strip()

        json_clean = json_raw
        if json_clean.startswith("```"):
            lines = json_clean.splitlines()
            if len(lines) > 1:
                lines = lines[1:]
                if lines and lines[-1].strip().startswith("```"):
                    lines = lines[:-1]
                json_clean = "\n".join(lines).strip()
            else:
                json_clean = json_clean.strip("`").strip()
                if json_clean.lower().startswith("json"):
                    json_clean = json_clean[4:].strip()

        # Parse JSON part
        options: List[Dict[str, Any]] = []
        options_description = ""
        persona_update: Dict[str, int] = {"humor": 0, "formality": 0, "analytical_detail": 0}
        suggestions: List[str] = []
        dietary_update = ""
        modification_classification = MODIFICATION_NONE

        if json_clean:
            try:
                parsed = json.loads(json_clean)
                if isinstance(parsed, dict):
                    options = self._normalize_options(parsed.get("options", []))
                    options_description = str(parsed.get("options_description", "") or "").strip()
                    persona_update = self._normalize_persona_update(parsed.get("persona_update"))
                    raw_suggestions = parsed.get("suggestions", [])
                    if isinstance(raw_suggestions, list):
                        suggestions = [str(s).strip() for s in raw_suggestions if str(s).strip()][:4]
                    dietary_update = str(parsed.get("dietary_update", "") or "").strip()
                    modification_classification = self._normalize_modification_classification(
                        parsed.get("modification_classification")
                    )
                    # Fallback if text_part is empty but JSON has response field
                    if not text_part:
                        text_part = str(parsed.get("response", "") or "").strip()
            except json.JSONDecodeError:
                # JSON didn't parse — treat everything as text
                if not text_part:
                    text_part = accumulated.strip()

        return {
            "response": text_part,
            "options": options if options else None,
            "options_description": options_description,
            "persona_update": persona_update,
            "suggestions": suggestions,
            "dietary_update": dietary_update,
            "modification_classification": modification_classification,
            "_raw_text": accumulated,
        }

    async def _generate(
        self,
        current_time: str,
        summary: str,
        messages: List[Dict[str, str]],
        persona: Dict[str, int],
    ) -> Dict[str, Any]:
        if client is None:
            raise RuntimeError("GEMINI_API_KEY is missing. Set it in environment/.env.")
        if types is None:
            raise RuntimeError("google-genai package is not installed.")

        time_key = f"{self.language}_time"
        time_prompt = PROMPT_DICT.get(time_key, PROMPT_DICT.get("en_time", "Current time is {current_time}"))
        contextual_input = (
            f"{time_prompt.format(current_time=current_time)}\n\n"
            f"Previous Summary:\n{summary or '(empty)'}\n\n"
            f"Recent Messages (JSON):\n{json.dumps(messages, ensure_ascii=False)}"
        )

        config_kwargs: Dict[str, Any] = {
            "temperature": 0.4,
            "system_instruction": self._system_instruction(persona),
            # No response_mime_type — using <<<JSON>>> split format for streaming
        }

        loop = asyncio.get_event_loop()
        queue: asyncio.Queue = asyncio.Queue()

        def _producer() -> None:
            try:
                stream = client.models.generate_content_stream(
                    model=MODEL_NAME,
                    contents=contextual_input,
                    config=types.GenerateContentConfig(**config_kwargs),
                )
                for chunk in stream:
                    text = getattr(chunk, "text", None)
                    if text:
                        loop.call_soon_threadsafe(queue.put_nowait, text)
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, exc)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        threading.Thread(target=_producer, daemon=True).start()

        accumulated = ""
        sent_text_length = 0
        marker_found = False

        while True:
            item = await queue.get()
            if item is None:
                break
            if isinstance(item, Exception):
                raise item

            accumulated += item

            if not marker_found:
                if STREAM_MARKER in accumulated:
                    marker_found = True
                    text_before_marker = accumulated.split(STREAM_MARKER, 1)[0]
                    # Send any remaining text before the marker
                    unsent = text_before_marker[sent_text_length:]
                    if unsent.strip() and self.connection:
                        await self.connection.send_json({"chunk": unsent, "streaming": True})
                    sent_text_length = len(text_before_marker)
                else:
                    # Stream text chunks to frontend
                    unsent = accumulated[sent_text_length:]
                    if unsent and self.connection:
                        await self.connection.send_json({"chunk": unsent, "streaming": True})
                    sent_text_length = len(accumulated)

        return self._parse_split_response(accumulated)

    async def _summarize_messages(self, summary: str, messages: List[Dict[str, str]]) -> str:
        if client is None:
            raise RuntimeError("GEMINI_API_KEY is missing.")
        if types is None:
            raise RuntimeError("google-genai package is not installed.")

        summarization_prompt = (
            "You are an AI summarizer. "
            f"Previous Summary: {summary}. "
            f"Recent Messages: {json.dumps(messages, ensure_ascii=False)}. "
            "Write a concise, comprehensive summary of the user's preferences, language, and ongoing order status. "
            "Return ONLY the new summary text."
        )

        def _call_model() -> Any:
            return client.models.generate_content(
                model=MODEL_NAME,
                contents=summarization_prompt,
                config=types.GenerateContentConfig(temperature=0.2),
            )

        response = await asyncio.to_thread(_call_model)
        text = getattr(response, "text", None)
        return str(text or "").strip()

    def _resolve_target_order_id(self, explicit_order_id: Optional[int]) -> Optional[int]:
        try:
            from db.database import get_connection
            from db import repositories as repo
            db_conn = get_connection()
            try:
                if explicit_order_id is not None:
                    try:
                        explicit_id = int(explicit_order_id)
                    except (TypeError, ValueError):
                        explicit_id = None
                    if explicit_id is not None:
                        order = repo.order_get_by_id(db_conn, explicit_id)
                        if order:
                            return int(order["id"])
                if self.customer_id is not None:
                    active = repo.order_latest_active_for_user(db_conn, int(self.customer_id))
                    if active:
                        return int(active["id"])
            finally:
                db_conn.close()
        except Exception:
            logger.exception("Failed to resolve target order id for modification routing")
        return None

    def _persist_modification_record(
        self,
        order_id: int,
        request_text: str,
        classification: str,
        customer_reply: str,
    ) -> Optional[dict]:
        try:
            from db.database import get_connection
            from db import repositories as repo
            db_conn = get_connection()
            try:
                if classification == MODIFICATION_SIMPLE:
                    return repo.ai_chef_message_create(
                        db_conn,
                        order_id=order_id,
                        complex_request_text=request_text,
                        status="delivered_to_customer",
                        chef_reply_text="AUTO_APPROVED_SIMPLE",
                        ai_filtered_reply=customer_reply,
                    )
                if classification == MODIFICATION_COMPLEX:
                    return repo.ai_chef_message_create(
                        db_conn,
                        order_id=order_id,
                        complex_request_text=request_text,
                        status="pending_chef",
                        chef_reply_text=None,
                        ai_filtered_reply=None,
                    )
            finally:
                db_conn.close()
        except Exception:
            logger.exception("Failed to persist modification routing record")
        return None

    @classmethod
    def rewrite_chef_reply_for_customer(
        cls,
        customer_request_text: str,
        chef_reply_text: str,
    ) -> str:
        cleaned_raw = str(chef_reply_text or "").strip()
        if not cleaned_raw:
            return ""

        if client is None or types is None:
            return cleaned_raw

        prompt = (
            "Customer request:\n"
            f"{str(customer_request_text or '').strip()}\n\n"
            "Raw chef reply:\n"
            f"{cleaned_raw}\n\n"
            "Return only the rewritten customer-facing message."
        )

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=CHEF_REPLY_REWRITE_SYSTEM_PROMPT,
                temperature=0.2,
            ),
        )
        rewritten = str(getattr(response, "text", "") or "").strip()
        return rewritten or cleaned_raw

    @classmethod
    async def process_chef_reply_delivery(cls, ai_chef_message_id: int) -> Dict[str, Any]:
        from db.database import get_connection
        from db import repositories as repo

        db_conn = get_connection()
        try:
            record = repo.ai_chef_message_get_enriched(db_conn, ai_chef_message_id)
            if not record:
                raise ValueError("AI chef message not found")
            chef_reply_text = str(record.get("chef_reply_text", "") or "").strip()
            if not chef_reply_text:
                raise ValueError("Chef reply text is empty")

            filtered_reply = await asyncio.to_thread(
                cls.rewrite_chef_reply_for_customer,
                str(record.get("complex_request_text", "") or ""),
                chef_reply_text,
            )
            updated = repo.ai_chef_message_set_filtered_reply(
                db_conn,
                ai_chef_message_id,
                filtered_reply,
            )
            if not updated:
                raise ValueError("Failed to update AI chef message as delivered")

            customer_id = record.get("order_user_id")
        finally:
            db_conn.close()

        delivered_live = False
        if customer_id is not None:
            delivered_live = await cls.push_message_to_customer(
                int(customer_id),
                {
                    "response": filtered_reply,
                    "message": filtered_reply,
                    "from_chef": True,
                    "ai_chef_message_id": ai_chef_message_id,
                    "streaming_done": True,
                },
            )

        return {
            "ai_chef_message_id": ai_chef_message_id,
            "ai_filtered_reply": filtered_reply,
            "status": "delivered_to_customer",
            "delivered_live": delivered_live,
        }

    async def ask(self, query: str, return_only_response: bool = False) -> Optional[GPT_Message]:
        try:
            user_input = query
            current_time = datetime.now().strftime("%H:%M")
            requested_order_id: Optional[int] = None

            try:
                payload_input = json.loads(query)
                if isinstance(payload_input, dict):
                    user_input = str(payload_input.get("message", ""))
                    current_time = str(payload_input.get("time", current_time))
                    lang = str(payload_input.get("language", self.language)).lower()
                    if lang != self.language:
                        self.language = lang
                    payload_session_id = payload_input.get("session_id")
                    if payload_session_id is not None:
                        next_session_id = self._sanitize_session_id(str(payload_session_id))
                        if next_session_id != self.session_id:
                            self.session_id = next_session_id
                            self.memory_file_path = self._build_memory_file_path(self.session_id)
                    raw_order_id = payload_input.get("order_id")
                    if raw_order_id is not None:
                        try:
                            requested_order_id = int(raw_order_id)
                        except (TypeError, ValueError):
                            requested_order_id = None
            except json.JSONDecodeError:
                pass

            self.user_message_times.append(current_time)
            state = self._read_previous_context()
            summary = str(state.get("summary", "") or "").strip()
            messages = self._normalize_message_list(state.get("messages", []))
            persona = self._normalize_persona_scores(state.get("persona"))

            # Daily message counter
            daily = state.get("daily", {"date": "", "count": 0})
            if not isinstance(daily, dict):
                daily = {"date": "", "count": 0}
            today = datetime.now().strftime("%Y-%m-%d")
            if daily.get("date") != today:
                daily = {"date": today, "count": 0}
            daily["count"] = int(daily.get("count", 0)) + 1
            messages_today = daily["count"]
            messages_remaining = max(0, DAILY_MESSAGE_LIMIT - messages_today)

            if user_input.strip():
                messages.append({"role": "user", "text": user_input.strip()})

            response_payload = await self._generate(
                current_time=current_time,
                summary=summary,
                messages=messages,
                persona=persona,
            )

            response_text = str(response_payload.get("response", "") or "").strip()
            options = response_payload.get("options")
            options_description = str(response_payload.get("options_description", "") or "").strip()
            suggestions = response_payload.get("suggestions", [])
            dietary_update = str(response_payload.get("dietary_update", "") or "").strip()
            persona_update = self._normalize_persona_update(response_payload.get("persona_update"))
            modification_classification = self._normalize_modification_classification(
                response_payload.get("modification_classification")
            )

            # Save dietary preferences to DB if detected and user is logged in
            if dietary_update and self.customer_id:
                try:
                    from db.database import get_connection
                    from db import repositories as repo
                    db_conn = get_connection()
                    try:
                        existing = repo.user_get_preferences(db_conn, int(self.customer_id))
                        merged = f"{existing}, {dietary_update}".strip(", ") if existing else dietary_update
                        repo.user_set_preferences(db_conn, int(self.customer_id), merged)
                        self.user_preferences = merged
                        logger.info("Saved dietary preference '%s' for user %s", dietary_update, self.customer_id)
                    finally:
                        db_conn.close()
                except Exception:
                    logger.exception("Failed to save dietary preference")

            persona = {
                "humor": max(PERSONA_MIN, min(PERSONA_MAX, int(persona.get("humor", 5)) + int(persona_update.get("humor", 0)))),
                "formality": max(PERSONA_MIN, min(PERSONA_MAX, int(persona.get("formality", 5)) + int(persona_update.get("formality", 0)))),
                "analytical_detail": max(PERSONA_MIN, min(PERSONA_MAX, int(persona.get("analytical_detail", 5)) + int(persona_update.get("analytical_detail", 0)))),
            }

            if modification_classification in {MODIFICATION_SIMPLE, MODIFICATION_COMPLEX} and user_input.strip():
                target_order_id = self._resolve_target_order_id(requested_order_id)
                if target_order_id is not None:
                    if modification_classification == MODIFICATION_SIMPLE and not response_text:
                        response_text = "Your request has been noted and approved."
                    persisted = self._persist_modification_record(
                        order_id=target_order_id,
                        request_text=user_input.strip(),
                        classification=modification_classification,
                        customer_reply=response_text,
                    )
                    if persisted and modification_classification == MODIFICATION_COMPLEX:
                        response_text = CHEF_HOLDING_MESSAGE
                        options = None
                        options_description = ""
                        suggestions = []
                else:
                    logger.info(
                        "Detected %s modification but no active order was found; skipping DB routing",
                        modification_classification,
                    )

            model_text = response_text
            if options_description:
                model_text = f"{response_text}\n{options_description}".strip()

            if model_text:
                messages.append({"role": "model", "text": model_text})

            if len(messages) >= SUMMARY_TRIGGER_MESSAGES:
                latest_messages = messages[-SUMMARY_TRIGGER_MESSAGES:]
                try:
                    refreshed_summary = await self._summarize_messages(summary, latest_messages)
                    if refreshed_summary:
                        summary = refreshed_summary
                except Exception:
                    logger.exception("Failed to summarize chat memory", extra={"session_id": self.session_id})
                messages = []

            self._write_updated_context({
                "summary": summary,
                "messages": messages,
                "persona": persona,
                "daily": daily,
            })

            # Send final complete structured response to frontend
            client_payload = {
                "response": response_text,
                "message": response_text,
                "options": options,
                "options_description": options_description,
                "suggestions": suggestions,
                "messages_today": messages_today,
                "messages_remaining": messages_remaining,
                "streaming_done": True,
            }

            if self.connection:
                await self.connection.send_json(client_payload)

            gpt_message = GPT_Message(
                response=response_text,
                options=options,
            )
            return gpt_message

        except Exception as e:
            logger.exception("Error in chat processing")
            error_payload = {
                "error": str(e),
                "error_type": e.__class__.__name__,
                "streaming_done": True,
            }
            if self.connection:
                await self.connection.send_json(error_payload)
            if return_only_response:
                return GPT_Message(response=f"Error: {str(e)}", options=None)
            return None

    # ── Cleanup & Analytics (static) ──────────────────────────

    @staticmethod
    def cleanup_old_sessions() -> Dict[str, int]:
        """Delete sessions older than SESSION_MAX_AGE_DAYS and enforce per-user limit."""
        import time
        if not CHAT_MEMORY_DIR.exists():
            return {"deleted_expired": 0, "deleted_over_limit": 0}

        cutoff = time.time() - (SESSION_MAX_AGE_DAYS * 86400)
        deleted_expired = 0
        deleted_over_limit = 0

        # Pass 1: delete expired files
        user_files: Dict[Any, List[Dict[str, Any]]] = {}
        for f in CHAT_MEMORY_DIR.glob("*.txt"):
            if f.stat().st_mtime < cutoff:
                f.unlink(missing_ok=True)
                deleted_expired += 1
                continue
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
            except Exception:
                continue
            cid = data.get("customer_id")
            if cid is not None:
                user_files.setdefault(cid, []).append({"path": f, "updated": data.get("updated_at", "")})

        # Pass 2: enforce per-user limit (keep newest SESSION_MAX_PER_USER)
        for cid, files in user_files.items():
            if len(files) <= SESSION_MAX_PER_USER:
                continue
            files.sort(key=lambda x: x["updated"], reverse=True)
            for entry in files[SESSION_MAX_PER_USER:]:
                entry["path"].unlink(missing_ok=True)
                deleted_over_limit += 1

        logger.info("Cleanup: deleted %d expired, %d over limit", deleted_expired, deleted_over_limit)
        return {"deleted_expired": deleted_expired, "deleted_over_limit": deleted_over_limit}

    @staticmethod
    def get_analytics() -> Dict[str, Any]:
        """Scan all session files and return aggregated analytics."""
        if not CHAT_MEMORY_DIR.exists():
            return {"total_sessions": 0}

        total_sessions = 0
        total_messages = 0
        sessions_by_date: Dict[str, int] = {}
        messages_by_date: Dict[str, int] = {}
        item_mentions: Dict[int, int] = {}
        user_sessions: Dict[Any, int] = {}
        guest_sessions = 0
        all_sessions: List[Dict[str, Any]] = []

        for f in CHAT_MEMORY_DIR.glob("*.txt"):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
            except Exception:
                continue
            total_sessions += 1
            msgs = data.get("messages", [])
            msg_count = len(msgs)
            total_messages += msg_count

            created = str(data.get("created_at", "") or "")[:10]
            updated = str(data.get("updated_at", "") or "")[:10]
            # Fallback to file modification time if no timestamps stored
            if not created and not updated:
                date_key = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d")
            else:
                date_key = updated or created
            if date_key:
                sessions_by_date[date_key] = sessions_by_date.get(date_key, 0) + 1
                messages_by_date[date_key] = messages_by_date.get(date_key, 0) + msg_count

            cid = data.get("customer_id")
            if cid:
                user_sessions[cid] = user_sessions.get(cid, 0) + 1
            else:
                guest_sessions += 1

            # Count item_id mentions in model responses
            for m in msgs:
                if m.get("role") != "model":
                    continue
                for match in re.findall(r'"item_id"\s*:\s*(\d+)', m.get("text", "")):
                    iid = int(match)
                    item_mentions[iid] = item_mentions.get(iid, 0) + 1

            file_date = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            all_sessions.append({
                "session_id": f.stem,
                "customer_id": cid,
                "message_count": msg_count,
                "created_at": data.get("created_at") or file_date,
                "updated_at": data.get("updated_at") or file_date,
                "daily_count": data.get("daily", {}).get("count", 0),
                "preview": (msgs[-1]["text"][:80] if msgs else data.get("summary", "")[:80]),
            })

        # Sort popular items
        popular_items = sorted(item_mentions.items(), key=lambda x: x[1], reverse=True)[:20]

        return {
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "guest_sessions": guest_sessions,
            "user_sessions_count": len(user_sessions),
            "sessions_by_date": dict(sorted(sessions_by_date.items())[-30:]),
            "messages_by_date": dict(sorted(messages_by_date.items())[-30:]),
            "popular_items": [{"item_id": iid, "mentions": cnt} for iid, cnt in popular_items],
            "sessions": sorted(all_sessions, key=lambda x: x.get("updated_at", ""), reverse=True),
        }

    @staticmethod
    def export_session(session_id: str) -> Optional[Dict[str, Any]]:
        """Export full conversation for a single session."""
        safe_id = ChatBot._sanitize_session_id(session_id)
        fpath = CHAT_MEMORY_DIR / f"{safe_id}.txt"
        if not fpath.exists():
            return None
        try:
            data = json.loads(fpath.read_text(encoding="utf-8"))
            data["session_id"] = safe_id
            return data
        except Exception:
            return None

    @staticmethod
    def delete_all_sessions() -> Dict[str, int]:
        """Delete ALL chat memory files."""
        if not CHAT_MEMORY_DIR.exists():
            return {"deleted": 0}
        count = 0
        for f in CHAT_MEMORY_DIR.glob("*.txt"):
            f.unlink(missing_ok=True)
            count += 1
        logger.info("Deleted all %d chat sessions", count)
        return {"deleted": count}
