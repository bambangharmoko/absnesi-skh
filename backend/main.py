import sys
from pathlib import Path

# Add paths to sys.path for Vercel serverless environment
backend_dir = Path(__file__).resolve().parent
root_dir = backend_dir.parent

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.main import app

# Vercel WSGI/ASGI entrypoint
__all__ = ["app"]
