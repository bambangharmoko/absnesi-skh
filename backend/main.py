from backend.app.main import app

# Expose app for Vercel / WSGI / ASGI runners
__all__ = ["app"]
