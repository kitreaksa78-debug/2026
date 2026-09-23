import math
import re
from pathlib import Path
from typing import List
from app.schemas.subtitle import SubtitleItem


class SubtitleService:
    @staticmethod
    def format_timestamp_srt(seconds: float) -> str:
        """
        Formats seconds into SRT timestamp: HH:MM:SS,mmm
        """
        if seconds < 0:
            seconds = 0.0
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int(round((seconds - math.floor(seconds)) * 1000))
        if millis >= 1000:
            millis = 999
        return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

    @staticmethod
    def format_timestamp_vtt(seconds: float) -> str:
        """
        Formats seconds into WebVTT timestamp: HH:MM:SS.mmm
        """
        if seconds < 0:
            seconds = 0.0
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int(round((seconds - math.floor(seconds)) * 1000))
        if millis >= 1000:
            millis = 999
        return f"{hrs:02d}:{mins:02d}:{secs:02d}.{millis:03d}"

    @staticmethod
    def parse_timestamp(ts_str: str) -> float:
        """
        Parses HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS.mmm into float seconds.
        """
        cleaned = ts_str.strip().replace(",", ".")
        parts = cleaned.split(":")
        if len(parts) == 3:
            h, m, s = parts
            return float(h) * 3600 + float(m) * 60 + float(s)
        elif len(parts) == 2:
            m, s = parts
            return float(m) * 60 + float(s)
        elif len(parts) == 1:
            return float(parts[0])
        return 0.0

    @classmethod
    def generate_srt(cls, subtitles: List[SubtitleItem], use_translation: bool = True) -> str:
        """
        Builds standard SRT content from subtitle items.
        """
        lines = []
        for idx, item in enumerate(subtitles, 1):
            text_to_use = (item.translation if (use_translation and item.translation) else item.text).strip()
            start_str = cls.format_timestamp_srt(item.start)
            end_str = cls.format_timestamp_srt(item.end)
            lines.append(f"{idx}\n{start_str} --> {end_str}\n{text_to_use}\n")
        return "\n".join(lines)

    @classmethod
    def generate_vtt(cls, subtitles: List[SubtitleItem], use_translation: bool = True) -> str:
        """
        Builds standard WebVTT content from subtitle items.
        """
        lines = ["WEBVTT\n"]
        for idx, item in enumerate(subtitles, 1):
            text_to_use = (item.translation if (use_translation and item.translation) else item.text).strip()
            start_str = cls.format_timestamp_vtt(item.start)
            end_str = cls.format_timestamp_vtt(item.end)
            lines.append(f"{idx}\n{start_str} --> {end_str}\n{text_to_use}\n")
        return "\n".join(lines)

    @classmethod
    def save_srt(cls, subtitles: List[SubtitleItem], file_path: Path, use_translation: bool = True) -> None:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        content = cls.generate_srt(subtitles, use_translation=use_translation)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

    @classmethod
    def save_vtt(cls, subtitles: List[SubtitleItem], file_path: Path, use_translation: bool = True) -> None:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        content = cls.generate_vtt(subtitles, use_translation=use_translation)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

    @classmethod
    def parse_srt(cls, content: str) -> List[SubtitleItem]:
        items: List[SubtitleItem] = []
        blocks = re.split(r"\n\s*\n", content.strip())
        for block in blocks:
            lines = [l.strip() for l in block.split("\n") if l.strip()]
            if len(lines) < 2:
                continue

            time_line = ""
            text_lines = []
            if "-->" in lines[0]:
                time_line = lines[0]
                text_lines = lines[1:]
            elif len(lines) >= 2 and "-->" in lines[1]:
                time_line = lines[1]
                text_lines = lines[2:]

            if not time_line:
                continue

            parts = time_line.split("-->")
            if len(parts) != 2:
                continue

            start = cls.parse_timestamp(parts[0])
            end = cls.parse_timestamp(parts[1])
            text = "\n".join(text_lines)

            items.append(SubtitleItem(
                id=len(items) + 1,
                start=start,
                end=end,
                text=text,
                translation=text
            ))
        return items
