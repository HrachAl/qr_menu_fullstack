from __future__ import annotations
# pyright: reportMissingImports=false, reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownParameterType=false, reportMissingTypeArgument=false, reportUnnecessaryIsInstance=false

import asyncio
import json
import logging
import re
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

    def _system_instruction(self) -> str:
        language_prompt = PROMPT_DICT.get(self.language, PROMPT_DICT["en"])
        return (
            f"{language_prompt}\n\n"
            "You must ALWAYS respond with a valid, raw JSON object. "
            "Do not wrap the response in markdown code blocks. "
            "Do not add any conversational text outside the JSON.\n\n"
            "You are provided with a summary and recent conversation messages. "
            "Use them to maintain continuity.\n"
            "Conversational Flow: NEVER repeat greetings (like Hello, Hi, Good morning) if you have already greeted the user in this session. "
            "Speak naturally like an ongoing conversation.\n"
            "LANGUAGE RULE: You MUST always respond in the exact language the user writes in.\n"
            "NATURAL CONVERSATION RULE: NEVER mention internal database IDs (like 'item 45') to the user. Always use the natural name of the product.\n"
            "ADAPTIVE DETAIL RULE: You have exact recipes and calorie data (total and per ingredient). Adapt your detail level to the user's prompt. If they ask casually about calories, give the total (e.g., '1000 kcal'). If they ask for a detailed breakdown or what is inside, list the ingredients and their specific calories naturally.\n"
            "NUTRITIONAL KNOWLEDGE RULE (CRITICAL): If the user asks about macronutrients (proteins, carbs, fats), vitamins, minerals, or allergens, and this data is NOT explicitly written in the menu snapshot, DO NOT say 'I don't know' or 'The menu doesn't specify'. You must confidently use your own internal AI knowledge to estimate and provide this nutritional information based on the known ingredients and their weights. Be highly professional and helpful.\n"
            "Time Handling: The current time is provided ONLY for your internal context so you can recommend appropriate meals "
            "(breakfast vs dinner). DO NOT explicitly state the time to the user unless they specifically ask what time it is.\n"
            "RECIPE TRANSPARENCY RULE: If the user asks about the composition or ingredients of a dish, you MUST list the exact ingredients along with their precise quantities (e.g., grams, kilograms, liters, pieces) as provided in the recipe data. Be highly detailed and helpful.\n"
            "You must answer the user in the response field.\n"
            "Menu JSON is included below and should be treated as the source of truth for item IDs and names.\n"
            f"{self._menu_snapshot()}\n\n"
            "Return JSON with this shape exactly: "
            '{"response":"...","options":[{"item_id":123,"reason":"...","count":0}]}. '
            "If there are no recommendations, set options to null or an empty array."
        )

    @staticmethod
    def _default_memory_state() -> Dict[str, Any]:
        return {"summary": "", "messages": []}

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
                # Backward compatibility for old plain-text summary files.
                return {"summary": raw, "messages": []}

            if not isinstance(parsed, dict):
                return self._default_memory_state()

            summary = str(parsed.get("summary", "") or "").strip()
            messages = self._normalize_message_list(parsed.get("messages", []))
            return {"summary": summary, "messages": messages}
        except Exception:
            logger.exception("Failed to read chat memory", extra={"session_id": self.session_id})
            return self._default_memory_state()

    def _write_updated_context(self, state: Dict[str, Any]) -> None:
        try:
            summary = str(state.get("summary", "") or "").strip()
            messages = self._normalize_message_list(state.get("messages", []))
            payload = {"summary": summary, "messages": messages}
            self.memory_file_path.write_text(
                json.dumps(payload, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception:
            logger.exception("Failed to write chat memory", extra={"session_id": self.session_id})

    @staticmethod
    def _looks_like_recommendation_request(user_input: str) -> bool:
        lowered = user_input.lower()
        json_signals = [
            "recommend",
            "recommendation",
            "рекоменд",
            "խորհուրդ",
            "options",
            "3+",
            "order",
            "заказ",
            "պատվեր",
        ]
        return any(signal in lowered for signal in json_signals)

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

            normalized_options.append(
                {
                    "item_id": item_id,
                    "reason": reason,
                    "count": count,
                }
            )
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

    def _coerce_response_payload(self, assistant_text: str) -> Dict[str, Any]:
        stripped = assistant_text.strip()
        if not stripped:
            return {"response": "", "options": None}

        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            return {"response": stripped, "options": None}

        if isinstance(parsed, list):
            options = self._normalize_options(parsed)
            return {
                "response": "",
                "options": options if options else None,
            }

        if isinstance(parsed, dict):
            raw_options = parsed.get("options")
            if raw_options is None and isinstance(parsed.get("recommendations"), list):
                raw_options = parsed.get("recommendations")
            options = self._normalize_options(raw_options)

            response_text = parsed.get("response")
            if response_text is None:
                response_text = parsed.get("message", "")
            response_text = str(response_text) if response_text is not None else ""

            return {
                "response": response_text,
                "options": options if options else None,
            }

        return {"response": stripped, "options": None}

    async def _generate(
        self,
        current_time: str,
        summary: str,
        messages: List[Dict[str, str]],
    ) -> str:
        if client is None:
            raise RuntimeError("GEMINI_API_KEY is missing. Set it in environment/.env.")
        if types is None:
            raise RuntimeError("google-genai package is not installed.")
        active_client = client
        active_types = types

        time_key = f"{self.language}_time"
        time_prompt = PROMPT_DICT.get(time_key, PROMPT_DICT.get("en_time", "Current time is {current_time}"))
        contextual_input = (
            f"{time_prompt.format(current_time=current_time)}\n\n"
            f"Previous Summary:\n{summary or '(empty)'}\n\n"
            f"Recent Messages (JSON):\n{json.dumps(messages, ensure_ascii=False)}"
        )

        config_kwargs: Dict[str, Any] = {
            "temperature": 0.4,
            "system_instruction": self._system_instruction(),
            "response_mime_type": "application/json",
        }

        def _call_model() -> Any:
            return active_client.models.generate_content(
                model=MODEL_NAME,
                contents=contextual_input,
                config=active_types.GenerateContentConfig(**config_kwargs),
            )

        response = await asyncio.to_thread(_call_model)
        text = getattr(response, "text", None)
        if text:
            return text

        # Fallback for edge cases where SDK does not populate .text.
        candidates = getattr(response, "candidates", None)
        if candidates:
            for candidate in candidates:
                content = getattr(candidate, "content", None)
                parts = getattr(content, "parts", None) if content else None
                if parts:
                    collected = []
                    for part in parts:
                        part_text = getattr(part, "text", None)
                        if part_text:
                            collected.append(part_text)
                    if collected:
                        return "\n".join(collected)

        return ""

    async def _summarize_messages(self, summary: str, messages: List[Dict[str, str]]) -> str:
        if client is None:
            raise RuntimeError("GEMINI_API_KEY is missing. Set it in environment/.env.")
        if types is None:
            raise RuntimeError("google-genai package is not installed.")
        active_client = client
        active_types = types

        summarization_prompt = (
            "You are an AI summarizer. "
            f"Previous Summary: {summary}. "
            f"Recent Messages: {json.dumps(messages, ensure_ascii=False)}. "
            "Write a concise, comprehensive summary of the user's preferences, language, and ongoing order status. "
            "Return ONLY the new summary text."
        )

        config_kwargs: Dict[str, Any] = {
            "temperature": 0.2,
        }

        def _call_model() -> Any:
            return active_client.models.generate_content(
                model=MODEL_NAME,
                contents=summarization_prompt,
                config=active_types.GenerateContentConfig(**config_kwargs),
            )

        response = await asyncio.to_thread(_call_model)
        text = getattr(response, "text", None)
        return str(text or "").strip()

    async def ask(self, query: str, return_only_response: bool = False) -> Optional[GPT_Message]:
        try:
            payload_input: Any = {}
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
                else:
                    payload_input = {}
            except json.JSONDecodeError:
                payload_input = {}

            self.user_message_times.append(current_time)
            state = self._read_previous_context()
            summary = str(state.get("summary", "") or "").strip()
            messages = self._normalize_message_list(state.get("messages", []))

            if user_input.strip():
                messages.append({"role": "user", "text": user_input.strip()})

            assistant_response = await self._generate(
                current_time=current_time,
                summary=summary,
                messages=messages,
            )

            response_payload = self._coerce_response_payload(assistant_response)
            model_text = str(response_payload.get("response", "") or "").strip()
            if not model_text:
                model_text = assistant_response.strip()

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

            self._write_updated_context({"summary": summary, "messages": messages})

            client_payload = {
                "response": response_payload.get("response", ""),
                "options": response_payload.get("options"),
            }

            gpt_message = GPT_Message(
                response=client_payload.get("response", ""),
                options=client_payload.get("options"),
            )

            if self.connection:
                await self.connection.send_json(client_payload)

            return gpt_message

        except Exception as e:
            logger.exception("Error in chat processing")
            error_payload = {
                "error": {
                    "message": str(e),
                    "type": e.__class__.__name__,
                }
            }
            error_response = {"role": "assistant", "content": json.dumps(error_payload)}
            if self.connection:
                await self.connection.send_json([error_response])
            if return_only_response:
                return GPT_Message(response=f"Error: {str(e)}", options=None)
            return None
