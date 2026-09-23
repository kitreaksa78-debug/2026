from pydantic import BaseModel, Field
from typing import List


class SubtitleItem(BaseModel):
    id: int
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    text: str = Field(..., description="Original transcribed text")
    translation: str = Field(default="", description="Translated text")


class SubtitleListUpdate(BaseModel):
    subtitles: List[SubtitleItem]


class SubtitleListResponse(BaseModel):
    job_id: str
    source_language: str
    target_language: str
    subtitles: List[SubtitleItem]
