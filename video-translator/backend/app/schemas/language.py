from pydantic import BaseModel
from typing import List


class LanguageItem(BaseModel):
    code: str
    name: str
    native_name: str


class LanguageListResponse(BaseModel):
    source_languages: List[LanguageItem]
    target_languages: List[LanguageItem]
