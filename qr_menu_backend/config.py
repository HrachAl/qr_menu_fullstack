import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DB_PATH = os.getenv("QR_MENU_DB_PATH", os.path.join(BASE_DIR, "menu.db"))
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
UPLOAD_DIR = os.getenv("QR_MENU_UPLOAD_DIR", os.path.join(BASE_DIR, "build", "new_menu"))
