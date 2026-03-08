from pydantic import RootModel, BaseModel, Field
from typing import List, Optional
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
    composition: Optional[str] = None


class ProductUpdate(BaseModel):
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
    composition: Optional[str] = None


class ProductResponse(BaseModel):
    id: int
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