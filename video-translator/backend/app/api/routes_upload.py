import json
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, Request, status
from fastapi.responses import FileResponse, StreamingResponse
import redis

from app.core.config import settings
from app.services.ffmpeg_service import FFmpegService

logger = logging.getLogger(__name__)
router = APIRouter()
redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


def send_bytes_range_requests(
    file_path: Path,
    start: int,
    end: int,
    chunk_size: int = 1024 * 1024
):
    with open(file_path, mode="rb") as f:
        f.seek(start)
        pos = start
        while pos <= end:
            read_size = min(chunk_size, end - pos + 1)
            data = f.read(read_size)
            if not data:
                break
            pos += len(data)
            yield data


def stream_video_file(file_path: Path, request: Request):
    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")

    content_type = "video/mp4"
    if file_path.suffix.lower() == ".webm":
        content_type = "video/webm"
    elif file_path.suffix.lower() == ".mkv":
        content_type = "video/x-matroska"
    elif file_path.suffix.lower() == ".mov":
        content_type = "video/quicktime"

    if range_header:
        # e.g., "bytes=0-1024"
        parts = range_header.replace("bytes=", "").split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1

        if start >= file_size or end >= file_size or start > end:
            raise HTTPException(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                detail="Requested range not satisfiable",
                headers={"Content-Range": f"bytes */{file_size}"}
            )

        content_length = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": content_type,
        }
        return StreamingResponse(
            send_bytes_range_requests(file_path, start, end),
            status_code=206,
            headers=headers
        )

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": content_type,
    }
    return StreamingResponse(
        send_bytes_range_requests(file_path, 0, file_size - 1),
        status_code=200,
        headers=headers
    )


@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    Upload a real video file.
    Validates extension and max file size, extracts metadata using ffprobe,
    and generates a real video thumbnail using ffmpeg.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")

    original_filename = file.filename
    ext = Path(original_filename).suffix.lower()

    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format. Allowed formats: {', '.join(sorted(settings.ALLOWED_EXTENSIONS))}"
        )

    video_id = str(uuid.uuid4())
    video_filename = f"{video_id}{ext}"
    video_path = settings.uploads_dir / video_filename
    thumb_path = settings.uploads_dir / f"{video_id}_thumb.jpg"

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    total_bytes = 0

    try:
        with open(video_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    if video_path.exists():
                        video_path.unlink()
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum upload size of {settings.MAX_UPLOAD_SIZE_MB}MB."
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if video_path.exists():
            video_path.unlink()
        logger.exception("Upload failed")
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {str(e)}")

    # Real FFprobe metadata extraction
    try:
        meta = FFmpegService.get_metadata(video_path)
    except Exception as e:
        if video_path.exists():
            video_path.unlink()
        raise HTTPException(status_code=400, detail=f"Invalid video file: {str(e)}")

    duration = meta.get("duration", 0.0)
    has_audio = meta.get("has_audio", False)
    if not has_audio:
        logger.warning(f"Video {video_id} has no detected audio stream.")

    # Generate real thumbnail using FFmpeg
    thumb_timestamp = min(1.0, duration / 2.0) if duration > 0 else 0.5
    thumb_ok = FFmpegService.generate_thumbnail(video_path, thumb_path, timestamp=thumb_timestamp)

    upload_data = {
        "video_id": video_id,
        "original_filename": original_filename,
        "video_filename": video_filename,
        "video_path": str(video_path),
        "thumbnail_path": str(thumb_path) if thumb_ok else "",
        "file_size": total_bytes,
        "duration": duration,
        "width": meta.get("width", 0),
        "height": meta.get("height", 0),
        "video_codec": meta.get("video_codec"),
        "audio_codec": meta.get("audio_codec"),
        "has_audio": has_audio
    }

    # Store upload data in Redis (expires in 48 hours)
    redis_client.setex(f"upload:{video_id}", 172800, json.dumps(upload_data))

    return {
        "video_id": video_id,
        "original_filename": original_filename,
        "file_size": total_bytes,
        "duration": duration,
        "width": meta.get("width", 0),
        "height": meta.get("height", 0),
        "has_audio": has_audio,
        "thumbnail_url": f"/api/uploads/{video_id}/thumbnail" if thumb_ok else None,
        "video_url": f"/api/uploads/{video_id}/stream"
    }


@router.get("/uploads/{video_id}/thumbnail")
def get_thumbnail(video_id: str):
    data = redis_client.get(f"upload:{video_id}")
    if not data:
        raise HTTPException(status_code=404, detail="Video upload not found")

    upload_info = json.loads(data)
    thumb_path = Path(upload_info.get("thumbnail_path", ""))
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not available")

    return FileResponse(thumb_path, media_type="image/jpeg")


@router.get("/uploads/{video_id}/stream")
def stream_video(video_id: str, request: Request):
    data = redis_client.get(f"upload:{video_id}")
    if not data:
        raise HTTPException(status_code=404, detail="Video upload not found")

    upload_info = json.loads(data)
    video_path = Path(upload_info.get("video_path", ""))
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    return stream_video_file(video_path, request)
