from fastapi import APIRouter
from app.schemas.language import LanguageItem, LanguageListResponse

router = APIRouter()

SUPPORTED_LANGUAGES = [
    LanguageItem(code="km", name="Khmer", native_name="ភាសាខ្មែរ"),
    LanguageItem(code="en", name="English", native_name="English"),
    LanguageItem(code="th", name="Thai", native_name="ไทย"),
    LanguageItem(code="vi", name="Vietnamese", native_name="Tiếng Việt"),
    LanguageItem(code="zh", name="Chinese", native_name="中文"),
    LanguageItem(code="ja", name="Japanese", native_name="日本語"),
    LanguageItem(code="ko", name="Korean", native_name="한국어"),
    LanguageItem(code="fr", name="French", native_name="Français"),
    LanguageItem(code="es", name="Spanish", native_name="Español"),
    LanguageItem(code="de", name="German", native_name="Deutsch"),
    LanguageItem(code="pt", name="Portuguese", native_name="Português"),
    LanguageItem(code="ru", name="Russian", native_name="Русский"),
    LanguageItem(code="ar", name="Arabic", native_name="العربية"),
]

SOURCE_LANGUAGES = [
    LanguageItem(code="auto", name="Auto Detect", native_name="Auto Detect"),
    *SUPPORTED_LANGUAGES
]


@router.get("/languages", response_model=LanguageListResponse)
def get_languages():
    """
    Returns available source and target languages determined by the system.
    """
    return LanguageListResponse(
        source_languages=SOURCE_LANGUAGES,
        target_languages=SUPPORTED_LANGUAGES
    )
