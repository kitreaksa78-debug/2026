import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api import api_router
from app.services.ffmpeg_service import FFmpegService
from app.services.whisper_service import WhisperService
from app.services.translation_service import get_translation_provider

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("video_translator")


def validate_environment_on_startup():
    """
    Validates essential system dependencies on startup as per requirement 28:
    FFmpeg, FFprobe, Redis connection, LibreTranslate, Whisper.
    """
    logger.info("=== Video Translator: Running Startup Diagnostics ===")

    # 1. FFmpeg & FFprobe
    if not FFmpegService.check_installed():
        logger.error("STARTUP ERROR: FFmpeg is not installed or not in PATH!")
    else:
        logger.info("✓ FFmpeg is installed and accessible.")

    if not FFmpegService.check_ffprobe_installed():
        logger.error("STARTUP ERROR: FFprobe is not installed or not in PATH!")
    else:
        logger.info("✓ FFprobe is installed and accessible.")

    # 2. Redis
    try:
        import redis
        r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        if r.ping():
            logger.info(f"✓ Redis connection successful at {settings.REDIS_URL}")
    except Exception as e:
        logger.error(f"STARTUP ERROR: Redis connection failed at {settings.REDIS_URL}: {e}")

    # 3. Whisper
    try:
        whisper = WhisperService()
        if whisper.is_available():
            logger.info(f"✓ faster-whisper is installed (configured: {whisper.model_name}, {whisper.device})")
    except Exception as e:
        logger.error(f"STARTUP ERROR: faster-whisper validation failed: {e}")

    # 4. LibreTranslate
    try:
        provider = get_translation_provider()
        if provider.is_healthy():
            logger.info(f"✓ LibreTranslate reachable at {settings.LIBRETRANSLATE_URL}")
        else:
            logger.warning(f"LibreTranslate not responding at {settings.LIBRETRANSLATE_URL}. Ensure container is running.")
    except Exception as e:
        logger.warning(f"LibreTranslate check error: {e}")

    logger.info("=== Startup Diagnostics Completed ===")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure storage paths exist
    _ = settings.uploads_dir
    _ = settings.audio_dir
    _ = settings.subtitles_dir
    _ = settings.output_dir
    _ = settings.temp_dir

    validate_environment_on_startup()
    yield
    logger.info("Shutting down Video Translator API...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Real-world AI-powered video subtitle translation pipeline with faster-whisper, LibreTranslate, and FFmpeg.",
    lifespan=lifespan
)

# CORS Security configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production deployments can restrict to specific domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """
    Prevents leaking internal server paths and raw stack traces as per requirement 32.
    """
    logger.exception(f"Unhandled error processing {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred while processing your video. Please try again."}
    )


# Mount all API endpoints under /api
app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    return {
        "app": "Video Translator API",
        "status": "online",
        "version": settings.VERSION,
        "docs": "/docs"
    }
