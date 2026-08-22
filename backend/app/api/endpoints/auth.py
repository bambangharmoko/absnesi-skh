from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import User

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Teacher / Admin login."""
    user = db.query(User).filter(User.username == payload.username).first()
    # For initial easy access / demo, allow standard credentials
    if not user:
        if payload.username == "admin" and payload.password == "admin123":
            return {
                "token": "skh-demo-token-admin",
                "user": {
                    "id": "usr-admin",
                    "username": "admin",
                    "full_name": "Administrator SKH",
                    "role": "ADMIN"
                }
            }
        elif payload.username == "guru" and payload.password == "guru123":
            return {
                "token": "skh-demo-token-guru",
                "user": {
                    "id": "usr-guru",
                    "username": "guru",
                    "full_name": "Ibu Guru Maria, S.Pd",
                    "role": "GURU_KELAS"
                }
            }
        raise HTTPException(status_code=401, detail="Username atau password salah.")
    
    return {
        "token": f"skh-token-{user.id}",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role
        }
    }
