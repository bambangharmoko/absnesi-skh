import sys
import argparse
from sqlalchemy import create_engine, text
from backend.app.core.config import settings

def test_connection(db_url: str):
    print("Testing database connection to:", db_url.split('@')[-1] if '@' in db_url else db_url)
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    try:
        engine = create_engine(db_url, pool_pre_ping=True)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 AS connected, current_database(), version();")).fetchone()
            print("\n[SUCCESS] Connection to Supabase PostgreSQL established!")
            print(f"Connected Database : {result[1]}")
            print(f"PostgreSQL Version : {result[2].split(',')[0]}")
    except Exception as e:
        print(f"\n[FAILED] Connection error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", type=str, default="", help="PostgreSQL connection string")
    args = parser.parse_args()

    url = args.url or settings.DATABASE_URL
    if not url or url.startswith("sqlite"):
        print("DATABASE_URL is currently using SQLite. Provide a PostgreSQL URL with --url to test.")
    else:
        test_connection(url)
