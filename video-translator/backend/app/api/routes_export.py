import json
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
import redis

from app.core.config import settings
from app.schemas.job import ExportRequest, JobResponse, JobStatus
from app.api.routes_jobs import build_job_response

logger = logging.getLogger(__name__)
router = APIRouter()
redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


@router.post("/jobs/{job_id}/export", response_model=JobResponse)
def export_translated_video(job_id: str, payload: ExportRequest, background_tasks: BackgroundTasks):
    """
    Initiates FFmpeg rendering to burn translated subtitles into the video.
    Produces a downloadable, playable translated MP4.
    """
    job_str = redis_client.get(f"job:{job_id}")
    if not job_str:
        raise HTTPException(status_code=404, detail="Job not found")

    job = json.loads(job_str)

    srt_path = settings.subtitles_dir / f"{job_id}.srt"
    if not srt_path.exists():
        raise HTTPException(status_code=400, detail="Cannot render video: Subtitles have not been generated yet.")

    style_dict = payload.style.model_dump() if payload.style else {}

    # Trigger Celery worker task or background task
    try:
        from app.workers.tasks import render_translated_video
        render_translated_video.delay(job_id, style_dict)
        logger.info(f"Enqueued Celery render task for job {job_id}")
    except Exception as e:
        logger.warning(f"Celery render dispatch failed ({e}), dispatching via FastAPI background task executor.")
        from app.workers.tasks import render_translated_video
        background_tasks.add_task(render_translated_video, job_id, style_dict)

    job["status"] = JobStatus.RENDERING.value
    job["current_step"] = "Rendering translated video with burned subtitles"
    job["progress"] = 90
    redis_client.setex(f"job:{job_id}", 172800, json.dumps(job))

    return build_job_response(job)
