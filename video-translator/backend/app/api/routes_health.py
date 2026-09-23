import logging
from fastapi import APIRouter
import redis
from app.core.config import settings
from app.services.ffmpeg_service import FFmpegService
from app.services.whisper_service import WhisperService
from app.services.translation_service import get_translation_provider

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
def get_health():
    # 1. FFmpeg
    ffmpeg_ok = FFmpegService.check_installed()

    # 2. FFprobe
    ffprobe_ok = FFmpegService.check_ffprobe_installed()

    # 3. Redis
    redis_ok = False
    try:
        r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        redis_ok = (r.ping() is True)
    except Exception as e:
        logger.warning(f"Health check Redis ping failed: {e}")

    # 4. Whisper
    whisper_ok = WhisperService().is_available()

    # 5. LibreTranslate
    lt_ok = False
    try:
        provider = get_translation_provider()
        lt_ok = provider.is_healthy()
    except Exception as e:
        logger.warning(f"Health check LibreTranslate failed: {e}")

    all_ok = ffmpeg_ok and ffprobe_ok and redis_ok and whisper_ok and lt_ok

    return {
        "status": "ok" if all_ok else "degraded",
        "ffmpeg": ffmpeg_ok,
        "ffprobe": ffprobe_ok,
        "whisper": whisper_ok,
        "redis": redis_ok,
        "libretranslate": lt_ok
    }
