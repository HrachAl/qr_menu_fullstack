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


def _build_client() -> Optional[Any]:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is still missing after hard-load.")
    if genai is None:
        return None
    return genai.Client(api_key=GEMINI_API_KEY)


client = _build_client()


class ChatBot:
    def __init__(
        self,
        connection: Any,
        prompt_language: str = "am",
        menu: Optional[Dict[Any, Any]] = None,
        session_id: Optional[str] = None,
    ):
        self.connection = connection
        self.language = prompt_language.lower()
        self.menu = menu or {}
        self.session_id = self._sanitize_session_id(session_id)
        self.memory_file_path = self._build_memory_file_path(self.session_id)
        self.user_message_times: List[str] = []
        self.menu_by_id = self._normalize_menu(self.menu)

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
            f'{STREAM_MARKER}{{"options":[{{"item_id":123,"count":1}}],"options_description":"...","persona_update":{{"humor":0,"formality":0,"analytical_detail":0}},"suggestions":["short follow-up 1","short follow-up 2","short follow-up 3"]}}\n'
            "suggestions: 3 short follow-up questions in the SAME language as the user. Max 6 words each. Make them contextually relevant.\n"
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
            return {"summary": summary, "messages": messages, "persona": persona, "daily": daily}
        except Exception:
            logger.exception("Failed to read chat memory", extra={"session_id": self.session_id})
            return self._default_memory_state()

    def _write_updated_context(self, state: Dict[str, Any]) -> None:
        try:
            summary = str(state.get("summary", "") or "").strip()
            messages = self._normalize_message_list(state.get("messages", []))
            persona = self._normalize_persona_scores(state.get("persona"))
            daily = state.get("daily", {"date": "", "count": 0})
            payload = {"summary": summary, "messages": messages, "persona": persona, "daily": daily}
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

        # Parse JSON part
        options: List[Dict[str, Any]] = []
        options_description = ""
        persona_update: Dict[str, int] = {"humor": 0, "formality": 0, "analytical_detail": 0}
        suggestions: List[str] = []

        if json_raw:
            try:
                parsed = json.loads(json_raw)
                if isinstance(parsed, dict):
                    options = self._normalize_options(parsed.get("options", []))
                    options_description = str(parsed.get("options_description", "") or "").strip()
                    persona_update = self._normalize_persona_update(parsed.get("persona_update"))
                    raw_suggestions = parsed.get("suggestions", [])
                    if isinstance(raw_suggestions, list):
                        suggestions = [str(s).strip() for s in raw_suggestions if str(s).strip()][:4]
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

    async def ask(self, query: str, return_only_response: bool = False) -> Optional[GPT_Message]:
        try:
            user_input = query
            current_time = datetime.now().strftime("%H:%M")

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
            persona_update = self._normalize_persona_update(response_payload.get("persona_update"))

            persona = {
                "humor": max(PERSONA_MIN, min(PERSONA_MAX, int(persona.get("humor", 5)) + int(persona_update.get("humor", 0)))),
                "formality": max(PERSONA_MIN, min(PERSONA_MAX, int(persona.get("formality", 5)) + int(persona_update.get("formality", 0)))),
                "analytical_detail": max(PERSONA_MIN, min(PERSONA_MAX, int(persona.get("analytical_detail", 5)) + int(persona_update.get("analytical_detail", 0)))),
            }

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
