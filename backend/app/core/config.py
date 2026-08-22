import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load .env file from backend root or parent
for p in [BASE_DIR / ".env", BASE_DIR / "backend" / ".env", Path(".env")]:
    if p.exists():
        load_dotenv(dotenv_path=p)
        break

def find_model_path(filename: str) -> Path:
    candidates = [
        BASE_DIR / "app" / "models" / filename,
        BASE_DIR / "backend" / "app" / "models" / filename,
        Path(__file__).resolve().parent.parent / "models" / filename,
        Path.cwd() / "backend" / "app" / "models" / filename,
        Path.cwd() / "app" / "models" / filename,
        Path("/var/task/backend/app/models") / filename,
        Path("/var/task/app/models") / filename,
    ]
    for c in candidates:
        if c.exists():
            return c
    return BASE_DIR / "app" / "models" / filename

class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Absensi SKH Face Recognition API")
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Serverless detection (Vercel / Lambda)
    is_serverless: bool = bool(os.getenv("VERCEL") == "1" or "AWS_LAMBDA_FUNCTION_NAME" in os.environ)
    
    # Database URL: Active Supabase Cloud PostgreSQL with fallback
    default_supabase_url = "postgresql://postgres.lygoswawqplklqvnouao:Wkwkland55.@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require"
    raw_db_url: str = os.getenv("DATABASE_URL", default_supabase_url)
    
    if not raw_db_url or (is_serverless and raw_db_url.startswith("sqlite")):
        raw_db_url = default_supabase_url
        
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
    DATABASE_URL: str = raw_db_url
    
    # Supabase Client Credentials
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://lygoswawqplklqvnouao.supabase.co")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
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
    YUNET_MODEL_PATH: Path = find_model_path("face_detection_yunet.onnx")
    SFACE_MODEL_PATH: Path = find_model_path("face_recognition_sface.onnx")
    
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
