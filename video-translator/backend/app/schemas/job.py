from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    QUEUED = "queued"
    EXTRACTING_AUDIO = "extracting_audio"
    TRANSCRIBING = "transcribing"
    TRANSLATING = "translating"
    GENERATING_SUBTITLES = "generating_subtitles"
    RENDERING = "rendering"
    COMPLETED = "completed"
    FAILED = "failed"


class SubtitleStyle(BaseModel):
    font_size: int = Field(default=22, ge=12, le=72)
    text_color: str = Field(default="#FFFFFF", pattern=r"^#[0-9a-fA-F]{6}$")
    outline_color: str = Field(default="#000000", pattern=r"^#[0-9a-fA-F]{6}$")
    outline_width: int = Field(default=2, ge=0, le=8)
    background_color: str = Field(default="transparent")  # or "#00000080"
    shadow: int = Field(default=1, ge=0, le=5)
    position: str = Field(default="bottom_center")  # bottom_center, top_center, middle_center


class JobCreate(BaseModel):
    video_id: str
    source_language: str = "auto"
    target_language: str = "km"


class ExportRequest(BaseModel):
    style: Optional[SubtitleStyle] = Field(default_factory=SubtitleStyle)


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    current_step: str
    error: Optional[str] = None
    source_language: str
    detected_language: Optional[str] = None
    target_language: str
    original_filename: str
    duration: float = 0.0
    file_size: int = 0
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    rendered_video_url: Optional[str] = None
    srt_url: Optional[str] = None
    vtt_url: Optional[str] = None
    created_at: str
    updated_at: str
