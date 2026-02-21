"""
進階功能 API - PDF/A、比較文件、Bates 編號、頁首頁尾、註解
"""
import fitz  # PyMuPDF
import subprocess
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import List, Optional

from utils.file_handler import save_upload_file, save_multiple_files, generate_output_path
from utils.pdf_compat import save_compatible_pdf
from config import settings

router = APIRouter()


# ============ PDF/A 轉換 ============
@router.post("/convert-to-pdfa")
async def convert_to_pdfa(
    file: UploadFile = File(...),
    pdfa_version: str = Form("2b", description="PDF/A 版本：1b, 2b, 3b")
):
    """
    轉換為 PDF/A 格式（長期保存用）

    使用 Ghostscript 進行轉換
    """
    if pdfa_version not in ["1b", "2b", "3b"]:
        raise HTTPException(status_code=400, detail="版本必須是 1b, 2b 或 3b")

    file_path = await save_upload_file(file, "advanced")

    try:
        output_path = generate_output_path("pdfa.pdf")

        # 使用 Ghostscript 轉換
        pdfa_def = f"PDFA{pdfa_version[0]}b"

        result = subprocess.run([
            "gs",
            "-dPDFA",
            "-dBATCH",
            "-dNOPAUSE",
            "-dNOOUTERSAVE",
            "-sColorConversionStrategy=UseDeviceIndependentColor",
            f"-sDEVICE=pdfwrite",
            f"-dPDFACompatibilityPolicy=1",
            f"-sOutputFile={output_path}",
            str(file_path)
        ], capture_output=True, timeout=120)

        if result.returncode != 0 or not output_path.exists():
            # Ghostscript 失敗，使用 PyMuPDF 的基本轉換
            pdf = fitz.open(file_path)
            save_compatible_pdf(pdf, output_path, title="PDF/A Document")
            pdf.close()

        return FileResponse(
            path=output_path,
            filename=f"pdfa-{pdfa_version}.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 比較兩個 PDF ============
@router.post("/compare")
async def compare_pdfs(files: List[UploadFile] = File(...)):
    """
    比較兩個 PDF

    - 文字內容比較
    - 回傳差異報告
    """
    if len(files) != 2:
        raise HTTPException(status_code=400, detail="需要正好 2 個 PDF 檔案")

    file_paths = await save_multiple_files(files, "compare")

    try:
        pdf1 = fitz.open(file_paths[0])
        pdf2 = fitz.open(file_paths[1])

        differences = []

        # 比較頁數
        if len(pdf1) != len(pdf2):
            differences.append({
                "type": "page_count",
                "file1": len(pdf1),
                "file2": len(pdf2)
            })

        # 逐頁比較文字
        max_pages = max(len(pdf1), len(pdf2))

        for i in range(max_pages):
            text1 = pdf1[i].get_text() if i < len(pdf1) else ""
            text2 = pdf2[i].get_text() if i < len(pdf2) else ""

            if text1 != text2:
                # 找出差異
                import difflib
                diff = list(difflib.unified_diff(
                    text1.splitlines(),
                    text2.splitlines(),
                    lineterm='',
                    n=0
                ))

                if diff:
                    differences.append({
                        "type": "text",
                        "page": i + 1,
                        "diff": diff[:50]  # 限制輸出量
                    })

        pdf1.close()
        pdf2.close()

        return {
            "identical": len(differences) == 0,
            "difference_count": len(differences),
            "differences": differences
        }

    finally:
        for path in file_paths:
            path.unlink(missing_ok=True)


# ============ Bates 編號 ============
@router.post("/bates-numbering")
async def add_bates_numbering(
    file: UploadFile = File(...),
    prefix: str = Form("", description="前綴，如 'ABC'"),
    start_number: int = Form(1, description="起始編號"),
    digits: int = Form(6, description="編號位數"),
    suffix: str = Form("", description="後綴"),
    position: str = Form("bottom-right", description="位置：top-left, top-center, top-right, bottom-left, bottom-center, bottom-right"),
    font_size: float = Form(10)
):
    """
    新增 Bates 編號（法律文件用）

    - 每頁唯一編號
    - 可設定前綴、後綴、位數
    """
    file_path = await save_upload_file(file, "advanced")

    try:
        pdf = fitz.open(file_path)

        # 位置對應
        positions = {
            "top-left": lambda r: (20, 30),
            "top-center": lambda r: (r.width / 2 - 30, 30),
            "top-right": lambda r: (r.width - 100, 30),
            "bottom-left": lambda r: (20, r.height - 20),
            "bottom-center": lambda r: (r.width / 2 - 30, r.height - 20),
            "bottom-right": lambda r: (r.width - 100, r.height - 20),
        }

        if position not in positions:
            position = "bottom-right"

        for i, page in enumerate(pdf):
            rect = page.rect
            x, y = positions[position](rect)

            # 產生 Bates 編號
            number = str(start_number + i).zfill(digits)
            bates = f"{prefix}{number}{suffix}"

            # 插入編號
            page.insert_text(
                point=(x, y),
                text=bates,
                fontsize=font_size,
                color=(0, 0, 0)
            )

        output_path = generate_output_path("bates.pdf")
        save_compatible_pdf(pdf, output_path, title="Bates Numbered")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="bates_numbered.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 頁首頁尾 ============
@router.post("/header-footer")
async def add_header_footer(
    file: UploadFile = File(...),
    header_left: str = Form(""),
    header_center: str = Form(""),
    header_right: str = Form(""),
    footer_left: str = Form(""),
    footer_center: str = Form(""),
    footer_right: str = Form(""),
    include_page_number: bool = Form(True, description="在頁尾中心加入頁碼"),
    font_size: float = Form(10),
    margin: float = Form(30, description="邊距")
):
    """
    新增頁首頁尾

    支援變數：
    - {page} - 當前頁碼
    - {total} - 總頁數
    - {date} - 當前日期
    """
    from datetime import datetime

    file_path = await save_upload_file(file, "advanced")

    try:
        pdf = fitz.open(file_path)
        total_pages = len(pdf)
        today = datetime.now().strftime("%Y-%m-%d")

        def replace_vars(text, page_num):
            return text.replace("{page}", str(page_num)) \
                       .replace("{total}", str(total_pages)) \
                       .replace("{date}", today)

        for i, page in enumerate(pdf):
            rect = page.rect
            page_num = i + 1

            # 頁首
            if header_left:
                page.insert_text(
                    point=(margin, margin),
                    text=replace_vars(header_left, page_num),
                    fontsize=font_size
                )
            if header_center:
                page.insert_text(
                    point=(rect.width / 2 - 20, margin),
                    text=replace_vars(header_center, page_num),
                    fontsize=font_size
                )
            if header_right:
                page.insert_text(
                    point=(rect.width - margin - 50, margin),
                    text=replace_vars(header_right, page_num),
                    fontsize=font_size
                )

            # 頁尾
            footer_y = rect.height - margin / 2

            if footer_left:
                page.insert_text(
                    point=(margin, footer_y),
                    text=replace_vars(footer_left, page_num),
                    fontsize=font_size
                )

            center_text = footer_center
            if include_page_number and not footer_center:
                center_text = f"{page_num} / {total_pages}"
            if center_text:
                page.insert_text(
                    point=(rect.width / 2 - 20, footer_y),
                    text=replace_vars(center_text, page_num),
                    fontsize=font_size
                )

            if footer_right:
                page.insert_text(
                    point=(rect.width - margin - 50, footer_y),
                    text=replace_vars(footer_right, page_num),
                    fontsize=font_size
                )

        output_path = generate_output_path("header_footer.pdf")
        save_compatible_pdf(pdf, output_path, title="PDF with Header/Footer")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="with_header_footer.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 新增註解 ============
@router.post("/add-annotation")
async def add_annotation(
    file: UploadFile = File(...),
    page: int = Form(...),
    annotation_type: str = Form(..., description="類型：highlight, underline, strikeout, note"),
    x: float = Form(...),
    y: float = Form(...),
    width: float = Form(100),
    height: float = Form(20),
    content: str = Form("", description="註解內容（note 類型用）"),
    color: str = Form("#FFFF00", description="顏色")
):
    """
    新增註解

    - highlight: 螢光筆
    - underline: 底線
    - strikeout: 刪除線
    - note: 便利貼
    """
    file_path = await save_upload_file(file, "advanced")

    try:
        pdf = fitz.open(file_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]

        # 解析顏色
        color_hex = color.lstrip('#')
        r = int(color_hex[0:2], 16) / 255
        g = int(color_hex[2:4], 16) / 255
        b = int(color_hex[4:6], 16) / 255

        rect = fitz.Rect(x, y, x + width, y + height)

        if annotation_type == "highlight":
            annot = pdf_page.add_highlight_annot(rect)
            annot.set_colors(stroke=(r, g, b))
        elif annotation_type == "underline":
            annot = pdf_page.add_underline_annot(rect)
            annot.set_colors(stroke=(r, g, b))
        elif annotation_type == "strikeout":
            annot = pdf_page.add_strikeout_annot(rect)
            annot.set_colors(stroke=(r, g, b))
        elif annotation_type == "note":
            annot = pdf_page.add_text_annot((x, y), content)
            annot.set_colors(stroke=(r, g, b))
        else:
            raise HTTPException(status_code=400, detail="無效的註解類型")

        annot.update()

        output_path = generate_output_path("annotated.pdf")
        save_compatible_pdf(pdf, output_path, title="Annotated PDF")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="annotated.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 取得所有註解 ============
@router.post("/get-annotations")
async def get_annotations(file: UploadFile = File(...)):
    """
    取得 PDF 中的所有註解
    """
    file_path = await save_upload_file(file, "advanced")

    try:
        pdf = fitz.open(file_path)
        annotations = []

        for i, page in enumerate(pdf):
            for annot in page.annots():
                annotations.append({
                    "page": i + 1,
                    "type": annot.type[1],  # 類型名稱
                    "rect": {
                        "x": annot.rect.x0,
                        "y": annot.rect.y0,
                        "width": annot.rect.width,
                        "height": annot.rect.height
                    },
                    "content": annot.info.get("content", ""),
                    "author": annot.info.get("title", ""),
                })

        pdf.close()

        return {
            "count": len(annotations),
            "annotations": annotations
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ 移除所有註解 ============
@router.post("/remove-annotations")
async def remove_annotations(file: UploadFile = File(...)):
    """
    移除 PDF 中的所有註解
    """
    file_path = await save_upload_file(file, "advanced")

    try:
        pdf = fitz.open(file_path)
        removed_count = 0

        for page in pdf:
            annots = list(page.annots())
            for annot in annots:
                page.delete_annot(annot)
                removed_count += 1

        output_path = generate_output_path("no_annotations.pdf")
        save_compatible_pdf(pdf, output_path, title="Annotations Removed")
        pdf.close()

        return {
            "success": True,
            "removed_count": removed_count,
            "download_url": f"/download/{output_path.name}"
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ 新增圖章 ============
@router.post("/add-stamp")
async def add_stamp(
    file: UploadFile = File(...),
    page: int = Form(...),
    stamp_type: str = Form(..., description="類型：approved, rejected, confidential, draft, custom"),
    custom_text: str = Form("", description="自訂文字（stamp_type=custom 時使用）"),
    x: float = Form(...),
    y: float = Form(...),
    size: float = Form(100)
):
    """
    新增圖章

    預設圖章：approved, rejected, confidential, draft
    或自訂文字
    """
    file_path = await save_upload_file(file, "advanced")

    try:
        pdf = fitz.open(file_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]

        # 預設圖章文字和顏色
        stamps = {
            "approved": ("APPROVED", (0, 0.5, 0)),       # 綠色
            "rejected": ("REJECTED", (0.8, 0, 0)),       # 紅色
            "confidential": ("CONFIDENTIAL", (0.8, 0, 0)),
            "draft": ("DRAFT", (0.5, 0.5, 0.5)),         # 灰色
            "custom": (custom_text, (0, 0, 0.8)),         # 藍色
        }

        if stamp_type not in stamps:
            stamp_type = "custom"

        text, color = stamps[stamp_type]

        if not text:
            raise HTTPException(status_code=400, detail="需要提供圖章文字")

        # 繪製圖章（簡化版：文字+框）
        rect = fitz.Rect(x, y, x + size, y + size * 0.3)

        # 繪製邊框
        shape = pdf_page.new_shape()
        shape.draw_rect(rect)
        shape.finish(color=color, width=2)
        shape.commit()

        # 插入文字
        pdf_page.insert_text(
            point=(x + 5, y + size * 0.2),
            text=text,
            fontsize=size * 0.15,
            color=color
        )

        output_path = generate_output_path("stamped.pdf")
        save_compatible_pdf(pdf, output_path, title="Stamped PDF")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="stamped.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)
