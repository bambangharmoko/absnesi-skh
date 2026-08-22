from fastapi import APIRouter
from backend.app.api.endpoints import auth, students, attendance, recognition, reports

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(students.router, prefix="/students", tags=["Students"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["Attendance"])
api_router.include_router(recognition.router, prefix="/recognition", tags=["Face Recognition"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
