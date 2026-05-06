import json
from pydantic import RootModel, BaseModel, Field, ConfigDict, field_validator
from typing import Any, List, Literal, Optional
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
    recipe: Optional[Any] = None
    total_calories: Optional[int] = 0


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


# ----- Inventory -----
InventoryCategory = Literal[
    "Meat",
    "Produce",
    "Beverages",
    "Alcohol",
    "Sweets/Bakery",
    "Dairy",
    "Dry Goods",
]

InventoryUnit = Literal["kg", "L", "pcs", "bottles"]


class InventoryItemCreate(BaseModel):
    name: str
    category: InventoryCategory
    quantity: float
    unit: InventoryUnit
    low_stock_threshold: float
    overstock_threshold: Optional[float] = None
    kcal_per_unit: Optional[float] = 0
    protein_per_unit: Optional[float] = 0
    fat_per_unit: Optional[float] = 0

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: Any):
        text = str(value or "").strip()
        if not text:
            raise ValueError("Name is required")
        return text

    @field_validator(
        "quantity",
        "low_stock_threshold",
        "overstock_threshold",
        "kcal_per_unit",
        "protein_per_unit",
        "fat_per_unit",
        mode="before",
    )
    @classmethod
    def _non_negative(cls, value: Any):
        if value is None:
            return None
        num = float(value)
        if num < 0:
            raise ValueError("Value must be non-negative")
        return num


class InventoryItemResponse(BaseModel):
    id: int
    name: str
    category: InventoryCategory
    quantity: float
    unit: InventoryUnit
    low_stock_threshold: float
    overstock_threshold: float
    kcal_per_unit: float
    protein_per_unit: float
    fat_per_unit: float
    last_updated: str


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[InventoryCategory] = None
    quantity: Optional[float] = None
    unit: Optional[InventoryUnit] = None
    low_stock_threshold: Optional[float] = None
    overstock_threshold: Optional[float] = None
    kcal_per_unit: Optional[float] = None
    protein_per_unit: Optional[float] = None
    fat_per_unit: Optional[float] = None

    @field_validator("name", mode="before")
    @classmethod
    def _strip_optional_name(cls, value: Any):
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            raise ValueError("Name is required")
        return text

    @field_validator(
        "quantity",
        "low_stock_threshold",
        "overstock_threshold",
        "kcal_per_unit",
        "protein_per_unit",
        "fat_per_unit",
        mode="before",
    )
    @classmethod
    def _optional_non_negative(cls, value: Any):
        if value is None:
            return None
        num = float(value)
        if num < 0:
            raise ValueError("Value must be non-negative")
        return num


class InventoryAdjustRequest(BaseModel):
    action: Literal["add", "deduct"]
    amount: float
    reason: str

    @field_validator("amount", mode="before")
    @classmethod
    def _positive_amount(cls, value: Any):
        amount = float(value)
        if amount <= 0:
            raise ValueError("Amount must be greater than 0")
        return amount

    @field_validator("reason", mode="before")
    @classmethod
    def _strip_reason(cls, value: Any):
        text = str(value or "").strip()
        if not text:
            raise ValueError("Reason is required")
        return text


# ----- Chef workflow -----
class ChefInventoryAdjustmentCreate(BaseModel):
    order_id: int
    ingredient_id: int


class ChefReplyAiRequest(BaseModel):
    ai_chef_message_id: int
    chef_reply_text: str

    @field_validator("chef_reply_text", mode="before")
    @classmethod
    def _strip_chef_reply(cls, value: Any):
        text = str(value or "").strip()
        if not text:
            raise ValueError("chef_reply_text is required")
        return text


class ChefDirectMessageRequest(BaseModel):
    message: str

    @field_validator("message", mode="before")
    @classmethod
    def _strip_message(cls, value: Any):
        text = str(value or "").strip()
        if not text:
            raise ValueError("message is required")
        return text


class InventoryAdjustmentApproveRejectRequest(BaseModel):
    decision: Literal["approve", "reject"]