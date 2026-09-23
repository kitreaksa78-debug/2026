from fastapi import APIRouter
from .routes_upload import router as upload_router
from .routes_jobs import router as jobs_router
from .routes_subtitles import router as subtitles_router
from .routes_export import router as export_router
from .routes_languages import router as languages_router
from .routes_health import router as health_router

api_router = APIRouter()
api_router.include_router(upload_router, tags=["upload"])
api_router.include_router(jobs_router, tags=["jobs"])
api_router.include_router(subtitles_router, tags=["subtitles"])
api_router.include_router(export_router, tags=["export"])
api_router.include_router(languages_router, tags=["languages"])
api_router.include_router(health_router, tags=["health"])

__all__ = ["api_router"]
