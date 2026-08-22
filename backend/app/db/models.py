import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.app.db.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="GURU_KELAS")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Student(Base):
    __tablename__ = "students"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    nis = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    nickname = Column(String(50), nullable=False)
    class_name = Column(String(50), nullable=False, index=True)
    category = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    embeddings = relationship("FaceEmbedding", back_populates="student", cascade="all, delete-orphan")
    attendances = relationship("Attendance", back_populates="student", cascade="all, delete-orphan")

class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    embedding_vector = Column(Text, nullable=False)
    photo_path = Column(String(255), nullable=True)
    pose_label = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    student = relationship("Student", back_populates="embeddings")

class Attendance(Base):
    __tablename__ = "attendances"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)
    time_in = Column(String(8), nullable=False)
    status = Column(String(20), nullable=False)
    confidence_score = Column(Float, default=1.0)
    verification_method = Column(String(30), default="FACE_RECOGNITION")
    captured_photo = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    student = relationship("Student", back_populates="attendances")
