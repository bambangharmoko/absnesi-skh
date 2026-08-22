from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class AttendanceCreateManual(BaseModel):
    student_id: str
    status: str = Field("HADIR", description="HADIR, TERLAMBAT, IZIN, SAKIT, ALPHA")
    notes: Optional[str] = None
    date: Optional[str] = None # defaults to today

class AttendanceOut(BaseModel):
    id: str
    student_id: str
    student_name: Optional[str] = None
    student_nickname: Optional[str] = None
    student_nis: Optional[str] = None
    class_name: Optional[str] = None
    category: Optional[str] = None
    date: str
    time_in: str
    status: str
    confidence_score: float
    verification_method: str
    captured_photo: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AttendanceSummary(BaseModel):
    total_students: int
    total_present: int
    total_late: int
    total_permission: int # IZIN
    total_sick: int # SAKIT
    total_absent: int # ALPHA / Belum Hadir
    attendance_rate: float
