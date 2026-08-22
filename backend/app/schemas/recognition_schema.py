from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class FrameVerificationRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded webcam image frame (JPEG/PNG)")
    class_id: Optional[str] = Field(None, description="Optional class filter for recognition")

class BoundingBox(BaseModel):
    x: int
    y: int
    w: int
    h: int

class StudentBrief(BaseModel):
    id: str
    nis: str
    name: str
    nickname: str
    class_name: str
    category: str
    photo_url: Optional[str] = None

class FrameVerificationResponse(BaseModel):
    status: str = Field(..., description="MATCHED, UNKNOWN, NO_FACE, ALREADY_CHECKED_IN")
    student: Optional[StudentBrief] = None
    confidence: float = 0.0
    attendance_status: Optional[str] = None # RECORDED_SUCCESS, ALREADY_RECORDED, NONE
    time: Optional[str] = None
    message: str
    bounding_box: Optional[BoundingBox] = None
