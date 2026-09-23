import json
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
import redis

from app.core.config import settings
from app.schemas.subtitle import SubtitleItem, SubtitleListUpdate, SubtitleListResponse
from app.services.subtitle_service import SubtitleService

logger = logging.getLogger(__name__)
router = APIRouter()
redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


@router.get("/jobs/{job_id}/subtitles", response_model=SubtitleListResponse)
def get_subtitles(job_id: str):
    """
    Retrieves the list of subtitle segments (original and translated) for editing.
    """
    job_str = redis_client.get(f"job:{job_id}")
    if not job_str:
        raise HTTPException(status_code=404, detail="Job not found")

    job = json.loads(job_str)
    subs_str = redis_client.get(f"subtitles:{job_id}")

    items = []
    if subs_str:
        items = [SubtitleItem(**item) for item in json.loads(subs_str)]
    else:
        # Fallback to reading disk SRT if Redis key expired
        srt_path = settings.subtitles_dir / f"{job_id}.srt"
        if srt_path.exists():
            items = SubtitleService.parse_srt(srt_path.read_text(encoding="utf-8"))

    return SubtitleListResponse(
        job_id=job_id,
        source_language=job.get("source_language", "auto"),
        target_language=job.get("target_language", "km"),
        subtitles=items
    )


@router.put("/jobs/{job_id}/subtitles", response_model=SubtitleListResponse)
def update_subtitles(job_id: str, payload: SubtitleListUpdate):
    """
    Updates the real subtitle data on the backend.
    Re-generates SRT and VTT files with user edits.
    """
    job_str = redis_client.get(f"job:{job_id}")
    if not job_str:
        raise HTTPException(status_code=404, detail="Job not found")

    job = json.loads(job_str)

    # Re-index ids to guarantee sequential ordering
    normalized_items: list[SubtitleItem] = []
    for idx, item in enumerate(payload.subtitles, 1):
        if item.start > item.end:
            item.end = item.start + 0.5
        normalized_items.append(
            SubtitleItem(
                id=idx,
                start=round(item.start, 3),
                end=round(item.end, 3),
                text=item.text,
                translation=item.translation
            )
        )

    # Update in Redis
    subs_dict = [item.model_dump() for item in normalized_items]
    redis_client.setex(f"subtitles:{job_id}", 172800, json.dumps(subs_dict))

    # Re-write files on disk
    srt_path = settings.subtitles_dir / f"{job_id}.srt"
    vtt_path = settings.subtitles_dir / f"{job_id}.vtt"
    SubtitleService.save_srt(normalized_items, srt_path, use_translation=True)
    SubtitleService.save_vtt(normalized_items, vtt_path, use_translation=True)

    logger.info(f"Updated {len(normalized_items)} subtitles for job {job_id}")

    return SubtitleListResponse(
        job_id=job_id,
        source_language=job.get("source_language", "auto"),
        target_language=job.get("target_language", "km"),
        subtitles=normalized_items
    )


@router.get("/jobs/{job_id}/subtitles/vtt")
def get_vtt_stream(job_id: str):
    """
    Serves WebVTT subtitle track for HTML5 video player preview.
    """
    vtt_path = settings.subtitles_dir / f"{job_id}.vtt"
    if not vtt_path.exists():
        raise HTTPException(status_code=404, detail="VTT file not found")

    content = vtt_path.read_text(encoding="utf-8")
    return Response(
        content=content,
        media_type="text/vtt; charset=utf-8",
        headers={"Access-Control-Allow-Origin": "*"}
    )
