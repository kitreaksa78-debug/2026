import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Video Translator"
    VERSION: str = "1.0.0"

    # Whisper Configuration
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "large-v3")
    WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "auto")
    WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "auto")

    # Translation Service Configuration
    LIBRETRANSLATE_URL: str = os.getenv("LIBRETRANSLATE_URL", "http://127.0.0.1:5000" if os.getenv("IN_DOCKER") != "true" else "http://libretranslate:5000")

    # Redis and Celery
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0" if os.getenv("IN_DOCKER") != "true" else "redis://redis:6379/0")

    # Storage Paths
    STORAGE_PATH: str = os.getenv("STORAGE_PATH", "/data")
    TEMP_PATH: str = os.getenv("TEMP_PATH", "/data/temp")

    # Upload Limits
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "2048"))
    PORT: int = int(os.getenv("PORT", "8000"))

    # Allowed Extensions
    ALLOWED_EXTENSIONS: set = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}

    @property
    def uploads_dir(self) -> Path:
        p = Path(self.STORAGE_PATH) / "uploads"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def audio_dir(self) -> Path:
        p = Path(self.STORAGE_PATH) / "audio"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def subtitles_dir(self) -> Path:
        p = Path(self.STORAGE_PATH) / "subtitles"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def output_dir(self) -> Path:
        p = Path(self.STORAGE_PATH) / "output"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def temp_dir(self) -> Path:
        p = Path(self.TEMP_PATH)
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
