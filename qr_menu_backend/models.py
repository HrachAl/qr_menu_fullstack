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