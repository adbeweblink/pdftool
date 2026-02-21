"""
PDFTool Backend - 開源 PDF 處理服務
"""
import os
import uuid
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from api import (
    basic_router,
    convert_router,
    ocr_router,
    edit_router,
    sign_router,
    security_router,
    advanced_router,
    ai_router,
    ai_advanced_router,
    workflow_router,
    batch_router,
    multimedia_router,
    pdf_editor_router,
    batch_extract_router,
)
from config import settings
from utils.cleanup import cleanup_old_files

# 定期清理任務
async def periodic_cleanup():
    """每 10 分鐘清理過期檔案"""
    while True:
        await asyncio.sleep(600)  # 10 分鐘
        cleanup_old_files(settings.UPLOAD_DIR, max_age_hours=1)
        cleanup_old_files(settings.OUTPUT_DIR, max_age_hours=1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 啟動時
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)

    # 啟動清理任務
    cleanup_task = asyncio.create_task(periodic_cleanup())

    yield

    # 關閉時
    cleanup_task.cancel()

app = FastAPI(
    title="PDFTool API",
    description="開源 PDF 處理服務 - 完整 PDF 處理 API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 設定
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://pdftool-tw.netlify.app",  # 生產環境
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由
app.include_router(basic_router, prefix="/api/basic", tags=["基礎操作"])
app.include_router(convert_router, prefix="/api/convert", tags=["格式轉換"])
app.include_router(ocr_router, prefix="/api/ocr", tags=["OCR 文字辨識"])
app.include_router(edit_router, prefix="/api/edit", tags=["編輯"])
app.include_router(sign_router, prefix="/api/sign", tags=["簽名表單"])
app.include_router(security_router, prefix="/api/security", tags=["安全性"])
app.include_router(advanced_router, prefix="/api/advanced", tags=["進階功能"])
app.include_router(ai_router, prefix="/api/ai", tags=["AI 助手"])
app.include_router(ai_advanced_router, prefix="/api/ai-advanced", tags=["AI 進階功能"])
app.include_router(workflow_router, prefix="/api/workflow", tags=["工作流引擎"])
app.include_router(batch_router, prefix="/api/batch", tags=["批次處理"])
app.include_router(multimedia_router, prefix="/api/multimedia", tags=["多媒體"])
app.include_router(batch_extract_router, prefix="/api/extract", tags=["資料提取"])
app.include_router(pdf_editor_router)

@app.get("/")
async def root():
    return {
        "name": "PDFTool API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# 下載處理後的檔案
@app.get("/download/{file_id}")
async def download_file(file_id: str):
    """下載處理後的檔案"""
    file_path = Path(settings.OUTPUT_DIR) / file_id

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="檔案不存在或已過期")

    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type="application/octet-stream",
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
