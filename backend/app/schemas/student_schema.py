from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class StudentBase(BaseModel):
    nis: str = Field(..., description="Nomor Induk Siswa / NISN")
    full_name: str = Field(..., description="Nama Lengkap Siswa")
    nickname: str = Field(..., description="Nama Panggilan untuk suara TTS")
    class_name: str = Field(..., description="Nama Kelas (e.g. Kelas 1 Autis)")
    category: str = Field(..., description="Kebutuhan Khusus / Spesifikasi")
    is_active: bool = True

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    nickname: Optional[str] = None
    class_name: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

class FaceEmbeddingOut(BaseModel):
    id: str
    photo_path: Optional[str] = None
    pose_label: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class StudentOut(StudentBase):
    id: str
    created_at: datetime
    photo_count: Optional[int] = 0
    latest_photo: Optional[str] = None

    class Config:
        from_attributes = True
