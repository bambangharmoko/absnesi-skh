import sys
from pathlib import Path

# Add api directory to sys.path for self-contained serverless bundle
api_dir = Path(__file__).resolve().parent
if str(api_dir) not in sys.path:
    sys.path.insert(0, str(api_dir))

root_dir = api_dir.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

try:
    from backend.app.main import app
except Exception:
    try:
        from app.main import app
    except Exception as e:
        import traceback
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse
        app = FastAPI()
        err_detail = f"Import Error: {str(e)}\n{traceback.format_exc()}"
        
        @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
        def err_route(path: str):
            return JSONResponse(status_code=500, content={"detail": err_detail})

__all__ = ["app"]
