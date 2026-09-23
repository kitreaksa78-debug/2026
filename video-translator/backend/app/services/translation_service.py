import abc
import logging
from typing import List, Dict, Any, Optional
import requests

from app.core.config import settings

logger = logging.getLogger(__name__)


class TranslationProvider(abc.ABC):
    """
    Abstract Base Class for translation providers.
    Allows seamlessly switching or replacing the translation engine
    (e.g., LibreTranslate, Argos, local NMT, etc.) without altering the core pipeline.
    """

    @abc.abstractmethod
    def translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translates a single string from source language to target language."""
        pass

    @abc.abstractmethod
    def translate_batch(self, texts: List[str], source_lang: str, target_lang: str) -> List[str]:
        """Translates a list of strings while strictly preserving sequence and count."""
        pass

    @abc.abstractmethod
    def get_languages(self) -> List[Dict[str, Any]]:
        """Returns list of supported languages."""
        pass

    @abc.abstractmethod
    def is_healthy(self) -> bool:
        """Checks if the translation service is available."""
        pass


class LibreTranslateProvider(TranslationProvider):
    """
    Self-hosted LibreTranslate provider connecting to LIBRETRANSLATE_URL.
    Fully compliant with the LibreTranslate REST API.
    """

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.LIBRETRANSLATE_URL).rstrip("/")

    def is_healthy(self) -> bool:
        try:
            resp = requests.get(f"{self.base_url}/languages", timeout=4)
            return resp.status_code == 200
        except Exception as e:
            logger.warning(f"LibreTranslate health check failed at {self.base_url}: {e}")
            return False

    def get_languages(self) -> List[Dict[str, Any]]:
        try:
            resp = requests.get(f"{self.base_url}/languages", timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return data
            raise RuntimeError("Invalid response from LibreTranslate /languages")
        except Exception as e:
            logger.error(f"Failed to fetch languages from LibreTranslate ({self.base_url}): {e}")
            # Fall back to standard configured supported language list
            return [
                {"code": "en", "name": "English", "native_name": "English"},
                {"code": "km", "name": "Khmer", "native_name": "ភាសាខ្មែរ"},
                {"code": "th", "name": "Thai", "native_name": "ไทย"},
                {"code": "vi", "name": "Vietnamese", "native_name": "Tiếng Việt"},
                {"code": "zh", "name": "Chinese", "native_name": "中文"},
                {"code": "ja", "name": "Japanese", "native_name": "日本語"},
                {"code": "ko", "name": "Korean", "native_name": "한국어"},
                {"code": "fr", "name": "French", "native_name": "Français"},
                {"code": "es", "name": "Spanish", "native_name": "Español"},
                {"code": "de", "name": "German", "native_name": "Deutsch"},
                {"code": "pt", "name": "Portuguese", "native_name": "Português"},
                {"code": "ru", "name": "Russian", "native_name": "Русский"},
                {"code": "ar", "name": "Arabic", "native_name": "العربية"},
            ]

    def translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        if not text or not text.strip():
            return ""

        # Normalize auto detection or language codes
        src = "auto" if source_lang.lower() in ("auto", "autodetect", "") else source_lang.lower()
        tgt = target_lang.lower()

        if src == tgt and src != "auto":
            return text

        url = f"{self.base_url}/translate"
        payload = {
            "q": text,
            "source": src,
            "target": tgt,
            "format": "text"
        }

        try:
            response = requests.post(url, json=payload, timeout=20)
            if response.status_code != 200:
                logger.error(f"LibreTranslate HTTP error {response.status_code}: {response.text}")
                raise RuntimeError("Translation service is unavailable.")

            data = response.json()
            if "translatedText" in data:
                res = data["translatedText"]
                if isinstance(res, list):
                    return res[0]
                return str(res)
            elif "error" in data:
                logger.error(f"LibreTranslate returned error: {data['error']}")
                raise RuntimeError("Translation service is unavailable.")
            else:
                raise RuntimeError("Translation service is unavailable.")
        except requests.exceptions.RequestException as e:
            logger.error(f"LibreTranslate connection error to {url}: {e}")
            raise RuntimeError("Translation service is unavailable.")

    def translate_batch(self, texts: List[str], source_lang: str, target_lang: str) -> List[str]:
        if not texts:
            return []

        src = "auto" if source_lang.lower() in ("auto", "autodetect", "") else source_lang.lower()
        tgt = target_lang.lower()

        if src == tgt and src != "auto":
            return texts

        # Attempt batch request first
        url = f"{self.base_url}/translate"
        payload = {
            "q": texts,
            "source": src,
            "target": tgt,
            "format": "text"
        }

        try:
            response = requests.post(url, json=payload, timeout=45)
            if response.status_code == 200:
                data = response.json()
                translated = data.get("translatedText")
                if isinstance(translated, list) and len(translated) == len(texts):
                    return [str(t) for t in translated]
        except Exception as e:
            logger.warning(f"Batch request to LibreTranslate failed, falling back to segment loop: {e}")

        # Fallback to sequential translation if batch is not supported by endpoint
        results: List[str] = []
        for t in texts:
            if not t.strip():
                results.append("")
                continue
            translated = self.translate_text(t, src, tgt)
            results.append(translated)

        return results


def get_translation_provider() -> TranslationProvider:
    return LibreTranslateProvider()
