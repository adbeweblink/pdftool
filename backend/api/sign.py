"""
簽名表單 API - 電子簽名、表單填寫
"""
import fitz  # PyMuPDF
import base64
import io
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import List, Optional
from pydantic import BaseModel
from PIL import Image

from utils.file_handler import save_upload_file, generate_output_path
from utils.pdf_compat import save_compatible_pdf

router = APIRouter()


# ============ 新增簽名圖片 ============
@router.post("/add-signature")
async def add_signature(
    pdf_file: UploadFile = File(...),
    signature_file: UploadFile = File(..., description="簽名圖片（PNG 透明背景最佳）"),
    page: int = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    width: float = Form(100),
    height: float = Form(50)
):
    """
    在 PDF 上新增簽名圖片

    - 支援 PNG（透明背景）
    - 可調整位置和大小
    """
    pdf_path = await save_upload_file(pdf_file, "sign")
    sig_path = await save_upload_file(signature_file, "sign")

    try:
        pdf = fitz.open(pdf_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]

        # 定義簽名位置
        rect = fitz.Rect(x, y, x + width, y + height)

        # 插入簽名圖片
        pdf_page.insert_image(rect, filename=str(sig_path))

        output_path = generate_output_path("signed.pdf")
        save_compatible_pdf(pdf, output_path, title="Signed PDF")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="signed.pdf",
            media_type="application/pdf"
        )

    finally:
        pdf_path.unlink(missing_ok=True)
        sig_path.unlink(missing_ok=True)


# ============ 新增簽名（Base64）============
@router.post("/add-signature-base64")
async def add_signature_base64(
    file: UploadFile = File(...),
    signature_base64: str = Form(..., description="Base64 編碼的簽名圖片"),
    page: int = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    width: float = Form(100),
    height: float = Form(50)
):
    """
    使用 Base64 編碼的簽名圖片

    - 適合前端 Canvas 繪製的簽名
    """
    file_path = await save_upload_file(file, "sign")

    try:
        pdf = fitz.open(file_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        # 解碼 Base64 圖片
        if "," in signature_base64:
            signature_base64 = signature_base64.split(",")[1]

        img_data = base64.b64decode(signature_base64)

        pdf_page = pdf[page - 1]
        rect = fitz.Rect(x, y, x + width, y + height)

        # 插入圖片
        pdf_page.insert_image(rect, stream=img_data)

        output_path = generate_output_path("signed.pdf")
        save_compatible_pdf(pdf, output_path, title="Signed PDF")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="signed.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 取得表單欄位 ============
@router.post("/get-form-fields")
async def get_form_fields(file: UploadFile = File(...)):
    """
    取得 PDF 表單欄位

    - 回傳所有可填寫的欄位資訊
    """
    file_path = await save_upload_file(file, "sign")

    try:
        pdf = fitz.open(file_path)
        fields = []

        for i, page in enumerate(pdf):
            widgets = page.widgets()
            if widgets:
                for widget in widgets:
                    field_info = {
                        "page": i + 1,
                        "name": widget.field_name,
                        "type": widget.field_type_string,
                        "value": widget.field_value,
                        "rect": {
                            "x": widget.rect.x0,
                            "y": widget.rect.y0,
                            "width": widget.rect.width,
                            "height": widget.rect.height
                        },
                        "flags": widget.field_flags,
                    }
                    fields.append(field_info)

        pdf.close()

        return {
            "field_count": len(fields),
            "fields": fields
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ 填寫表單 ============
@router.post("/fill-form")
async def fill_form(
    file: UploadFile = File(...),
    field_data: str = Form(..., description='JSON 格式，如 {"field_name": "value"}')
):
    """
    填寫 PDF 表單

    - field_data: JSON 格式的欄位名稱和值
    """
    import json

    file_path = await save_upload_file(file, "sign")

    try:
        # 解析欄位資料
        try:
            data = json.loads(field_data)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="無效的 JSON 格式")

        pdf = fitz.open(file_path)
        filled_count = 0

        for page in pdf:
            widgets = page.widgets()
            if widgets:
                for widget in widgets:
                    if widget.field_name in data:
                        widget.field_value = str(data[widget.field_name])
                        widget.update()
                        filled_count += 1

        output_path = generate_output_path("filled.pdf")
        save_compatible_pdf(pdf, output_path, title="Form Filled")
        pdf.close()

        return {
            "success": True,
            "filled_count": filled_count,
            "download_url": f"/download/{output_path.name}"
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ 建立文字欄位 ============
@router.post("/create-text-field")
async def create_text_field(
    file: UploadFile = File(...),
    page: int = Form(...),
    field_name: str = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    width: float = Form(100),
    height: float = Form(20)
):
    """
    建立文字輸入欄位
    """
    file_path = await save_upload_file(file, "sign")

    try:
        pdf = fitz.open(file_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]

        # 建立文字欄位
        rect = fitz.Rect(x, y, x + width, y + height)
        widget = fitz.Widget()
        widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
        widget.field_name = field_name
        widget.rect = rect
        widget.field_flags = 0

        pdf_page.add_widget(widget)

        output_path = generate_output_path("with_field.pdf")
        save_compatible_pdf(pdf, output_path, title="PDF with Form Field")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="with_field.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 建立核取方塊 ============
@router.post("/create-checkbox")
async def create_checkbox(
    file: UploadFile = File(...),
    page: int = Form(...),
    field_name: str = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    size: float = Form(15)
):
    """
    建立核取方塊
    """
    file_path = await save_upload_file(file, "sign")

    try:
        pdf = fitz.open(file_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]

        rect = fitz.Rect(x, y, x + size, y + size)
        widget = fitz.Widget()
        widget.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
        widget.field_name = field_name
        widget.rect = rect

        pdf_page.add_widget(widget)

        output_path = generate_output_path("with_checkbox.pdf")
        save_compatible_pdf(pdf, output_path, title="PDF with Checkbox")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="with_checkbox.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 扁平化表單 ============
@router.post("/flatten-form")
async def flatten_form(file: UploadFile = File(...)):
    """
    扁平化表單

    - 將表單欄位轉為靜態內容
    - 無法再編輯
    """
    file_path = await save_upload_file(file, "sign")

    try:
        pdf = fitz.open(file_path)

        for page in pdf:
            # 取得所有 widget 並移除
            widgets = list(page.widgets())
            for widget in widgets:
                # 先將值繪製到頁面上
                if widget.field_value:
                    page.insert_text(
                        point=(widget.rect.x0, widget.rect.y1 - 2),
                        text=str(widget.field_value),
                        fontsize=10
                    )
                # 刪除 widget
                widget.reset()

        output_path = generate_output_path("flattened.pdf")
        save_compatible_pdf(pdf, output_path, title="Flattened Form")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="flattened.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)
