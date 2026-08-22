from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from backend.app.db.database import get_db
from backend.app.schemas.recognition_schema import FrameVerificationRequest, FrameVerificationResponse, StudentBrief, BoundingBox
from backend.app.services.face_detector import face_detector
from backend.app.services.face_embedder import face_embedder
from backend.app.services.face_matcher import face_matcher
from backend.app.services.attendance_service import attendance_service
from backend.app.core.config import settings

router = APIRouter()

@router.post("/verify-frame", response_model=FrameVerificationResponse)
def verify_frame(payload: FrameVerificationRequest, db: Session = Depends(get_db)):
    """
    Process a single webcam video stream frame:
    1. Decode Base64 image
    2. Detect face & landmarks with YuNet Deep Detector
    3. Extract 128-dim deep embedding with SFace
    4. Match with enrolled students
    5. Record attendance if valid (with debounce)
    """
    # 1. Decode image
    img_bgr = face_detector.decode_base64_image(payload.image_base64)
    if img_bgr is None:
        return FrameVerificationResponse(
            status="NO_FACE",
            message="Gambar tidak dapat diproses.",
            bounding_box=None
        )

    # 2. Detect face & landmarks
    aligned_face, bbox, face_meta = face_detector.detect_face(img_bgr)
    if aligned_face is None:
        return FrameVerificationResponse(
            status="NO_FACE",
            message="Mencari wajah di depan kamera...",
            bounding_box=None
        )

    bounding_box_obj = BoundingBox(**bbox) if bbox else None

    # 3. Extract deep embedding
    frame_embedding = face_embedder.extract_embedding(
        img_bgr if face_meta is not None else aligned_face,
        face_meta
    )

    # 4. Match against database
    matched_student, confidence = face_matcher.match_face(
        frame_embedding,
        db=db,
        class_filter=payload.class_id
    )

    if not matched_student:
        return FrameVerificationResponse(
            status="UNKNOWN",
            confidence=round(float(confidence), 3),
            message="Wajah belum terdaftar atau tidak dikenali.",
            bounding_box=bounding_box_obj
        )

    # 5. Record attendance with anti-spam debounce
    attendance_record, is_new, msg = attendance_service.record_attendance(
        student=matched_student,
        db=db,
        confidence=confidence,
        verification_method="FACE_RECOGNITION",
        face_img_bgr=aligned_face
    )

    # Find sample photo
    sample_photo = None
    if matched_student.embeddings:
        sample_photo = matched_student.embeddings[0].photo_path

    student_brief = StudentBrief(
        id=matched_student.id,
        nis=matched_student.nis,
        name=matched_student.full_name,
        nickname=matched_student.nickname,
        class_name=matched_student.class_name,
        category=matched_student.category,
        photo_url=f"/api/v1/students/photo/{sample_photo}" if sample_photo else None
    )

    return FrameVerificationResponse(
        status="MATCHED",
        student=student_brief,
        confidence=round(float(confidence), 3),
        attendance_status="RECORDED_SUCCESS" if is_new else "ALREADY_RECORDED",
        time=attendance_record.time_in,
        message=msg,
        bounding_box=bounding_box_obj
    )
