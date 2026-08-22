import os
import sys
import argparse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.core.config import settings
from backend.app.db.models import Base, User, Student, FaceEmbedding, Attendance

def run_migration(sqlite_path: str, target_db_url: str):
    print("==================================================================")
    print("       SKH SANTO FRANSISKUS ASISI - SUPABASE MIGRATION TOOL       ")
    print("==================================================================")
    print(f"Source SQLite DB   : {sqlite_path}")
    print(f"Target Database URL: {target_db_url.split('@')[-1] if '@' in target_db_url else target_db_url}")
    print("------------------------------------------------------------------")

    if not os.path.exists(sqlite_path):
        print(f"[ERROR] Source SQLite database not found at: {sqlite_path}")
        sys.exit(1)

    # 1. Connect to SQLite Source
    sqlite_engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})
    SourceSession = sessionmaker(bind=sqlite_engine)
    source_session = SourceSession()

    # 2. Connect to Target Supabase Engine
    if target_db_url.startswith("postgres://"):
        target_db_url = target_db_url.replace("postgres://", "postgresql://", 1)

    try:
        target_engine = create_engine(target_db_url, pool_pre_ping=True)
        print("\n[1/5] Creating / Verifying database tables in Supabase...")
        Base.metadata.create_all(bind=target_engine)
        print("  [OK] Tables verified successfully (users, students, face_embeddings, attendances).")
    except Exception as e:
        print(f"[ERROR] Failed to connect to Supabase: {e}")
        print("\nTips: Pastikan Connection URI Anda benar dan mencakup password database.")
        sys.exit(1)

    TargetSession = sessionmaker(bind=target_engine)
    target_session = TargetSession()

    try:
        # 3. Migrate Users
        print("\n[2/5] Migrating Users (Guru & Admin)...")
        source_users = source_session.query(User).all()
        user_count = 0
        for u in source_users:
            existing = target_session.query(User).filter(User.id == u.id).first()
            if not existing:
                new_user = User(
                    id=u.id,
                    username=u.username,
                    hashed_password=u.hashed_password,
                    full_name=u.full_name,
                    role=u.role,
                )
                target_session.add(new_user)
                user_count += 1
        target_session.commit()
        print(f"  [OK] Migrated/Synced {len(source_users)} users.")

        # 4. Migrate Students
        print("\n[3/5] Migrating Students (Data Siswa SKH)...")
        source_students = source_session.query(Student).all()
        for s in source_students:
            existing = target_session.query(Student).filter(Student.id == s.id).first()
            if not existing:
                new_student = Student(
                    id=s.id,
                    nis=s.nis,
                    full_name=s.full_name,
                    nickname=s.nickname,
                    class_name=s.class_name,
                    category=s.category,
                    is_active=s.is_active,
                )
                target_session.add(new_student)
            else:
                existing.nis = s.nis
                existing.full_name = s.full_name
                existing.nickname = s.nickname
                existing.class_name = s.class_name
                existing.category = s.category
                existing.is_active = s.is_active
        target_session.commit()
        print(f"  [OK] Migrated/Synced {len(source_students)} students (including Jonathan, Budi, etc.).")

        # 5. Migrate Face Embeddings
        print("\n[4/5] Migrating Face Embeddings (128-d SFace Vectors)...")
        source_embs = source_session.query(FaceEmbedding).all()
        for emb in source_embs:
            existing = target_session.query(FaceEmbedding).filter(FaceEmbedding.id == emb.id).first()
            if not existing:
                new_emb = FaceEmbedding(
                    id=emb.id,
                    student_id=emb.student_id,
                    embedding_vector=emb.embedding_vector,
                    photo_path=emb.photo_path,
                    pose_label=emb.pose_label,
                )
                target_session.add(new_emb)
            else:
                existing.embedding_vector = emb.embedding_vector
                existing.photo_path = emb.photo_path
                existing.pose_label = emb.pose_label
        target_session.commit()
        print(f"  [OK] Migrated/Synced {len(source_embs)} face embedding vectors.")

        # 6. Migrate Attendances
        print("\n[5/5] Migrating Attendance Records...")
        source_atts = source_session.query(Attendance).all()
        for att in source_atts:
            existing = target_session.query(Attendance).filter(Attendance.id == att.id).first()
            if not existing:
                new_att = Attendance(
                    id=att.id,
                    student_id=att.student_id,
                    date=att.date,
                    time_in=att.time_in,
                    status=att.status,
                    confidence_score=att.confidence_score,
                    verification_method=att.verification_method,
                    captured_photo=att.captured_photo,
                    notes=att.notes,
                )
                target_session.add(new_att)
        target_session.commit()
        print(f"  [OK] Migrated/Synced {len(source_atts)} attendance records.")

        print("\n==================================================================")
        print("          MIGRATION TO SUPABASE COMPLETED SUCCESSFULLY!           ")
        print("==================================================================")
        print(f"Summary:")
        print(f"- Total Students Transferred        : {len(source_students)}")
        print(f"- Total Face Embeddings Transferred : {len(source_embs)}")
        print(f"- Total Attendances Transferred     : {len(source_atts)}")
        print("\n[NEXT STEP]:")
        print("Database Supabase Anda sudah aktif dan terisi penuh.")
        print("URL koneksi di 'backend/.env' telah dikonfigurasi ke Supabase!")

    except Exception as e:
        target_session.rollback()
        print(f"[ERROR] Migration failed during data transfer: {e}")
        sys.exit(1)
    finally:
        source_session.close()
        target_session.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate SQLite DB to Supabase PostgreSQL")
    parser.add_argument(
        "--target-url",
        type=str,
        default="",
        help="Supabase PostgreSQL Connection URI. If empty, reads DATABASE_URL from .env"
    )
    args = parser.parse_args()

    sqlite_db_path = str(settings.STORAGE_DIR / "absensi_skh.db")
    target_url = args.target_url or settings.DATABASE_URL

    if not target_url or target_url.startswith("sqlite"):
        print("[NOTICE] Target URL belum diatur atau masih menunjuk ke SQLite.")
        sys.exit(0)

    run_migration(sqlite_db_path, target_url)
