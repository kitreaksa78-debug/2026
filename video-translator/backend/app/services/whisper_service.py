import logging
import os
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Singleton model instance
_model_instance = None
_model_config: Tuple[str, str, str] = ("", "", "")


def detect_device_and_compute_type(
    configured_device: str = "auto",
    configured_compute_type: str = "auto"
) -> Tuple[str, str]:
    """
    Detects whether NVIDIA CUDA is available or falls back to CPU.
    Selects optimal compute_type (e.g. float16 for CUDA, int8 or float32 for CPU).
    """
    device = configured_device.lower()
    compute_type = configured_compute_type.lower()

    if device == "auto":
        # Check if torch has CUDA or nvidia-smi exists
        try:
            import torch
            if torch.cuda.is_available():
                device = "cuda"
            else:
                device = "cpu"
        except Exception:
            if shutil.which("nvidia-smi"):
                device = "cuda"
            else:
                device = "cpu"

    if compute_type == "auto":
        if device == "cuda":
            compute_type = "float16"
        else:
            compute_type = "int8"

    logger.info(f"Whisper configured with device={device}, compute_type={compute_type}")
    return device, compute_type


class WhisperService:
    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        compute_type: Optional[str] = None
    ):
        from app.core.config import settings
        self.model_name = model_name or settings.WHISPER_MODEL
        self.configured_device = device or settings.WHISPER_DEVICE
        self.configured_compute_type = compute_type or settings.WHISPER_COMPUTE_TYPE
        self.device, self.compute_type = detect_device_and_compute_type(
            self.configured_device, self.configured_compute_type
        )

    def _get_model(self):
        global _model_instance, _model_config
        current_config = (self.model_name, self.device, self.compute_type)
        if _model_instance is not None and _model_config == current_config:
            return _model_instance

        from faster_whisper import WhisperModel
        logger.info(f"Loading faster-whisper model '{self.model_name}' on {self.device} ({self.compute_type})...")
        try:
            _model_instance = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=self.compute_type
            )
            _model_config = current_config
            logger.info("faster-whisper model successfully loaded and cached in memory.")
            return _model_instance
        except Exception as e:
            # Fallback to CPU if CUDA failed (e.g. cuDNN mismatch)
            if self.device == "cuda":
                logger.warning(f"CUDA failed to load model: {e}. Falling back to CPU with int8.")
                self.device = "cpu"
                self.compute_type = "int8"
                _model_instance = WhisperModel(
                    self.model_name,
                    device=self.device,
                    compute_type=self.compute_type
                )
                _model_config = (self.model_name, self.device, self.compute_type)
                return _model_instance
            raise e

    def is_available(self) -> bool:
        """
        Validates if faster-whisper package is installed and can be imported.
        """
        try:
            import faster_whisper
            return True
        except Exception:
            return False

    def transcribe(
        self,
        audio_path: Path,
        source_language: Optional[str] = None,
        progress_callback=None
    ) -> Dict[str, Any]:
        """
        Transcribes audio with faster-whisper.
        Generates real timestamped segments.
        Does NOT use Whisper's internal translation for target languages;
        always transcribes in the detected/specified source language.
        """
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        model = self._get_model()

        # Handle 'auto' language detection
        lang = None if (not source_language or source_language.lower() == "auto") else source_language.lower()

        logger.info(f"Starting faster-whisper transcription for {audio_path} (language={lang or 'auto'})...")

        # task is always 'transcribe' as per requirement 34
        # (Whisper transcribe source audio, LibreTranslate translates into target)
        segments_gen, info = model.transcribe(
            str(audio_path),
            language=lang,
            task="transcribe",
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
            beam_size=5
        )

        detected_language = info.language
        logger.info(f"Detected audio language: {detected_language} with probability {info.language_probability:.2f}")

        segments: List[Dict[str, Any]] = []
        seg_id = 1

        for segment in segments_gen:
            clean_text = segment.text.strip()
            if not clean_text:
                continue
            seg_dict = {
                "id": seg_id,
                "start": round(segment.start, 3),
                "end": round(segment.end, 3),
                "text": clean_text
            }
            segments.append(seg_dict)
            seg_id += 1
            if progress_callback:
                progress_callback(segment.end, info.duration)

        return {
            "language": detected_language,
            "duration": round(info.duration, 2),
            "segments": segments
        }
