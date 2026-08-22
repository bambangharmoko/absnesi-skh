import os
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.app.core.config import settings
from backend.app.db.database import Base, engine, SessionLocal
from backend.app.api.api_router import api_router
from backend.app.db.models import Student, User, FaceEmbedding, Attendance

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API Sistem Absensi Face Recognition Real-time untuk SKH Santo Fransiskus Asisi"
)

# Global Exception Handler to expose exact error messages to frontend
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    error_detail = f"{type(exc).__name__}: {str(exc)}"
    return JSONResponse(
        status_code=500,
        content={"detail": error_detail}
    )

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Ensure snapshot dir exists & mount
try:
    snapshots_dir = settings.STORAGE_DIR / "attendance_snapshots"
    os.makedirs(snapshots_dir, exist_ok=True)
    app.mount("/api/v1/attendance/snapshot", StaticFiles(directory=str(snapshots_dir)), name="snapshots")
except Exception as e:
    print(f"[NOTICE] Static snapshot mount: {e}")

@app.on_event("startup")
def startup_event():
    """Startup initialization for database tables and seed checks."""
    try:
        # Create database tables if fresh (e.g. SQLite local)
        if not settings.is_serverless:
            Base.metadata.create_all(bind=engine)
            
            db = SessionLocal()
            count = db.query(Student).count()
            if count == 0:
                print("[INFO] Database empty, seeding initial SKH student profiles...")
                from backend.seed import seed_initial_data
                seed_initial_data(db)
                print("[SUCCESS] Initial seed data created successfully.")
            db.close()
    except Exception as e:
        print(f"[NOTICE] Startup check: {e}")

@app.get("/")
def root_status():
    return {
        "school": settings.SCHOOL_NAME,
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "ONLINE",
        "database": "Supabase PostgreSQL" if "supabase" in settings.DATABASE_URL else "SQLite",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
