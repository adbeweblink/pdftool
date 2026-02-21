"""
格式轉換 API - PDF 與 Word/Excel/PPT/圖片互轉
優先使用 Microsoft Office（Windows），否則使用 LibreOffice
"""
import subprocess
import zipfile
import fitz  # PyMuPDF
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import List
from PIL import Image
import img2pdf
import logging

from utils.file_handler import save_upload_file, save_multiple_files, generate_output_path
from utils.office_converter import (
    word_to_pdf as ms_word_to_pdf,
    excel_to_pdf as ms_excel_to_pdf,
    ppt_to_pdf as ms_ppt_to_pdf,
    is_office_available
)
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# 檢查 MS Office 可用性（啟動時只檢查一次）
_office_status = None

def get_office_status():
    global _office_status
    if _office_status is None:
        _office_status = is_office_available()
        if _office_status["available"]:
            logger.info(f"MS Office 可用: Word={_office_status['word']}, Excel={_office_status['excel']}, PPT={_office_status['powerpoint']}")
        else:
            logger.info("MS Office 不可用，將使用 LibreOffice")
    return _office_status


def _libreoffice_convert(file_path: Path, output_format: str, output_dir: Path) -> Path:
    """使用 LibreOffice 轉換檔案"""
    subprocess.run(
        [settings.LIBREOFFICE_PATH, "--headless", "--convert-to", output_format,
         "--outdir", str(output_dir), str(file_path)],
        capture_output=True, timeout=120
    )
    return output_dir / (file_path.stem + f".{output_format}")

# ============ PDF 轉 Word ============
@router.post("/pdf-to-word")
async def pdf_to_word(file: UploadFile = File(...)):
    """PDF 轉 Word (.docx)，使用 LibreOffice"""
    file_path = await save_upload_file(file, "convert")

    try:
        output_dir = Path(settings.OUTPUT_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)

        result = subprocess.run(
            [settings.LIBREOFFICE_PATH, "--headless", "--convert-to", "docx",
             "--outdir", str(output_dir), str(file_path)],
            capture_output=True, timeout=120
        )

        output_path = output_dir / (file_path.stem + ".docx")
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="轉換失敗")

        return FileResponse(path=output_path, filename=output_path.name,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    finally:
        file_path.unlink(missing_ok=True)


# ============ PDF 轉 Excel ============
@router.post("/pdf-to-excel")
async def pdf_to_excel(file: UploadFile = File(...)):
    """PDF 轉 Excel (.xlsx)"""
    file_path = await save_upload_file(file, "convert")

    try:
        output_dir = Path(settings.OUTPUT_DIR)
        result = subprocess.run(
            [settings.LIBREOFFICE_PATH, "--headless", "--convert-to", "xlsx",
             "--outdir", str(output_dir), str(file_path)],
            capture_output=True, timeout=120
        )

        output_path = output_dir / (file_path.stem + ".xlsx")
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="轉換失敗")

        return FileResponse(path=output_path, filename=output_path.name,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    finally:
        file_path.unlink(missing_ok=True)


# ============ PDF 轉 PowerPoint ============
@router.post("/pdf-to-ppt")
async def pdf_to_ppt(file: UploadFile = File(...)):
    """PDF 轉 PowerPoint (.pptx)"""
    file_path = await save_upload_file(file, "convert")

    try:
        output_dir = Path(settings.OUTPUT_DIR)
        result = subprocess.run(
            [settings.LIBREOFFICE_PATH, "--headless", "--convert-to", "pptx",
             "--outdir", str(output_dir), str(file_path)],
            capture_output=True, timeout=120
        )

        output_path = output_dir / (file_path.stem + ".pptx")
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="轉換失敗")

        return FileResponse(path=output_path, filename=output_path.name,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation")
    finally:
        file_path.unlink(missing_ok=True)


# ============ PDF 轉圖片 ============
@router.post("/pdf-to-images")
async def pdf_to_images(
    file: UploadFile = File(...),
    format: str = Form("png"),
    dpi: int = Form(150)
):
    """PDF 轉圖片 (PNG/JPG)"""
    if format.lower() not in ["png", "jpg", "jpeg"]:
        raise HTTPException(status_code=400, detail="格式必須是 png 或 jpg")

    file_path = await save_upload_file(file, "convert")

    try:
        pdf = fitz.open(file_path)
        output_path = generate_output_path("images.zip", ext=".zip")

        with zipfile.ZipFile(output_path, "w") as zf:
            for i, page in enumerate(pdf):
                mat = fitz.Matrix(dpi / 72, dpi / 72)
                pix = page.get_pixmap(matrix=mat)

                if format.lower() in ["jpg", "jpeg"]:
                    img_bytes = pix.tobytes("jpeg")
                    ext = ".jpg"
                else:
                    img_bytes = pix.tobytes("png")
                    ext = ".png"

                zf.writestr(f"page_{i+1}{ext}", img_bytes)

        pdf.close()
        return FileResponse(path=output_path, filename="pdf_images.zip", media_type="application/zip")
    finally:
        file_path.unlink(missing_ok=True)


# ============ PDF 轉 HTML ============
@router.post("/pdf-to-html")
async def pdf_to_html(file: UploadFile = File(...)):
    """PDF 轉 HTML"""
    file_path = await save_upload_file(file, "convert")

    try:
        pdf = fitz.open(file_path)
        html_content = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>PDF to HTML</title>
<style>body{font-family:Arial;max-width:800px;margin:0 auto;padding:20px}
.page{border-bottom:1px solid #ccc;padding:20px 0;margin-bottom:20px}</style>
</head><body>"""

        for i, page in enumerate(pdf):
            text = page.get_text("html")
            html_content += f'<div class="page"><p>Page {i+1}</p>{text}</div>\n'

        html_content += "</body></html>"
        pdf.close()

        output_path = generate_output_path("converted.html", ext=".html")
        output_path.write_text(html_content, encoding="utf-8")

        return FileResponse(path=output_path, filename="converted.html", media_type="text/html")
    finally:
        file_path.unlink(missing_ok=True)


# ============ Word 轉 PDF ============
@router.post("/word-to-pdf")
async def word_to_pdf(file: UploadFile = File(...)):
    """Word (.doc, .docx) 轉 PDF - 優先使用 MS Office"""
    file_path = await save_upload_file(file, "convert")

    try:
        output_dir = Path(settings.OUTPUT_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / (file_path.stem + ".pdf")

        # 優先使用 MS Office
        office_status = get_office_status()
        if office_status["word"]:
            success = ms_word_to_pdf(file_path, output_path)
            if success and output_path.exists():
                logger.info(f"使用 MS Word 轉換成功: {file_path.name}")
                return FileResponse(path=output_path, filename=output_path.name, media_type="application/pdf")
            logger.warning("MS Word 轉換失敗，回退到 LibreOffice")

        # 回退到 LibreOffice
        output_path = _libreoffice_convert(file_path, "pdf", output_dir)
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="轉換失敗，請確認已安裝 Microsoft Office 或 LibreOffice")

        return FileResponse(path=output_path, filename=output_path.name, media_type="application/pdf")
    finally:
        file_path.unlink(missing_ok=True)


# ============ Excel 轉 PDF ============
@router.post("/excel-to-pdf")
async def excel_to_pdf(file: UploadFile = File(...)):
    """Excel (.xls, .xlsx) 轉 PDF - 優先使用 MS Office"""
    file_path = await save_upload_file(file, "convert")

    try:
        output_dir = Path(settings.OUTPUT_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / (file_path.stem + ".pdf")

        # 優先使用 MS Office
        office_status = get_office_status()
        if office_status["excel"]:
            success = ms_excel_to_pdf(file_path, output_path)
            if success and output_path.exists():
                logger.info(f"使用 MS Excel 轉換成功: {file_path.name}")
                return FileResponse(path=output_path, filename=output_path.name, media_type="application/pdf")
            logger.warning("MS Excel 轉換失敗，回退到 LibreOffice")

        # 回退到 LibreOffice
        output_path = _libreoffice_convert(file_path, "pdf", output_dir)
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="轉換失敗，請確認已安裝 Microsoft Office 或 LibreOffice")

        return FileResponse(path=output_path, filename=output_path.name, media_type="application/pdf")
    finally:
        file_path.unlink(missing_ok=True)


# ============ PPT 轉 PDF ============
@router.post("/ppt-to-pdf")
async def ppt_to_pdf(file: UploadFile = File(...)):
    """PowerPoint (.ppt, .pptx) 轉 PDF - 優先使用 MS Office"""
    file_path = await save_upload_file(file, "convert")

    try:
        output_dir = Path(settings.OUTPUT_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / (file_path.stem + ".pdf")

        # 優先使用 MS Office
        office_status = get_office_status()
        if office_status["powerpoint"]:
            success = ms_ppt_to_pdf(file_path, output_path)
            if success and output_path.exists():
                logger.info(f"使用 MS PowerPoint 轉換成功: {file_path.name}")
                return FileResponse(path=output_path, filename=output_path.name, media_type="application/pdf")
            logger.warning("MS PowerPoint 轉換失敗，回退到 LibreOffice")

        # 回退到 LibreOffice
        output_path = _libreoffice_convert(file_path, "pdf", output_dir)
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="轉換失敗，請確認已安裝 Microsoft Office 或 LibreOffice")

        return FileResponse(path=output_path, filename=output_path.name, media_type="application/pdf")
    finally:
        file_path.unlink(missing_ok=True)


# ============ 圖片轉 PDF ============
@router.post("/images-to-pdf")
async def images_to_pdf(files: List[UploadFile] = File(...)):
    """多張圖片轉 PDF"""
    file_paths = await save_multiple_files(files, "convert")

    try:
        output_path = generate_output_path("images.pdf")
        image_paths = []

        for path in file_paths:
            try:
                img = Image.open(path)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                    rgb_path = path.with_suffix(".rgb.jpg")
                    img.save(rgb_path, "JPEG")
                    img.close()
                    image_paths.append(str(rgb_path))
                else:
                    img.close()
                    image_paths.append(str(path))
            except Exception:
                raise HTTPException(status_code=400, detail=f"無效的圖片: {path.name}")

        with open(output_path, "wb") as f:
            f.write(img2pdf.convert(image_paths))

        return FileResponse(path=output_path, filename="images.pdf", media_type="application/pdf")
    finally:
        for path in file_paths:
            path.unlink(missing_ok=True)
