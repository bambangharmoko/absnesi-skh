import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load .env file from backend root
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Absensi SKH Face Recognition API")
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database: Supabase PostgreSQL or fallback SQLite
    raw_db_url: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'absensi_skh.db'}")
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
    DATABASE_URL: str = raw_db_url
    
    # Supabase Client Credentials
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # Serverless / Read-only filesystem detection (Vercel / Lambda)
    is_serverless: bool = bool(os.getenv("VERCEL") == "1" or "AWS_LAMBDA_FUNCTION_NAME" in os.environ)
    
    if is_serverless:
        temp_base = Path("/tmp")
        STORAGE_DIR: Path = temp_base / "data"
        STUDENT_PHOTOS_DIR: Path = temp_base / "data" / "student_photos"
        EMBEDDINGS_DIR: Path = temp_base / "data" / "embeddings"
        EXPORTS_DIR: Path = temp_base / "data" / "exports"
    else:
        STORAGE_DIR: Path = BASE_DIR / "data"
        STUDENT_PHOTOS_DIR: Path = BASE_DIR / "data" / "student_photos"
        EMBEDDINGS_DIR: Path = BASE_DIR / "data" / "embeddings"
        EXPORTS_DIR: Path = BASE_DIR / "data" / "exports"
        
    MODELS_DIR: Path = BASE_DIR / "app" / "models"
    
    # Deep Learning Model Paths (YuNet Face Detector & SFace Feature Recognizer)
    YUNET_MODEL_PATH: Path = BASE_DIR / "app" / "models" / "face_detection_yunet.onnx"
    SFACE_MODEL_PATH: Path = BASE_DIR / "app" / "models" / "face_recognition_sface.onnx"
    
    # Face Recognition Config
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.35"))
    MIN_FACE_SIZE: int = 40
    COOLDOWN_MINUTES: int = int(os.getenv("COOLDOWN_MINUTES", "60"))
    
    # School Operational Hours
    SCHOOL_START_TIME: str = os.getenv("SCHOOL_START_TIME", "07:30")
    SCHOOL_NAME: str = "SKH Santo Fransiskus Asisi"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "skh-fransiskus-asisi-super-secret-key-2026")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))

settings = Settings()

# Ensure directories exist safely
try:
    os.makedirs(settings.STORAGE_DIR, exist_ok=True)
    os.makedirs(settings.STUDENT_PHOTOS_DIR, exist_ok=True)
    os.makedirs(settings.EMBEDDINGS_DIR, exist_ok=True)
    os.makedirs(settings.EXPORTS_DIR, exist_ok=True)
    os.makedirs(settings.MODELS_DIR, exist_ok=True)
except Exception as e:
    print(f"[NOTICE] Storage directory init: {e}")
