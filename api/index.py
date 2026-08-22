import sys
import os
from pathlib import Path

# Add project root and backend dir to sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

for p in [str(root_dir), str(backend_dir), str(Path.cwd()), str(Path.cwd() / "backend")]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.app.main import app
except Exception as e:
    import traceback
    traceback.print_exc()
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    app = FastAPI()
    err_str = f"Startup Import Error: {type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
    
    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE"])
    async def catch_all(path_name: str):
        return JSONResponse(
            status_code=500,
            content={"detail": err_str}
        )

__all__ = ["app"]
