import json
from pydantic import RootModel, BaseModel, Field, ConfigDict, field_validator
from typing import Any, List, Optional
from datetime import datetime

class OpenAIRequest(BaseModel):
    prompt: str

class ChatMessage(BaseModel):
    id: int = Field(..., description="Numeric ID")
    timestamp: datetime = Field(..., description="Time the message was sent")
    text: str = Field(..., description="Text of the message")

class ChatHistory(RootModel):
    root: List[ChatMessage]

class EntryLog(BaseModel):
    timestamp: datetime = Field(..., description="Time the user opened the site")

class ButtonRequest(BaseModel):
    id: int = Field(..., description="ID of the button pressed")
    timestamp: datetime = Field(..., description="Time of the button press")

class ButtonRequests(RootModel):
    root: List[ButtonRequest]

class OpenAIResponse(BaseModel):
    response: str
    tokens_used: int

class Recommendation(BaseModel):
    item_id: int
    reason: str
    count: int

class GPT_Message(BaseModel):
    response: str
    options: Optional[List[Recommendation]]


# ----- Auth & Users -----
class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    fullname: str
    email: Optional[str] = None
    password: str
    access_level: str = "user"


class UserUpdate(BaseModel):
    fullname: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    access_level: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    created_at: str
    updated_at: str
    fullname: str
    access_level: str
    email: Optional[str] = None


# ----- Products -----
class ProductCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    item_id: Optional[int] = None
    price: int
    img_path: str
    type: str
    type_name: str
    availability: int = 1
    access_level: Optional[str] = None
    name_en: Optional[str] = None
    name_am: Optional[str] = None
    name_ru: Optional[str] = None
    description_en: Optional[str] = None
    description_am: Optional[str] = None
    description_ru: Optional[str] = None
    short_description_en: Optional[str] = None
    short_description_am: Optional[str] = None
    short_description_ru: Optional[str] = None
    composition: Optional[List[str] | str] = None

    @field_validator("item_id", "price", "availability", mode="before")
    @classmethod
    def _coerce_ints(cls, value: Any):
        if value is None:
            return None
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return int(value)
        text = str(value).strip()
        if not text:
            return None
        return int(float(text))

    @field_validator("access_level", mode="before")
    @classmethod
    def _normalize_access_level(cls, value: Any):
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("composition", mode="before")
    @classmethod
    def _normalize_composition(cls, value: Any):
        if value is None:
            return None
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        text = str(value).strip()
        if not text:
            return None
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(v).strip() for v in parsed if str(v).strip()]
        except Exception:
            pass
        if "," in text or "\n" in text:
            return [part.strip() for part in text.replace("\r", "").replace("\n", ",").split(",") if part.strip()]
        return text


class ProductUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    item_id: Optional[int] = None
    price: Optional[int] = None
    img_path: Optional[str] = None
    type: Optional[str] = None
    type_name: Optional[str] = None
    availability: Optional[int] = None
    access_level: Optional[str] = None
    name_en: Optional[str] = None
    name_am: Optional[str] = None
    name_ru: Optional[str] = None
    description_en: Optional[str] = None
    description_am: Optional[str] = None
    description_ru: Optional[str] = None
    short_description_en: Optional[str] = None
    short_description_am: Optional[str] = None
    short_description_ru: Optional[str] = None
    composition: Optional[List[str] | str] = None

    @field_validator("item_id", "price", "availability", mode="before")
    @classmethod
    def _coerce_ints(cls, value: Any):
        if value is None:
            return None
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return int(value)
        text = str(value).strip()
        if not text:
            return None
        return int(float(text))

    @field_validator("access_level", mode="before")
    @classmethod
    def _normalize_access_level(cls, value: Any):
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("composition", mode="before")
    @classmethod
    def _normalize_composition(cls, value: Any):
        if value is None:
            return None
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        text = str(value).strip()
        if not text:
            return None
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(v).strip() for v in parsed if str(v).strip()]
        except Exception:
            pass
        if "," in text or "\n" in text:
            return [part.strip() for part in text.replace("\r", "").replace("\n", ",").split(",") if part.strip()]
        return text


class ProductResponse(BaseModel):
    id: int
    item_id: Optional[int] = None
    price: int
    img_path: str
    availability: int
    access_level: Optional[str] = None
    type: str
    type_name: str
    name_en: Optional[str] = None
    name_am: Optional[str] = None
    name_ru: Optional[str] = None
    description_en: Optional[str] = None
    description_am: Optional[str] = None
    description_ru: Optional[str] = None
    short_description_en: Optional[str] = None
    short_description_am: Optional[str] = None
    short_description_ru: Optional[str] = None
    composition: Optional[str] = None


# ----- Orders -----
class OrderItemCreate(BaseModel):
    product_id: Optional[int] = None
    item_id: Optional[int] = None
    count: int


class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    user_id: Optional[int] = None


class OrderResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    created_at: str
    updated_at: str
    status: str
    price: int
    completed_at: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OrderStatusUpdate(BaseModel):
    status: str