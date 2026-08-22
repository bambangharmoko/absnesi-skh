import os
import cv2
import base64
from datetime import datetime, date, timedelta
from typing import Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
from backend.app.db.models import Attendance, Student
from backend.app.core.config import settings

class AttendanceService:
    def __init__(self):
        self.cooldown_minutes = settings.COOLDOWN_MINUTES
        # Frame buffer for continuous detection smoothing: student_id -> list of timestamps
        self.detection_history: Dict[str, list] = {}

    def get_today_str(self) -> str:
        return date.today().strftime("%Y-%m-%d")

    def get_now_time_str(self) -> str:
        return datetime.now().strftime("%H:%M:%S")

    def determine_status(self) -> str:
        """Determine if attendance is HADIR or TERLAMBAT based on SCHOOL_START_TIME."""
        now_time = datetime.now().time()
        start_hour, start_minute = map(int, settings.SCHOOL_START_TIME.split(":"))
        school_time = datetime.now().replace(hour=start_hour, minute=start_minute, second=0, microsecond=0).time()
        
        if now_time <= school_time:
            return "HADIR"
        else:
            return "TERLAMBAT"

    def check_duplicate_or_cooldown(self, student_id: str, db: Session) -> Tuple[bool, Optional[Attendance]]:
        """
        Check if student has already checked in today or within the cooldown period.
        Returns: (is_duplicate_or_cooldown, existing_record)
        """
        today_str = self.get_today_str()
        existing = db.query(Attendance).filter(
            Attendance.student_id == student_id,
            Attendance.date == today_str
        ).order_by(Attendance.created_at.desc()).first()

        if not existing:
            return False, None

        # Check cooldown safely across SQLite (naive) and PostgreSQL (timezone-aware)
        if existing.created_at is not None:
            if existing.created_at.tzinfo is not None:
                from datetime import timezone
                now = datetime.now(timezone.utc)
            else:
                now = datetime.utcnow()
            time_elapsed = now - existing.created_at
            if time_elapsed < timedelta(minutes=self.cooldown_minutes):
                return True, existing

        # Already recorded for today
        return True, existing


    def record_attendance(
        self,
        student: Student,
        db: Session,
        confidence: float,
        verification_method: str = "FACE_RECOGNITION",
        face_img_bgr: Optional[any] = None,
        notes: Optional[str] = None
    ) -> Tuple[Attendance, bool, str]:
        """
        Records attendance for a student.
        Returns: (attendance_record, is_newly_recorded, message)
        """
        is_duplicate, existing_record = self.check_duplicate_or_cooldown(student.id, db)
        
        if is_duplicate and existing_record:
            return (
                existing_record,
                False,
                f"Halo {student.nickname}, presensi kamu sudah tercatat hari ini pada pukul {existing_record.time_in}."
            )

        status = self.determine_status()
        today_str = self.get_today_str()
        time_str = self.get_now_time_str()

        # Save snapshot photo if available
        snapshot_filename = None
        if face_img_bgr is not None:
            try:
                os.makedirs(settings.STORAGE_DIR / "attendance_snapshots", exist_ok=True)
                snapshot_filename = f"att_{student.id}_{int(datetime.utcnow().timestamp())}.jpg"
                snapshot_path = settings.STORAGE_DIR / "attendance_snapshots" / snapshot_filename
                cv2.imwrite(str(snapshot_path), face_img_bgr)
            except Exception as e:
                print(f"Failed to save snapshot photo: {e}")

        new_attendance = Attendance(
            id=str(uuid.uuid4()),
            student_id=student.id,
            date=today_str,
            time_in=time_str,
            status=status,
            confidence_score=round(float(confidence), 3),
            verification_method=verification_method,
            captured_photo=snapshot_filename,
            notes=notes
        )

        db.add(new_attendance)
        db.commit()
        db.refresh(new_attendance)

        greeting = "Selamat Pagi"
        msg = f"{greeting}, {student.nickname}! Presensi kamu berhasil dicatat."
        return new_attendance, True, msg

attendance_service = AttendanceService()
