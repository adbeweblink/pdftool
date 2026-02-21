"""
PDF 編輯器 API
- 解析 PDF 提取元素（文字、圖片、位置）
- 重新生成編輯後的 PDF
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import fitz  # PyMuPDF
import tempfile
import os
import base64
import json
import uuid

router = APIRouter(prefix="/api/editor", tags=["PDF Editor"])


class TextElement(BaseModel):
    id: str
    type: str = "text"
    text: str
    x: float
    y: float
    width: float
    height: float
    fontSize: float
    fontFamily: str = "Helvetica"
    color: str = "#000000"
    page: int = 0


class ImageElement(BaseModel):
    id: str
    type: str = "image"
    src: str  # base64
    x: float
    y: float
    width: float
    height: float
    page: int = 0


class PageData(BaseModel):
    width: float
    height: float
    elements: List[dict]
    backgroundImage: Optional[str] = None  # 頁面渲染成圖片的 base64


class PDFParseResponse(BaseModel):
    success: bool
    pages: List[PageData]
    totalPages: int


class SaveRequest(BaseModel):
    pages: List[dict]
    originalWidth: float
    originalHeight: float


@router.post("/parse", response_model=PDFParseResponse)
async def parse_pdf(file: UploadFile = File(...)):
    """解析 PDF，提取文字和圖片元素"""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="只支援 PDF 檔案")

    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")

        pages = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            page_rect = page.rect

            elements = []

            # 提取文字區塊
            text_dict = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)

            for block in text_dict.get("blocks", []):
                if block.get("type") == 0:  # 文字區塊
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "").strip()
                            if text:
                                bbox = span.get("bbox", [0, 0, 0, 0])
                                font_size = span.get("size", 12)

                                # 轉換顏色
                                color_int = span.get("color", 0)
                                color = f"#{color_int:06x}" if color_int else "#000000"

                                elements.append({
                                    "id": str(uuid.uuid4()),
                                    "type": "text",
                                    "text": text,
                                    "x": bbox[0],
                                    "y": bbox[1],
                                    "width": bbox[2] - bbox[0],
                                    "height": bbox[3] - bbox[1],
                                    "fontSize": font_size,
                                    "fontFamily": span.get("font", "Helvetica"),
                                    "color": color,
                                    "page": page_num
                                })

            # 提取圖片
            for img_index, img in enumerate(page.get_images(full=True)):
                xref = img[0]
                try:
                    base_image = doc.extract_image(xref)
                    image_data = base_image["image"]
                    image_ext = base_image["ext"]

                    # 取得圖片位置
                    img_rects = page.get_image_rects(xref)
                    if img_rects:
                        rect = img_rects[0]

                        # 轉 base64
                        img_base64 = base64.b64encode(image_data).decode('utf-8')

                        elements.append({
                            "id": str(uuid.uuid4()),
                            "type": "image",
                            "src": f"data:image/{image_ext};base64,{img_base64}",
                            "x": rect.x0,
                            "y": rect.y0,
                            "width": rect.width,
                            "height": rect.height,
                            "page": page_num
                        })
                except Exception:
                    continue

            # 將整頁渲染成背景圖（用於精確顯示）
            mat = fitz.Matrix(2, 2)  # 2x 縮放提高品質
            pix = page.get_pixmap(matrix=mat)
            bg_base64 = base64.b64encode(pix.tobytes("png")).decode('utf-8')

            pages.append(PageData(
                width=page_rect.width,
                height=page_rect.height,
                elements=elements,
                backgroundImage=f"data:image/png;base64,{bg_base64}"
            ))

        doc.close()

        return PDFParseResponse(
            success=True,
            pages=pages,
            totalPages=len(pages)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 解析失敗：{str(e)}")


@router.post("/save")
async def save_pdf(request: SaveRequest):
    """將編輯後的內容重新生成 PDF"""
    try:
        # 創建新 PDF
        doc = fitz.open()

        for page_data in request.pages:
            # 創建頁面
            page = doc.new_page(
                width=request.originalWidth,
                height=request.originalHeight
            )

            for element in page_data.get("elements", []):
                elem_type = element.get("type")

                if elem_type == "text":
                    # 插入文字
                    text = element.get("text", "")
                    x = element.get("x", 0)
                    y = element.get("y", 0)
                    font_size = element.get("fontSize", 12)
                    color_hex = element.get("color", "#000000")

                    # 轉換顏色
                    color_hex = color_hex.lstrip('#')
                    r = int(color_hex[0:2], 16) / 255
                    g = int(color_hex[2:4], 16) / 255
                    b = int(color_hex[4:6], 16) / 255

                    # 計算文字基線位置
                    text_point = fitz.Point(x, y + font_size)

                    page.insert_text(
                        text_point,
                        text,
                        fontsize=font_size,
                        color=(r, g, b)
                    )

                elif elem_type == "image":
                    # 插入圖片
                    src = element.get("src", "")
                    x = element.get("x", 0)
                    y = element.get("y", 0)
                    width = element.get("width", 100)
                    height = element.get("height", 100)

                    if src.startswith("data:"):
                        # 解析 base64
                        _, data = src.split(",", 1)
                        img_data = base64.b64decode(data)

                        rect = fitz.Rect(x, y, x + width, y + height)
                        page.insert_image(rect, stream=img_data)

        # 保存到臨時檔案
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        doc.save(temp_file.name)
        doc.close()

        return FileResponse(
            temp_file.name,
            media_type="application/pdf",
            filename="edited.pdf"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 生成失敗：{str(e)}")
