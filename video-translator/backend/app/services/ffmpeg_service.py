import json
import logging
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional

from app.schemas.job import SubtitleStyle

logger = logging.getLogger(__name__)


def _hex_to_ass_color(hex_str: str) -> str:
    """
    Converts #RRGGBB to ASS &H00BBGGRR& format.
    """
    cleaned = hex_str.strip().lstrip("#")
    if len(cleaned) == 6:
        r, g, b = cleaned[0:2], cleaned[2:4], cleaned[4:6]
        return f"&H00{b}{g}{r}&"
    return "&H00FFFFFF&"


class FFmpegService:
    @staticmethod
    def check_installed() -> bool:
        try:
            res = subprocess.run(
                ["ffmpeg", "-version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False
            )
            return res.returncode == 0
        except Exception:
            return False

    @staticmethod
    def check_ffprobe_installed() -> bool:
        try:
            res = subprocess.run(
                ["ffprobe", "-version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False
            )
            return res.returncode == 0
        except Exception:
            return False

    @staticmethod
    def get_metadata(video_path: Path) -> Dict[str, Any]:
        """
        Extracts duration, width, height, codec, and size using ffprobe.
        """
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(video_path)
        ]

        logger.info(f"Running ffprobe on {video_path}")
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            logger.error(f"FFprobe failed: {result.stderr}")
            raise RuntimeError(f"FFprobe failed to inspect video: {result.stderr.strip()}")

        data = json.loads(result.stdout)
        fmt = data.get("format", {})
        duration = float(fmt.get("duration", 0.0))
        size = int(fmt.get("size", video_path.stat().st_size))

        video_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), None)

        width = video_stream.get("width") if video_stream else 0
        height = video_stream.get("height") if video_stream else 0
        video_codec = video_stream.get("codec_name") if video_stream else None
        audio_codec = audio_stream.get("codec_name") if audio_stream else None

        return {
            "duration": duration,
            "size": size,
            "width": width,
            "height": height,
            "video_codec": video_codec,
            "audio_codec": audio_codec,
            "has_audio": audio_stream is not None,
        }

    @staticmethod
    def generate_thumbnail(video_path: Path, output_thumbnail_path: Path, timestamp: float = 1.0) -> bool:
        """
        Extracts a frame thumbnail from the video using FFmpeg.
        """
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        output_thumbnail_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            "ffmpeg",
            "-y",
            "-ss", str(max(0.1, timestamp)),
            "-i", str(video_path),
            "-vframes", "1",
            "-q:v", "2",
            "-vf", "scale='min(640,iw)':-2",
            str(output_thumbnail_path)
        ]

        logger.info(f"Generating thumbnail: {' '.join(cmd)}")
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            logger.warning(f"FFmpeg thumbnail extraction at {timestamp}s failed, trying 0s. Error: {result.stderr}")
            cmd[3] = "0.0"
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if result.returncode != 0:
                logger.error(f"FFmpeg thumbnail extraction failed: {result.stderr}")
                return False

        return output_thumbnail_path.exists()

    @staticmethod
    def extract_audio(video_path: Path, output_audio_path: Path) -> bool:
        """
        Extracts audio to a 16kHz mono 16-bit PCM WAV file optimal for faster-whisper.
        """
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        output_audio_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            "ffmpeg",
            "-y",
            "-i", str(video_path),
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            str(output_audio_path)
        ]

        logger.info(f"Extracting audio: {' '.join(cmd)}")
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            logger.error(f"Audio extraction failed: {result.stderr}")
            raise RuntimeError(f"FFmpeg audio extraction failed: {result.stderr.strip()}")

        return output_audio_path.exists()

    @staticmethod
    def burn_subtitles(
        video_path: Path,
        srt_path: Path,
        output_video_path: Path,
        style: Optional[SubtitleStyle] = None
    ) -> bool:
        """
        Burns subtitles directly into video using FFmpeg subtitles filter.
        Uses safe escaping to prevent shell/filter injection.
        """
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")
        if not srt_path.exists():
            raise FileNotFoundError(f"SRT file not found: {srt_path}")

        output_video_path.parent.mkdir(parents=True, exist_ok=True)

        if style is None:
            style = SubtitleStyle()

        # ASS Alignment: 2 = Bottom center, 6 = Top center, 10 = Middle center
        alignment_map = {
            "bottom_center": 2,
            "top_center": 6,
            "middle_center": 10,
        }
        alignment = alignment_map.get(style.position, 2)
        font_size = max(12, min(72, style.font_size))
        primary_color = _hex_to_ass_color(style.text_color)
        outline_color = _hex_to_ass_color(style.outline_color)
        outline_w = max(0, min(8, style.outline_width))
        shadow = max(0, min(5, style.shadow))

        # Safe FFmpeg subtitle filter escaping:
        # Colons, backslashes, single quotes must be escaped in ffmpeg filter options
        escaped_srt = str(srt_path.resolve()).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")

        # Build style string
        force_style = (
            f"FontSize={font_size},"
            f"PrimaryColour={primary_color},"
            f"OutlineColour={outline_color},"
            f"Outline={outline_w},"
            f"Shadow={shadow},"
            f"Alignment={alignment},"
            f"MarginV=25"
        )

        filter_arg = f"subtitles='{escaped_srt}':force_style='{force_style}'"

        cmd = [
            "ffmpeg",
            "-y",
            "-i", str(video_path),
            "-vf", filter_arg,
            "-c:a", "copy",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "22",
            "-pix_fmt", "yuv420p",
            str(output_video_path)
        ]

        logger.info(f"Burning subtitles to {output_video_path}")
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            logger.error(f"FFmpeg subtitle burning failed: {result.stderr}")
            raise RuntimeError(f"Video rendering failed: {result.stderr.strip()}")

        return output_video_path.exists()
