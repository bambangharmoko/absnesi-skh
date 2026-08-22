import os
import json
import uuid
import cv2
import numpy as np
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from backend.app.db.models import User, Student, FaceEmbedding, Attendance
from backend.app.db.database import Base, engine
from backend.app.services.face_embedder import face_embedder
from backend.app.core.config import settings

def create_sample_avatar_image(name: str, bg_color: tuple, text_color: tuple = (255, 255, 255)) -> np.ndarray:
    """
    Generate an identifiable 160x160 sample face image with student visual features
    to test the face detector & embedder pipeline cleanly.
    """
    img = np.full((160, 160, 3), bg_color, dtype=np.uint8)
    
    # Draw head / face oval
    cv2.ellipse(img, (80, 80), (50, 65), 0, 0, 360, (230, 210, 195), -1)
    
    # Draw hair
    cv2.ellipse(img, (80, 45), (48, 30), 0, 180, 360, (50, 40, 30), -1)
    
    # Draw eyes
    cv2.circle(img, (60, 75), 6, (40, 40, 40), -1)
    cv2.circle(img, (100, 75), 6, (40, 40, 40), -1)
    cv2.circle(img, (62, 73), 2, (255, 255, 255), -1)
    cv2.circle(img, (102, 73), 2, (255, 255, 255), -1)
    
    # Draw nose
    cv2.line(img, (80, 80), (80, 95), (180, 150, 130), 2)
    
    # Draw smiling mouth
    cv2.ellipse(img, (80, 110), (22, 12), 0, 0, 180, (180, 60, 60), 3)
    
    # Initials badge at bottom
    initials = "".join([part[0] for part in name.split()[:2]]).upper()
    cv2.putText(img, initials, (65, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (60, 60, 60), 2)
    
    return img

def seed_initial_data(db: Session):
    Base.metadata.create_all(bind=engine)
    # 1. Seed Users (Admin & Guru)
    users = [
        User(
            username="admin",
            hashed_password="admin_hashed_placeholder",
            full_name="Administrator SKH",
            role="ADMIN"
        ),
        User(
            username="guru",
            hashed_password="guru_hashed_placeholder",
            full_name="Ibu Maria Goretti, S.Pd",
            role="GURU_KELAS"
        )
    ]
    for u in users:
        existing = db.query(User).filter(User.username == u.username).first()
        if not existing:
            db.add(u)
    db.commit()

    # 2. Seed Students
    students_data = [
        {
            "nis": "SKH-2026-001",
            "full_name": "Budi Santoso",
            "nickname": "Budi",
            "class_name": "Kelas 1 Autis",
            "category": "Autism Spectrum",
            "color": (210, 180, 140)
        },
        {
            "nis": "SKH-2026-002",
            "full_name": "Siti Rahmawati",
            "nickname": "Siti",
            "class_name": "Kelas 1 Autis",
            "category": "Autism Spectrum",
            "color": (255, 192, 203)
        },
        {
            "nis": "SKH-2026-003",
            "full_name": "Kevin Wijaya",
            "nickname": "Kevin",
            "class_name": "Kelas 2 Tunarungu",
            "category": "Hearing Impairment",
            "color": (176, 224, 230)
        },
        {
            "nis": "SKH-2026-004",
            "full_name": "Anisa Putri",
            "nickname": "Anisa",
            "class_name": "Kelas 3 Tunagrahita",
            "category": "Down Syndrome",
            "color": (221, 160, 221)
        },
        {
            "nis": "SKH-2026-005",
            "full_name": "Michael Tan",
            "nickname": "Michael",
            "class_name": "Kelas 3 Tunagrahita",
            "category": "Intellectual Disability",
            "color": (152, 251, 152)
        }
    ]

    saved_students = []
    for s_info in students_data:
        student = db.query(Student).filter(Student.nis == s_info["nis"]).first()
        if not student:
            student = Student(
                nis=s_info["nis"],
                full_name=s_info["full_name"],
                nickname=s_info["nickname"],
                class_name=s_info["class_name"],
                category=s_info["category"],
                is_active=True
            )
            db.add(student)
            db.commit()
            db.refresh(student)

            # Generate sample face photo & extract embedding
            sample_img = create_sample_avatar_image(student.full_name, s_info["color"])
            filename = f"student_{student.id}_ref.jpg"
            photo_path = settings.STUDENT_PHOTOS_DIR / filename
            cv2.imwrite(str(photo_path), sample_img)

            # Generate 512-d embedding
            emb_vec = face_embedder.extract_embedding(sample_img)
            
            face_emb = FaceEmbedding(
                student_id=student.id,
                embedding_vector=json.dumps(emb_vec.tolist()),
                photo_path=filename,
                pose_label="Lurus (Sample)"
            )
            db.add(face_emb)
            db.commit()

        saved_students.append(student)

    # 3. Seed Today & Recent Attendances
    today_str = date.today().strftime("%Y-%m-%d")
    yesterday_str = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")

    # Check if attendances exist
    att_count = db.query(Attendance).count()
    if att_count == 0 and len(saved_students) >= 3:
        # Student 1: Hadir early (07:12:30)
        db.add(Attendance(
            student_id=saved_students[0].id,
            date=today_str,
            time_in="07:12:30",
            status="HADIR",
            confidence_score=0.94,
            verification_method="FACE_RECOGNITION",
            notes="Wajah terverifikasi otomatis pada Kiosk 1"
        ))
        
        # Student 2: Hadir (07:25:10)
        db.add(Attendance(
            student_id=saved_students[1].id,
            date=today_str,
            time_in="07:25:10",
            status="HADIR",
            confidence_score=0.88,
            verification_method="FACE_RECOGNITION",
            notes="Wajah terverifikasi otomatis pada Kiosk 1"
        ))

        # Student 3: Terlambat (07:42:00)
        db.add(Attendance(
            student_id=saved_students[2].id,
            date=today_str,
            time_in="07:42:00",
            status="TERLAMBAT",
            confidence_score=0.91,
            verification_method="FACE_RECOGNITION",
            notes="Terlambat 12 menit - Macet di jalan"
        ))

        # Student 4: Izin (Manual Teacher)
        db.add(Attendance(
            student_id=saved_students[3].id,
            date=today_str,
            time_in="08:00:00",
            status="IZIN",
            confidence_score=1.0,
            verification_method="MANUAL_TEACHER",
            notes="Izin terapi wicara terjadwal oleh orang tua"
        ))

        db.commit()

if __name__ == "__main__":
    from backend.app.db.database import SessionLocal
    db = SessionLocal()
    seed_initial_data(db)
    db.close()
    print("Seed execution finished.")
