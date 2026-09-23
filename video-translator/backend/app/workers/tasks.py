import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

import redis
from app.core.config import settings
from app.schemas.job import JobStatus, SubtitleStyle
from app.schemas.subtitle import SubtitleItem
from app.services.ffmpeg_service import FFmpegService
from app.services.whisper_service import WhisperService
from app.services.translation_service import get_translation_provider
from app.services.subtitle_service import SubtitleService
from .celery_app import celery_app

logger = logging.getLogger(__name__)

# Redis client for job state and event publishing
redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    data = redis_client.get(f"job:{job_id}")
    if not data:
        return None
    return json.loads(data)


def update_job(
    job_id: str,
    status: JobStatus,
    progress: int,
    current_step: str,
    error: Optional[str] = None,
    extra_fields: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    job = get_job(job_id)
    if not job:
        raise ValueError(f"Job not found: {job_id}")

    job["status"] = status.value
    job["progress"] = max(0, min(100, progress))
    job["current_step"] = current_step
    job["error"] = error
    job["updated_at"] = datetime.now(timezone.utc).isoformat()

    if extra_fields:
        job.update(extra_fields)

    # Save to Redis with 48h expiration
    redis_client.setex(f"job:{job_id}", 172800, json.dumps(job))

    # Publish real-time event
    event_payload = json.dumps({
        "job_id": job_id,
        "status": job["status"],
        "progress": job["progress"],
        "current_step": job["current_step"],
        "error": job["error"],
        "updated_at": job["updated_at"]
    })
    redis_client.publish(f"job_events:{job_id}", event_payload)
    return job


@celery_app.task(bind=True, name="app.workers.tasks.process_video_translation")
def process_video_translation(self, job_id: str):
    """
    Main asynchronous video processing pipeline:
    1. Extract Audio via FFmpeg
    2. Transcribe Audio via faster-whisper
    3. Translate Segments via LibreTranslate
    4. Generate Real SRT and VTT Subtitles
    5. Clean up temporary audio file
    """
    job = get_job(job_id)
    if not job:
        logger.error(f"Cannot start task: Job {job_id} not found in Redis.")
        return False

    video_path = Path(job["video_path"])
    audio_path = settings.audio_dir / f"{job_id}.wav"
    srt_path = settings.subtitles_dir / f"{job_id}.srt"
    vtt_path = settings.subtitles_dir / f"{job_id}.vtt"

    try:
        if not video_path.exists():
            raise FileNotFoundError(f"Video file does not exist: {video_path}")

        # Step 1: Extract Audio
        update_job(
            job_id,
            status=JobStatus.EXTRACTING_AUDIO,
            progress=15,
            current_step="Extracting Audio from Video"
        )
        FFmpegService.extract_audio(video_path, audio_path)

        # Step 2: Transcribe via faster-whisper
        update_job(
            job_id,
            status=JobStatus.TRANSCRIBING,
            progress=30,
            current_step="Transcribing speech with faster-whisper"
        )

        whisper = WhisperService()
        source_lang = job.get("source_language", "auto")

        def on_transcribe_progress(current_sec, total_sec):
            if total_sec > 0:
                pct = int(30 + (current_sec / total_sec) * 30)
                update_job(
                    job_id,
                    status=JobStatus.TRANSCRIBING,
                    progress=min(60, pct),
                    current_step=f"Transcribing audio ({int(current_sec)}s / {int(total_sec)}s)"
                )

        try:
            whisper_result = whisper.transcribe(
                audio_path,
                source_language=source_lang,
                progress_callback=on_transcribe_progress
            )
        except Exception as e:
            logger.exception("Speech recognition failed")
            raise RuntimeError(f"Speech recognition failed: {str(e)}")

        detected_lang = whisper_result.get("language", source_lang)
        segments = whisper_result.get("segments", [])

        if not segments:
            # Handle video with silence or no detectable speech
            logger.info("No speech detected in video.")
            segments = []

        # Step 3: Translate Subtitles
        update_job(
            job_id,
            status=JobStatus.TRANSLATING,
            progress=65,
            current_step="Translating subtitles with LibreTranslate",
            extra_fields={"detected_language": detected_lang}
        )

        target_lang = job.get("target_language", "en")
        effective_source = detected_lang if source_lang == "auto" else source_lang

        translation_provider = get_translation_provider()
        subtitle_items: list[SubtitleItem] = []

        if segments:
            texts_to_translate = [s["text"] for s in segments]
            total_items = len(texts_to_translate)

            try:
                translated_texts = translation_provider.translate_batch(
                    texts_to_translate,
                    effective_source,
                    target_lang
                )
            except Exception as e:
                logger.exception("Translation service error")
                raise RuntimeError(f"Translation service is unavailable: {str(e)}")

            for idx, seg in enumerate(segments):
                trans_text = translated_texts[idx] if idx < len(translated_texts) else seg["text"]
                item = SubtitleItem(
                    id=seg["id"],
                    start=seg["start"],
                    end=seg["end"],
                    text=seg["text"],
                    translation=trans_text
                )
                subtitle_items.append(item)

        # Step 4: Generate Subtitles
        update_job(
            job_id,
            status=JobStatus.GENERATING_SUBTITLES,
            progress=85,
            current_step="Generating SRT and VTT subtitle files"
        )

        SubtitleService.save_srt(subtitle_items, srt_path, use_translation=True)
        SubtitleService.save_vtt(subtitle_items, vtt_path, use_translation=True)

        # Store subtitles in Redis for instant query and editing
        subs_dict = [item.model_dump() for item in subtitle_items]
        redis_client.setex(f"subtitles:{job_id}", 172800, json.dumps(subs_dict))

        # Clean up temporary audio file
        if audio_path.exists():
            try:
                audio_path.unlink()
            except Exception as e:
                logger.warning(f"Could not remove temporary audio file {audio_path}: {e}")

        # Mark pipeline complete
        update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            current_step="Translation completed",
            extra_fields={
                "has_subtitles": True,
                "subtitles_count": len(subtitle_items),
                "srt_path": str(srt_path),
                "vtt_path": str(vtt_path)
            }
        )
        logger.info(f"Video translation pipeline completed successfully for job {job_id}")
        return True

    except Exception as e:
        logger.exception(f"Job {job_id} failed: {e}")
        # Clean up audio if left behind
        if audio_path.exists():
            try:
                audio_path.unlink()
            except Exception:
                pass

        error_message = str(e)
        if "Speech recognition failed" not in error_message and "Translation service is unavailable" not in error_message and "Video rendering failed" not in error_message:
            error_message = f"Processing error: {error_message}"

        update_job(
            job_id,
            status=JobStatus.FAILED,
            progress=0,
            current_step="Failed",
            error=error_message
        )
        return False


@celery_app.task(bind=True, name="app.workers.tasks.render_translated_video")
def render_translated_video(self, job_id: str, style_dict: dict):
    """
    Renders the translated subtitles directly into the video using FFmpeg.
    Produces an actual playable translated MP4.
    """
    job = get_job(job_id)
    if not job:
        raise ValueError(f"Job {job_id} not found")

    video_path = Path(job["video_path"])
    srt_path = settings.subtitles_dir / f"{job_id}.srt"
    output_video_path = settings.output_dir / f"{job_id}_translated.mp4"

    try:
        update_job(
            job_id,
            status=JobStatus.RENDERING,
            progress=90,
            current_step="Rendering translated video with burned subtitles"
        )

        style = SubtitleStyle(**style_dict) if style_dict else SubtitleStyle()
        FFmpegService.burn_subtitles(video_path, srt_path, output_video_path, style)

        update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            current_step="Rendering completed",
            extra_fields={
                "has_rendered_video": True,
                "rendered_video_path": str(output_video_path)
            }
        )
        logger.info(f"Translated video rendered successfully for job {job_id}")
        return True

    except Exception as e:
        logger.exception(f"Rendering failed for job {job_id}: {e}")
        update_job(
            job_id,
            status=JobStatus.FAILED,
            progress=job.get("progress", 0),
            current_step="Video rendering failed",
            error="Video rendering failed."
        )
        return False
