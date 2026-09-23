import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
import redis

from app.core.config import settings
from app.schemas.job import JobCreate, JobResponse, JobStatus
from app.api.routes_upload import stream_video_file

logger = logging.getLogger(__name__)
router = APIRouter()
redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


def build_job_response(job: dict) -> JobResponse:
    job_id = job["job_id"]
    return JobResponse(
        job_id=job_id,
        status=JobStatus(job["status"]),
        progress=job.get("progress", 0),
        current_step=job.get("current_step", "Queued"),
        error=job.get("error"),
        source_language=job.get("source_language", "auto"),
        detected_language=job.get("detected_language"),
        target_language=job.get("target_language", "km"),
        original_filename=job.get("original_filename", "video.mp4"),
        duration=job.get("duration", 0.0),
        file_size=job.get("file_size", 0),
        thumbnail_url=job.get("thumbnail_url"),
        video_url=f"/api/uploads/{job.get('video_id')}/stream" if job.get("video_id") else None,
        rendered_video_url=f"/api/jobs/{job_id}/preview/video" if job.get("has_rendered_video") else None,
        srt_url=f"/api/jobs/{job_id}/download/srt" if job.get("has_subtitles") else None,
        vtt_url=f"/api/jobs/{job_id}/download/vtt" if job.get("has_subtitles") else None,
        created_at=job.get("created_at", datetime.now(timezone.utc).isoformat()),
        updated_at=job.get("updated_at", datetime.now(timezone.utc).isoformat()),
    )


@router.post("/jobs", response_model=JobResponse)
def create_job(payload: JobCreate, background_tasks: BackgroundTasks):
    """
    Submits a video translation job.
    Enqueues Celery background task for video processing.
    """
    upload_data_str = redis_client.get(f"upload:{payload.video_id}")
    if not upload_data_str:
        raise HTTPException(status_code=404, detail="Uploaded video not found or expired.")

    upload_data = json.loads(upload_data_str)
    job_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    job = {
        "job_id": job_id,
        "video_id": payload.video_id,
        "video_path": upload_data["video_path"],
        "original_filename": upload_data["original_filename"],
        "source_language": payload.source_language,
        "target_language": payload.target_language,
        "status": JobStatus.QUEUED.value,
        "progress": 0,
        "current_step": "Queued in processing pool",
        "error": None,
        "duration": upload_data.get("duration", 0.0),
        "file_size": upload_data.get("file_size", 0),
        "thumbnail_url": f"/api/uploads/{payload.video_id}/thumbnail",
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    redis_client.setex(f"job:{job_id}", 172800, json.dumps(job))

    # Trigger task in Celery worker (with fallback to background task if Celery broker is standalone)
    try:
        from app.workers.tasks import process_video_translation
        process_video_translation.delay(job_id)
        logger.info(f"Enqueued Celery task for job {job_id}")
    except Exception as e:
        logger.warning(f"Celery dispatch failed ({e}), dispatching via FastAPI background task executor.")
        from app.workers.tasks import process_video_translation
        background_tasks.add_task(process_video_translation, job_id)

    return build_job_response(job)


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job_status(job_id: str):
    """
    Retrieves current job status, progress, and download links.
    """
    job_str = redis_client.get(f"job:{job_id}")
    if not job_str:
        raise HTTPException(status_code=404, detail="Job not found")

    job = json.loads(job_str)
    return build_job_response(job)


@router.get("/jobs/{job_id}/events")
async def stream_job_events(job_id: str, request: Request):
    """
    Real-time Server-Sent Events (SSE) stream for real job progress.
    Publishes actual status updates directly from Celery / FFmpeg / faster-whisper.
    """
    job_str = redis_client.get(f"job:{job_id}")
    if not job_str:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        # First send the initial current state
        initial_job = json.loads(redis_client.get(f"job:{job_id}") or "{}")
        if initial_job:
            yield {
                "event": "message",
                "data": json.dumps(initial_job)
            }
            if initial_job.get("status") in (JobStatus.COMPLETED.value, JobStatus.FAILED.value):
                return

        # Subscribe to Redis pubsub channel
        pubsub = redis_client.pubsub()
        pubsub.subscribe(f"job_events:{job_id}")

        try:
            while True:
                if await request.is_disconnected():
                    break

                message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message.get("type") == "message":
                    data = message.get("data")
                    yield {
                        "event": "message",
                        "data": data
                    }
                    try:
                        parsed = json.loads(data)
                        if parsed.get("status") in (JobStatus.COMPLETED.value, JobStatus.FAILED.value):
                            break
                    except Exception:
                        pass

                await asyncio.sleep(0.5)
        finally:
            pubsub.unsubscribe(f"job_events:{job_id}")
            pubsub.close()

    return EventSourceResponse(event_generator())


@router.get("/jobs/{job_id}/download/srt")
def download_srt(job_id: str):
    job_str = redis_client.get(f"job:{job_id}")
    if not job_str:
        raise HTTPException(status_code=404, detail="Job not found")
    job = json.loads(job_str)

    srt_path = settings.subtitles_dir / f"{job_id}.srt"
    if not srt_path.exists():
        raise HTTPException(status_code=404, detail="SRT subtitle file not found")

    stem = Path(job.get("original_filename", "video")).stem
    tgt = job.get("target_language", "trans")
    return FileResponse(
        srt_path,
        media_type="application/x-subrip",
        filename=f"{stem}_{tgt}.srt"
    )


@router.get("/jobs/{job_id}/download/vtt")
def download_vtt(job_id: str):
    job_str = redis_client.get(f"job:{job_id}")
    if not job_str:
        raise HTTPException(status_code=404, detail="Job not found")
    job = json.loads(job_str)

    vtt_path = settings.subtitles_dir / f"{job_id}.vtt"
    if not vtt_path.exists():
        raise HTTPException(status_code=404, detail="VTT subtitle file not found")

    stem = Path(job.get("original_filename", "video")).stem
    tgt = job.get("target_language", "trans")
    return FileResponse(
        vtt_path,
        media_type="text/vtt",
        filename=f"{stem}_{tgt}.vtt"
    )


@router.get("/jobs/{job_id}/download/video")
def download_video(job_id: str):
    job_str = redis_client.get(f"job:{job_id}")
    if not job_str:
        raise HTTPException(status_code=404, detail="Job not found")
    job = json.loads(job_str)

    video_path = settings.output_dir / f"{job_id}_translated.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Translated video has not been rendered yet")

    stem = Path(job.get("original_filename", "video")).stem
    tgt = job.get("target_language", "trans")
    return FileResponse(
        video_path,
        media_type="video/mp4",
        filename=f"{stem}_translated_{tgt}.mp4"
    )


@router.get("/jobs/{job_id}/preview/video")
def preview_translated_video(job_id: str, request: Request):
    video_path = settings.output_dir / f"{job_id}_translated.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Rendered video not found")

    return stream_video_file(video_path, request)
