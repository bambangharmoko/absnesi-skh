import uuid
from datetime import datetime, date, time
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Date, Time, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.app.db.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="GURU_KELAS")  # ADMIN, GURU_KELAS, OPERATOR
    created_at = Column(DateTime, default=datetime.utcnow)

class Student(Base):
    __tablename__ = "students"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    nis = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    nickname = Column(String(50), nullable=False) # For Indonesian TTS greetings
    class_name = Column(String(50), nullable=False, index=True) # e.g. "Kelas 1 Autis", "Kelas 2 Tunarungu", etc.
    category = Column(String(50), nullable=False) # e.g. "Autism", "Down Syndrome", "Tunagrahita", etc.
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    embeddings = relationship("FaceEmbedding", back_populates="student", cascade="all, delete-orphan")
    attendances = relationship("Attendance", back_populates="student", cascade="all, delete-orphan")

class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    embedding_vector = Column(Text, nullable=False) # JSON array serialized string of 512-dim or 128-dim floats
    photo_path = Column(String(255), nullable=True) # Reference photo path
    pose_label = Column(String(50), nullable=True) # "Lurus", "Senyum", "Kiri", "Kanan", "Menunduk"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    student = relationship("Student", back_populates="embeddings")

class Attendance(Base):
    __tablename__ = "attendances"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True) # YYYY-MM-DD format
    time_in = Column(String(8), nullable=False) # HH:MM:SS format
    status = Column(String(20), nullable=False) # HADIR, TERLAMBAT, IZIN, SAKIT, ALPHA
    confidence_score = Column(Float, default=1.0)
    verification_method = Column(String(30), default="FACE_RECOGNITION") # FACE_RECOGNITION, MANUAL_TEACHER
    captured_photo = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    student = relationship("Student", back_populates="attendances")
