from config import OPENAI_API_KEY
from prompts import PROMPT_DICT
from openai import OpenAI
from datetime import datetime
from models import GPT_Message
import json
from typing import List, Optional, Dict
import logging
import asyncio


client = OpenAI(api_key=OPENAI_API_KEY)
logger = logging.getLogger(__name__)

assistant_ids = {
    "am": "asst_wYkaLvIOu8yPQc48zott4udb",
    "en": "asst_wYkaLvIOu8yPQc48zott4udb",
    "ru": "asst_wYkaLvIOu8yPQc48zott4udb"
}

with open("services/menu_am.json", "r", encoding="utf-8") as f:
    menu_data = json.load(f)
    menu = {item['item_id']: item for item in menu_data}

class ChatBot:
    def __init__(self, connection, prompt_language: str = "am"):
        self.connection = connection
        self.language = prompt_language
        self.assistant_id = assistant_ids[prompt_language]
        self.thread = client.beta.threads.create()
        self.user_message_times: List[str] = []
        self.history: List[Dict[str, str]] = []
        # self.system_message: Dict[str, str] = {
        #     "role": "system",
        #     "content": PROMPT_DICT[prompt_language],
        # }
        # self.system_message = {"role": "system","content": ""}

    async def ask(self, query: str, return_only_response: bool = False) -> Optional[GPT_Message]:
        try:
            response_payload: Optional[Dict] = None
            try:
                prompt_data: dict = json.loads(query)
                current_time: str = prompt_data.get("time", datetime.now().strftime("%H:%M"))
                lang: str = prompt_data.get("language", "am")
                user_input: str = prompt_data.get("message", "")
                if lang != self.language:
                    self.language = lang
                    # self.system_message = {"role": "system", "content": PROMPT_DICT[lang]}
            except json.JSONDecodeError:
                user_input = query
                current_time = datetime.now().strftime("%H:%M")

            self.user_message_times.append(current_time)

            client.beta.threads.messages.create(
                thread_id=self.thread.id,
                role="user",
                content=user_input
            )

            # system_message_with_time = f"{self.system_message['content']}\n\nCurrent time is {current_time}."
            run = client.beta.threads.runs.create(
                thread_id=self.thread.id,
                assistant_id=self.assistant_id,
                # instructions=system_message_with_time
            )

            while True:
                run = client.beta.threads.runs.retrieve(thread_id=self.thread.id, run_id=run.id)
                if run.status == "completed":
                    break
                await asyncio.sleep(1)

            messages = client.beta.threads.messages.list(thread_id=self.thread.id, order="asc")
            history = []
            time_index = 0
            assistant_response = ""
            for msg in messages.data:
                if msg.role == "user":
                    time_key = f"{self.language}_time"
                    time_prompt = PROMPT_DICT.get(time_key, PROMPT_DICT.get("am_time", ""))
                    time_message = {
                        "role": "system",
                        "content": time_prompt.format(
                            current_time=self.user_message_times[time_index]
                        )
                    }
                    history.append(time_message)
                    time_index += 1
                elif msg.role == "assistant":
                    assistant_response = msg.content[0].text.value
                history.append({"role": msg.role, "content": msg.content[0].text.value})

            self.history = history


            try:
                response_data: dict = json.loads(assistant_response)
                gpt_message = GPT_Message(**response_data)
                options = response_data.get("options", [])
                if isinstance(options, list):
                    normalized_item_ids = []
                    for rec in options:
                        if not isinstance(rec, dict):
                            continue
                        item_id = rec.get("item_id")
                        if isinstance(item_id, str):
                            try:
                                item_id = int(item_id)
                            except ValueError:
                                pass
                        if item_id in menu:
                            normalized_item_ids.append(item_id)

                    types_unique = set(menu[item_id]["type"] for item_id in normalized_item_ids)
                    if len(types_unique) <= 2:
                        for rec in options:
                            if isinstance(rec, dict):
                                rec["count"] = 0
                response_payload = response_data
                
            except (json.JSONDecodeError, ValueError):
                gpt_message = GPT_Message(response=assistant_response, options=None)
                response_payload = {"response": gpt_message.response, "options": None}

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
