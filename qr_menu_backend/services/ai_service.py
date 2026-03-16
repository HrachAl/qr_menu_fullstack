from __future__ import annotations
# pyright: reportMissingImports=false, reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnknownParameterType=false, reportMissingTypeArgument=false, reportUnnecessaryIsInstance=false

import asyncio
import json
import logging
from datetime import datetime
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

MODEL_NAME = "gemini-2.5-flash"


def _build_client() -> Optional[Any]:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is still missing after hard-load.")
    if genai is None:
        return None
    return genai.Client(api_key=GEMINI_API_KEY)


client = _build_client()


class ChatBot:
    def __init__(self, connection: Any, prompt_language: str = "am", menu: Optional[Dict[Any, Any]] = None):
        self.connection = connection
        self.language = prompt_language.lower()
        self.menu = menu or {}
        self.user_message_times: List[str] = []
        self.history: List[Dict[str, str]] = []
        self.menu_by_id = self._normalize_menu(self.menu)

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
            "Menu JSON is included below and should be treated as the source of truth for item IDs and names.\n"
            f"{self._menu_snapshot()}\n\n"
            "Return JSON with this shape exactly: "
            '{"response":"...","options":[{"item_id":123,"reason":"...","count":0}]}. '
            "If there are no recommendations, set options to null or an empty array."
        )

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

    async def _generate(self, user_input: str, current_time: str) -> str:
        if client is None:
            raise RuntimeError("GEMINI_API_KEY is missing. Set it in environment/.env.")
        if types is None:
            raise RuntimeError("google-genai package is not installed.")
        active_client = client
        active_types = types

        time_key = f"{self.language}_time"
        time_prompt = PROMPT_DICT.get(time_key, PROMPT_DICT.get("en_time", "Current time is {current_time}"))
        contextual_input = f"{time_prompt.format(current_time=current_time)}\nUser message: {user_input}"

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
                else:
                    payload_input = {}
            except json.JSONDecodeError:
                payload_input = {}

            self.user_message_times.append(current_time)
            assistant_response = await self._generate(user_input=user_input, current_time=current_time)

            self.history.append(
                {
                    "role": "user",
                    "content": user_input,
                }
            )
            self.history.append(
                {
                    "role": "assistant",
                    "content": assistant_response,
                }
            )

            response_payload = self._coerce_response_payload(assistant_response)
            gpt_message = GPT_Message(
                response=response_payload.get("response", ""),
                options=response_payload.get("options"),
            )

            if return_only_response and self.connection:
                await self.connection.send_json(response_payload)
            elif self.connection:
                await self.connection.send_json(self.history)

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
