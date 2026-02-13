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

class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class User(BaseModel):
    id: int
    username: str
    password: str
    role: str = "user"
    created_at: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class Product(BaseModel):
    item_id: int
    name: str
    description: str
    short_description: str
    price: str
    composition: List[str]
    type: str
    type_name: str
    image: str

class ProductCreate(BaseModel):
    name: str
    description: str
    short_description: str
    price: str
    composition: List[str]
    type: str
    type_name: str
    image: str

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    price: Optional[str] = None
    composition: Optional[List[str]] = None
    type: Optional[str] = None
    type_name: Optional[str] = None
    image: Optional[str] = None

class CartItem(BaseModel):
    id: int
    count: int

class OrderCreate(BaseModel):
    user_id: int
    items: List[CartItem]
    total: float

class Order(BaseModel):
    id: int
    user_id: int
    items: List[CartItem]
    total: float
    created_at: str
    status: str = "pending"

class Event(BaseModel):
    id: int
    user_id: int
    action: str
    items: Optional[List[CartItem]] = None
    created_at: str