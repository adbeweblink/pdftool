"""
批次處理 API - 一次處理多個 PDF 檔案
"""
import fitz
import zipfile
import io
import asyncio
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from typing import List, Optional
from pydantic import BaseModel
import uuid

from utils.file_handler import save_upload_file, save_multiple_files, generate_output_path
from utils.pdf_compat import save_compatible_pdf

router = APIRouter()

# 批次任務狀態儲存（生產環境應使用 Redis）
batch_tasks = {}


class BatchTask(BaseModel):
    task_id: str
    status: str  # pending, processing, completed, failed
    total_files: int
    processed_files: int
    results: List[dict]
    error: Optional[str] = None


# ============ 批次壓縮 ============
@router.post("/compress")
async def batch_compress(
    files: List[UploadFile] = File(...),
    quality: str = Form("medium", description="壓縮品質：low, medium, high")
):
    """
    批次壓縮多個 PDF 檔案

    - 上傳多個 PDF
    - 回傳 ZIP 檔案，包含所有壓縮後的 PDF
    """
    if len(files) < 1:
        raise HTTPException(status_code=400, detail="至少需要 1 個檔案")

    if len(files) > 50:
        raise HTTPException(status_code=400, detail="一次最多處理 50 個檔案")

    file_paths = await save_multiple_files(files, "batch")
    original_names = [f.filename for f in files]

    quality_settings = {
        "low": {"garbage": 4, "deflate": True, "clean": True},
        "medium": {"garbage": 3, "deflate": True},
        "high": {"garbage": 2}
    }
    settings = quality_settings.get(quality, quality_settings["medium"])

    try:
        # 建立 ZIP 檔案
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for i, file_path in enumerate(file_paths):
                try:
                    pdf = fitz.open(file_path)
                    output_buffer = io.BytesIO()
                    pdf.save(output_buffer, **settings)
                    pdf.close()

                    # 壓縮後的檔名
                    compressed_name = f"compressed_{original_names[i]}"
                    zip_file.writestr(compressed_name, output_buffer.getvalue())

                except Exception as e:
                    # 跳過失敗的檔案，但繼續處理其他檔案
                    continue

        zip_buffer.seek(0)

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=compressed_pdfs.zip"}
        )

    finally:
        for path in file_paths:
            path.unlink(missing_ok=True)


# ============ 批次合併（多對一） ============
@router.post("/merge-all")
async def batch_merge_all(files: List[UploadFile] = File(...)):
    """
    將所有上傳的 PDF 合併成一個檔案
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="至少需要 2 個檔案")

    file_paths = await save_multiple_files(files, "batch")

    try:
        merged_pdf = fitz.open()

        for file_path in file_paths:
            pdf = fitz.open(file_path)
            merged_pdf.insert_pdf(pdf)
            pdf.close()

        output_path = generate_output_path("merged_all.pdf")
        save_compatible_pdf(merged_pdf, output_path, title="Batch Merged PDF")
        merged_pdf.close()

        return FileResponse(
            path=output_path,
            filename="merged_all.pdf",
            media_type="application/pdf"
        )

    finally:
        for path in file_paths:
            path.unlink(missing_ok=True)


# ============ 批次轉換為圖片 ============
@router.post("/to-images")
async def batch_to_images(
    files: List[UploadFile] = File(...),
    format: str = Form("png", description="圖片格式：png, jpg"),
    dpi: int = Form(150, description="解析度")
):
    """
    批次將 PDF 轉換為圖片

    - 每個 PDF 的每一頁都會轉成圖片
    - 回傳 ZIP 檔案
    """
    file_paths = await save_multiple_files(files, "batch")
    original_names = [f.filename for f in files]

    try:
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for i, file_path in enumerate(file_paths):
                pdf_name = Path(original_names[i]).stem

                try:
                    pdf = fitz.open(file_path)
                    zoom = dpi / 72  # 72 是 PDF 的預設 DPI

                    for page_num, page in enumerate(pdf):
                        mat = fitz.Matrix(zoom, zoom)
                        pix = page.get_pixmap(matrix=mat)

                        img_name = f"{pdf_name}_page_{page_num + 1}.{format}"

                        if format == "jpg":
                            img_data = pix.tobytes("jpeg")
                        else:
                            img_data = pix.tobytes("png")

                        zip_file.writestr(img_name, img_data)

                    pdf.close()

                except Exception:
                    continue

        zip_buffer.seek(0)

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=pdf_images.zip"}
        )

    finally:
        for path in file_paths:
            path.unlink(missing_ok=True)


# ============ 批次加浮水印 ============
@router.post("/watermark")
async def batch_watermark(
    files: List[UploadFile] = File(...),
    text: str = Form(..., description="浮水印文字"),
    opacity: float = Form(0.3),
    angle: int = Form(45)
):
    """
    批次為多個 PDF 加上浮水印
    """
    file_paths = await save_multiple_files(files, "batch")
    original_names = [f.filename for f in files]

    try:
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for i, file_path in enumerate(file_paths):
                try:
                    pdf = fitz.open(file_path)

                    for page in pdf:
                        rect = page.rect
                        center = fitz.Point(rect.width / 2, rect.height / 2)

                        # 將角度轉為最接近的標準角度（0/90/180/270）
                        std_angle = round(angle / 90) * 90 % 360

                        # 加入浮水印文字
                        page.insert_text(
                            center,
                            text,
                            fontsize=50,
                            rotate=int(std_angle),
                            color=(0.5, 0.5, 0.5),
                            fill_opacity=opacity,
                            overlay=True
                        )

                    output_buffer = io.BytesIO()
                    pdf.save(output_buffer)
                    pdf.close()

                    watermarked_name = f"watermarked_{original_names[i]}"
                    zip_file.writestr(watermarked_name, output_buffer.getvalue())

                except Exception:
                    continue

        zip_buffer.seek(0)

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=watermarked_pdfs.zip"}
        )

    finally:
        for path in file_paths:
            path.unlink(missing_ok=True)


# ============ 批次加密 ============
@router.post("/encrypt")
async def batch_encrypt(
    files: List[UploadFile] = File(...),
    password: str = Form(..., description="加密密碼")
):
    """
    批次為多個 PDF 加密
    """
    file_paths = await save_multiple_files(files, "batch")
    original_names = [f.filename for f in files]

    try:
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for i, file_path in enumerate(file_paths):
                try:
                    pdf = fitz.open(file_path)

                    output_buffer = io.BytesIO()
                    pdf.save(
                        output_buffer,
                        encryption=fitz.PDF_ENCRYPT_AES_256,
                        user_pw=password,
                        owner_pw=password
                    )
                    pdf.close()

                    encrypted_name = f"encrypted_{original_names[i]}"
                    zip_file.writestr(encrypted_name, output_buffer.getvalue())

                except Exception:
                    continue

        zip_buffer.seek(0)

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=encrypted_pdfs.zip"}
        )

    finally:
        for path in file_paths:
            path.unlink(missing_ok=True)


# ============ 批次 OCR ============
@router.post("/ocr")
async def batch_ocr(
    files: List[UploadFile] = File(...),
    lang: str = Form("chi_tra+eng", description="OCR 語言")
):
    """
    批次對多個 PDF 進行 OCR

    需要安裝 Tesseract
    """
    # 這需要 Tesseract OCR，簡化版本只提取現有文字
    file_paths = await save_multiple_files(files, "batch")
    original_names = [f.filename for f in files]

    results = []

    try:
        for i, file_path in enumerate(file_paths):
            try:
                pdf = fitz.open(file_path)
                text_content = ""

                for page in pdf:
                    text_content += page.get_text() + "\n\n"

                pdf.close()

                results.append({
                    "filename": original_names[i],
                    "success": True,
                    "text": text_content[:5000]  # 限制長度
                })

            except Exception as e:
                results.append({
                    "filename": original_names[i],
                    "success": False,
                    "error": str(e)
                })

        return {"results": results}

    finally:
        for path in file_paths:
            path.unlink(missing_ok=True)


# ============ 批次任務狀態 ============
@router.get("/status/{task_id}")
async def get_batch_status(task_id: str):
    """
    取得批次任務狀態
    """
    if task_id not in batch_tasks:
        raise HTTPException(status_code=404, detail="找不到該任務")

    return batch_tasks[task_id]


# ============ 批次處理（非同步） ============
@router.post("/async/compress")
async def batch_compress_async(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    quality: str = Form("medium")
):
    """
    非同步批次壓縮（適用於大量檔案）

    - 回傳任務 ID
    - 使用 /status/{task_id} 查詢進度
    """
    task_id = str(uuid.uuid4())

    # 儲存檔案
    file_paths = await save_multiple_files(files, f"batch_{task_id}")
    original_names = [f.filename for f in files]

    # 建立任務
    batch_tasks[task_id] = BatchTask(
        task_id=task_id,
        status="pending",
        total_files=len(files),
        processed_files=0,
        results=[]
    )

    # 背景處理
    background_tasks.add_task(
        process_batch_compress,
        task_id,
        file_paths,
        original_names,
        quality
    )

    return {"task_id": task_id, "status": "pending"}


async def process_batch_compress(
    task_id: str,
    file_paths: List[Path],
    original_names: List[str],
    quality: str
):
    """背景處理批次壓縮"""
    task = batch_tasks[task_id]
    task.status = "processing"

    quality_settings = {
        "low": {"garbage": 4, "deflate": True, "clean": True},
        "medium": {"garbage": 3, "deflate": True},
        "high": {"garbage": 2}
    }
    settings = quality_settings.get(quality, quality_settings["medium"])

    try:
        for i, file_path in enumerate(file_paths):
            try:
                pdf = fitz.open(file_path)
                output_path = generate_output_path(f"compressed_{original_names[i]}")
                pdf.save(str(output_path), **settings)
                pdf.close()

                task.results.append({
                    "filename": original_names[i],
                    "success": True,
                    "output_path": str(output_path)
                })

            except Exception as e:
                task.results.append({
                    "filename": original_names[i],
                    "success": False,
                    "error": str(e)
                })

            task.processed_files = i + 1
            file_path.unlink(missing_ok=True)

        task.status = "completed"

    except Exception as e:
        task.status = "failed"
        task.error = str(e)
