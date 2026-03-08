import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = os.getenv("QR_MENU_DB_PATH", str(BASE_DIR / "menu.db"))
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
UPLOAD_DIR = os.getenv("QR_MENU_UPLOAD_DIR", str(BASE_DIR / "build" / "new_menu"))
