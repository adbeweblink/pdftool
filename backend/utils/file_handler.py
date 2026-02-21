"""
檔案處理工具
"""
import os
import uuid
import aiofiles
from pathlib import Path
from fastapi import UploadFile, HTTPException

from config import settings

async def save_upload_file(file: UploadFile, subdir: str = "") -> Path:
    """
    儲存上傳的檔案

    Args:
        file: 上傳的檔案
        subdir: 子目錄

    Returns:
        儲存的檔案路徑
    """
    # 檢查檔案大小
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"檔案大小超過限制（最大 {settings.MAX_FILE_SIZE // 1024 // 1024}MB）"
        )

    # 檢查副檔名
    ext = get_file_extension(file.filename)
    if ext.lower() not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支援的檔案格式：{ext}"
        )

    # 產生唯一檔名
    unique_id = str(uuid.uuid4())
    filename = f"{unique_id}{ext}"

    # 建立儲存目錄
    save_dir = Path(settings.UPLOAD_DIR)
    if subdir:
        save_dir = save_dir / subdir
    save_dir.mkdir(parents=True, exist_ok=True)

    # 儲存檔案
    file_path = save_dir / filename
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    return file_path

async def save_multiple_files(files: list[UploadFile], subdir: str = "") -> list[Path]:
    """儲存多個上傳檔案"""
    paths = []
    for file in files:
        path = await save_upload_file(file, subdir)
        paths.append(path)
    return paths

def generate_output_path(original_filename: str, suffix: str = "", ext: str = None) -> Path:
    """
    產生輸出檔案路徑

    Args:
        original_filename: 原始檔名
        suffix: 檔名後綴
        ext: 新副檔名（如 .jpg）

    Returns:
        輸出檔案路徑
    """
    unique_id = str(uuid.uuid4())
    original_ext = get_file_extension(original_filename)
    new_ext = ext if ext else original_ext

    filename = f"{unique_id}{suffix}{new_ext}"

    output_dir = Path(settings.OUTPUT_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    return output_dir / filename

def get_file_extension(filename: str) -> str:
    """取得副檔名（含點）"""
    if not filename:
        return ""
    return Path(filename).suffix

def get_filename_without_ext(filename: str) -> str:
    """取得不含副檔名的檔名"""
    if not filename:
        return ""
    return Path(filename).stem
