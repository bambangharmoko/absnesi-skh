import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.app.core.config import settings
from backend.app.db.database import Base, engine, SessionLocal
from backend.app.api.api_router import api_router
from backend.app.db.models import Student, User, FaceEmbedding, Attendance
from backend.seed import seed_initial_data

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API Sistem Absensi Face Recognition Real-time untuk SKH Santo Fransiskus Asisi"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local network / PWA kiosk tablet access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Ensure snapshot dir exists & mount
snapshots_dir = settings.STORAGE_DIR / "attendance_snapshots"
os.makedirs(snapshots_dir, exist_ok=True)
app.mount("/api/v1/attendance/snapshot", StaticFiles(directory=str(snapshots_dir)), name="snapshots")

@app.on_event("startup")
def startup_event():
    """Auto-seed demo data if database is fresh."""
    db = SessionLocal()
    try:
        count = db.query(Student).count()
        if count == 0:
            print("[INFO] Database empty, seeding initial SKH student profiles...")
            seed_initial_data(db)
            print("[SUCCESS] Initial seed data created successfully.")
    except Exception as e:
        print(f"[WARNING] Seeding exception: {e}")
    finally:
        db.close()

@app.get("/")
def root_status():
    return {
        "school": settings.SCHOOL_NAME,
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "ONLINE",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
