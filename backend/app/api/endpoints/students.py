import os
import json
import uuid
import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.db.database import get_db
from backend.app.db.models import Student, FaceEmbedding
from backend.app.schemas.student_schema import StudentCreate, StudentUpdate, StudentOut
from backend.app.services.face_detector import face_detector
from backend.app.services.face_embedder import face_embedder
from backend.app.core.config import settings

router = APIRouter()

@router.get("", response_model=List[StudentOut])
def get_students(
    class_name: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """List all students with optional class filter and search."""
    query = db.query(Student)
    if class_name and class_name.lower() != "all":
        query = query.filter(Student.class_name == class_name)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Student.full_name.ilike(search_fmt)) |
            (Student.nickname.ilike(search_fmt)) |
            (Student.nis.ilike(search_fmt))
        )
    
    students = query.order_by(Student.full_name.asc()).all()
    results = []
    for s in students:
        s_dict = {
            "id": s.id,
            "nis": s.nis,
            "full_name": s.full_name,
            "nickname": s.nickname,
            "class_name": s.class_name,
            "category": s.category,
            "is_active": s.is_active,
            "created_at": s.created_at,
            "photo_count": len(s.embeddings),
            "latest_photo": f"/api/v1/students/photo/{s.embeddings[0].photo_path}" if s.embeddings and s.embeddings[0].photo_path else None
        }
        results.append(StudentOut(**s_dict))
    return results

@router.get("/{student_id}", response_model=StudentOut)
def get_student_by_id(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Siswa tidak ditemukan.")
    
    return StudentOut(
        id=student.id,
        nis=student.nis,
        full_name=student.full_name,
        nickname=student.nickname,
        class_name=student.class_name,
        category=student.category,
        is_active=student.is_active,
        created_at=student.created_at,
        photo_count=len(student.embeddings),
        latest_photo=f"/api/v1/students/photo/{student.embeddings[0].photo_path}" if student.embeddings and student.embeddings[0].photo_path else None
    )

@router.post("/enroll-face")
async def enroll_student_face(
    nis: str = Form(...),
    full_name: str = Form(...),
    nickname: str = Form(...),
    class_name: str = Form(...),
    category: str = Form(...),
    photos: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    Enroll a new student or update face profile with 1 to 5 face photos.
    Extracts deep 128-d SFace embeddings and stores them in Supabase / SQLite database.
    """
    nis_clean = nis.strip()
    full_name_clean = full_name.strip()
    nickname_clean = nickname.strip()

    if not nis_clean or not full_name_clean or not nickname_clean:
        raise HTTPException(status_code=422, detail="NIS, Nama Lengkap, dan Nama Panggilan wajib diisi.")

    # 1. Find or create student with explicit UUID
    student = db.query(Student).filter(Student.nis == nis_clean).first()
    if not student:
        student = Student(
            id=str(uuid.uuid4()),
            nis=nis_clean,
            full_name=full_name_clean,
            nickname=nickname_clean,
            class_name=class_name,
            category=category,
            is_active=True
        )
        db.add(student)
        db.commit()
        db.refresh(student)
    else:
        # Update details
        student.full_name = full_name_clean
        student.nickname = nickname_clean
        student.class_name = class_name
        student.category = category
        db.commit()

    saved_embeddings = []
    extracted_vectors = []
    poses = ["Lurus", "Senyum", "Kiri", "Kanan", "Menunduk"]

    for idx, photo_file in enumerate(photos):
        try:
            contents = await photo_file.read()
            if not contents:
                continue

            nparr = np.frombuffer(contents, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img_bgr is None:
                continue

            # Detect face & landmarks
            aligned_face, _, face_meta = face_detector.detect_face(img_bgr)
            if aligned_face is None:
                h, w = img_bgr.shape[:2]
                min_dim = min(h, w)
                crop_y = max(0, (h - min_dim) // 2)
                crop_x = max(0, (w - min_dim) // 2)
                aligned_face = cv2.resize(img_bgr[crop_y:crop_y+min_dim, crop_x:crop_x+min_dim], (160, 160))

            # Extract 128-d Deep SFace embedding
            emb_vec = face_embedder.extract_embedding(
                img_bgr if face_meta is not None else aligned_face,
                face_meta
            )
            extracted_vectors.append(emb_vec)

            # Try to save photo file to disk (if writable)
            pose_name = poses[idx] if idx < len(poses) else f"Pose_{idx+1}"
            filename = f"student_{student.id}_{idx}_{uuid.uuid4().hex[:6]}.jpg"
            try:
                os.makedirs(settings.STUDENT_PHOTOS_DIR, exist_ok=True)
                photo_path = settings.STUDENT_PHOTOS_DIR / filename
                cv2.imwrite(str(photo_path), aligned_face)
            except Exception as write_err:
                print(f"Notice saving student photo: {write_err}")

            # Save embedding record to database with explicit UUID
            face_emb = FaceEmbedding(
                id=str(uuid.uuid4()),
                student_id=student.id,
                embedding_vector=json.dumps(emb_vec.tolist()),
                photo_path=filename,
                pose_label=pose_name
            )
            db.add(face_emb)
            saved_embeddings.append(face_emb)

        except Exception as e:
            print(f"Error processing enrollment photo {idx}: {e}")
            continue

    if not extracted_vectors:
        raise HTTPException(status_code=400, detail="Tidak ada wajah yang berhasil diproses dari foto yang dikirimkan. Pastikan foto memuat wajah yang jelas.")

    # Compute and store centroid embedding for robust multi-angle matching
    if len(extracted_vectors) > 1:
        centroid = face_embedder.compute_centroid(extracted_vectors)
        centroid_record = FaceEmbedding(
            id=str(uuid.uuid4()),
            student_id=student.id,
            embedding_vector=json.dumps(centroid.tolist()),
            photo_path=saved_embeddings[0].photo_path if saved_embeddings else None,
            pose_label="Centroid_Average"
        )
        db.add(centroid_record)

    db.commit()

    return {
        "status": "SUCCESS",
        "student_id": student.id,
        "nis": student.nis,
        "name": student.full_name,
        "embeddings_extracted": len(extracted_vectors),
        "message": f"Berhasil mendaftarkan {student.full_name} dengan {len(extracted_vectors)} sampel wajah."
    }

@router.get("/photo/{filename}")
def get_student_photo(filename: str):
    """Serve student face photo."""
    path = settings.STUDENT_PHOTOS_DIR / filename
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Foto tidak ditemukan.")
    return FileResponse(str(path))

@router.delete("/{student_id}")
def delete_student(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Siswa tidak ditemukan.")
    
    # Delete associated photos
    for emb in student.embeddings:
        if emb.photo_path:
            p = settings.STUDENT_PHOTOS_DIR / emb.photo_path
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    db.delete(student)
    db.commit()
    return {"status": "SUCCESS", "message": f"Siswa {student.full_name} berhasil dihapus."}
