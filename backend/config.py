"""
PDFTool 配置
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 基本設定
    APP_NAME: str = "PDFTool"
    DEBUG: bool = True

    # 檔案設定
    UPLOAD_DIR: str = "./uploads"
    OUTPUT_DIR: str = "./outputs"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_EXTENSIONS: set = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"}

    # 檔案保留時間（小時）
    FILE_RETENTION_HOURS: int = 1

    # LibreOffice 路徑
    LIBREOFFICE_PATH: str = os.environ.get("LIBREOFFICE_PATH", "soffice")

    # Redis（Celery 用）
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    # OCR 設定
    OCR_LANG: str = "ch"  # 中文優先

    class Config:
        env_file = ".env"

settings = Settings()
