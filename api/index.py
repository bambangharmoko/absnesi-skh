import sys
import os
from pathlib import Path

# Add project root and backend dir to sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

for p in [str(root_dir), str(backend_dir), str(Path.cwd()), str(Path.cwd() / "backend")]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.app.main import app
from backend.app.api.api_router import api_router

# Include routes on multiple prefixes for Vercel path compatibility
try:
    app.include_router(api_router, prefix="/v1")
except Exception:
    pass

try:
    app.include_router(api_router, prefix="")
except Exception:
    pass

__all__ = ["app"]
