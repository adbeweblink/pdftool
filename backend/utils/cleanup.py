"""
檔案清理工具
"""
import os
import time
from pathlib import Path
from datetime import datetime, timedelta

def cleanup_old_files(directory: str, max_age_hours: int = 1):
    """
    清理超過指定時間的檔案

    Args:
        directory: 要清理的目錄
        max_age_hours: 最大保留時間（小時）
    """
    dir_path = Path(directory)
    if not dir_path.exists():
        return

    cutoff_time = time.time() - (max_age_hours * 3600)

    for file_path in dir_path.rglob("*"):
        if file_path.is_file():
            try:
                if file_path.stat().st_mtime < cutoff_time:
                    file_path.unlink()
                    print(f"已刪除過期檔案: {file_path}")
            except Exception as e:
                print(f"刪除檔案失敗 {file_path}: {e}")

    # 清理空目錄
    for dir_path in sorted(Path(directory).rglob("*"), reverse=True):
        if dir_path.is_dir():
            try:
                dir_path.rmdir()  # 只能刪除空目錄
            except OSError:
                pass  # 目錄不為空，跳過
