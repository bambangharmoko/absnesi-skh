from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from backend.app.db.database import get_db
from backend.app.db.models import Attendance, Student
from backend.app.schemas.attendance_schema import AttendanceOut, AttendanceCreateManual, AttendanceSummary
from backend.app.core.config import settings

router = APIRouter()

@router.get("/today", response_model=List[AttendanceOut])
def get_today_attendance(
    class_name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_str: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get attendance records for today or a specific date with optional filters."""
    target_date = date_str or date.today().strftime("%Y-%m-%d")
    
    query = db.query(Attendance).join(Student).filter(Attendance.date == target_date)
    
    if class_name and class_name.lower() != "all":
        query = query.filter(Student.class_name == class_name)
    if status and status.lower() != "all":
        query = query.filter(Attendance.status == status.upper())

    records = query.order_by(Attendance.created_at.desc()).all()
    
    results = []
    for r in records:
        results.append(AttendanceOut(
            id=r.id,
            student_id=r.student_id,
            student_name=r.student.full_name if r.student else "Unknown",
            student_nickname=r.student.nickname if r.student else "Unknown",
            student_nis=r.student.nis if r.student else "-",
            class_name=r.student.class_name if r.student else "-",
            category=r.student.category if r.student else "-",
            date=r.date,
            time_in=r.time_in,
            status=r.status,
            confidence_score=r.confidence_score,
            verification_method=r.verification_method,
            captured_photo=f"/api/v1/attendance/snapshot/{r.captured_photo}" if r.captured_photo else None,
            notes=r.notes,
            created_at=r.created_at
        ))
    return results

@router.get("/summary", response_model=AttendanceSummary)
def get_attendance_summary(
    class_name: Optional[str] = Query(None),
    date_str: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Summary counts for dashboard widgets."""
    target_date = date_str or date.today().strftime("%Y-%m-%d")
    
    # 1. Total Active Students
    student_query = db.query(Student).filter(Student.is_active == True)
    if class_name and class_name.lower() != "all":
        student_query = student_query.filter(Student.class_name == class_name)
    total_students = student_query.count()

    # 2. Today's Attendances
    att_query = db.query(Attendance).join(Student).filter(
        Attendance.date == target_date,
        Student.is_active == True
    )
    if class_name and class_name.lower() != "all":
        att_query = att_query.filter(Student.class_name == class_name)
    
    attendances = att_query.all()
    
    total_present = sum(1 for a in attendances if a.status == "HADIR")
    total_late = sum(1 for a in attendances if a.status == "TERLAMBAT")
    total_permission = sum(1 for a in attendances if a.status == "IZIN")
    total_sick = sum(1 for a in attendances if a.status == "SAKIT")
    
    recorded_student_ids = {a.student_id for a in attendances}
    total_absent = max(0, total_students - len(recorded_student_ids))
    
    total_recorded = total_present + total_late
    rate = round((total_recorded / total_students * 100), 1) if total_students > 0 else 0.0

    return AttendanceSummary(
        total_students=total_students,
        total_present=total_present,
        total_late=total_late,
        total_permission=total_permission,
        total_sick=total_sick,
        total_absent=total_absent,
        attendance_rate=rate
    )

@router.post("/manual-override", response_model=AttendanceOut)
def manual_override(payload: AttendanceCreateManual, db: Session = Depends(get_db)):
    """Teacher / Guardian manual check-in override."""
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Siswa tidak ditemukan.")

    target_date = payload.date or date.today().strftime("%Y-%m-%d")
    now_time = datetime.now().strftime("%H:%M:%S")

    # Check if record already exists for today
    existing = db.query(Attendance).filter(
        Attendance.student_id == student.id,
        Attendance.date == target_date
    ).first()

    if existing:
        existing.status = payload.status.upper()
        existing.verification_method = "MANUAL_TEACHER"
        existing.notes = payload.notes or "Diubah manual oleh guru"
        existing.confidence_score = 1.0
        db.commit()
        db.refresh(existing)
        target_record = existing
    else:
        new_att = Attendance(
            student_id=student.id,
            date=target_date,
            time_in=now_time,
            status=payload.status.upper(),
            confidence_score=1.0,
            verification_method="MANUAL_TEACHER",
            notes=payload.notes or "Presensi manual oleh guru"
        )
        db.add(new_att)
        db.commit()
        db.refresh(new_att)
        target_record = new_att

    return AttendanceOut(
        id=target_record.id,
        student_id=student.id,
        student_name=student.full_name,
        student_nickname=student.nickname,
        student_nis=student.nis,
        class_name=student.class_name,
        category=student.category,
        date=target_record.date,
        time_in=target_record.time_in,
        status=target_record.status,
        confidence_score=target_record.confidence_score,
        verification_method=target_record.verification_method,
        notes=target_record.notes,
        created_at=target_record.created_at
    )
