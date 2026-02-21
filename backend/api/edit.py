"""
編輯 API - 編輯文字、圖片、新增內容
"""
import fitz  # PyMuPDF
import base64
import io
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Body
from fastapi.responses import FileResponse
from typing import List, Optional
from pydantic import BaseModel
from PIL import Image

from utils.file_handler import save_upload_file, generate_output_path
from utils.pdf_compat import save_compatible_pdf

router = APIRouter()


# ============ 資料模型 ============
class TextEdit(BaseModel):
    page: int  # 頁碼（從 1 開始）
    x: float
    y: float
    width: float
    height: float
    text: str
    font_size: float = 12
    color: str = "#000000"  # hex color


class ImageInsert(BaseModel):
    page: int
    x: float
    y: float
    width: float
    height: float
    image_base64: str  # base64 編碼的圖片


class LinkInsert(BaseModel):
    page: int
    x: float
    y: float
    width: float
    height: float
    url: str


# ============ 取得 PDF 資訊 ============
@router.post("/info")
async def get_pdf_info(file: UploadFile = File(...)):
    """
    取得 PDF 資訊

    - 頁數、尺寸、文字內容等
    """
    file_path = await save_upload_file(file, "edit")

    try:
        pdf = fitz.open(file_path)

        pages_info = []
        for i, page in enumerate(pdf):
            rect = page.rect
            pages_info.append({
                "page_number": i + 1,
                "width": rect.width,
                "height": rect.height,
                "rotation": page.rotation,
            })

        info = {
            "page_count": len(pdf),
            "metadata": pdf.metadata,
            "pages": pages_info,
        }

        pdf.close()
        return info

    finally:
        file_path.unlink(missing_ok=True)


# ============ 取得頁面文字區塊 ============
@router.post("/get-text-blocks")
async def get_text_blocks(
    file: UploadFile = File(...),
    page: int = Form(1, description="頁碼（從 1 開始）")
):
    """
    取得頁面的文字區塊

    - 回傳每個文字區塊的位置和內容
    - 用於前端編輯器顯示
    """
    file_path = await save_upload_file(file, "edit")

    try:
        pdf = fitz.open(file_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]
        blocks = pdf_page.get_text("dict")["blocks"]

        text_blocks = []
        for block in blocks:
            if block["type"] == 0:  # 文字區塊
                for line in block["lines"]:
                    for span in line["spans"]:
                        text_blocks.append({
                            "text": span["text"],
                            "x": span["bbox"][0],
                            "y": span["bbox"][1],
                            "width": span["bbox"][2] - span["bbox"][0],
                            "height": span["bbox"][3] - span["bbox"][1],
                            "font": span["font"],
                            "size": span["size"],
                            "color": span["color"],
                        })

        pdf.close()
        return {"blocks": text_blocks}

    finally:
        file_path.unlink(missing_ok=True)


# ============ 新增文字 ============
@router.post("/add-text")
async def add_text(
    file: UploadFile = File(...),
    page: int = Form(..., description="頁碼（從 1 開始）"),
    x: float = Form(...),
    y: float = Form(...),
    text: str = Form(...),
    font_size: float = Form(12),
    color: str = Form("#000000")
):
    """
    在 PDF 上新增文字
    """
    file_path = await save_upload_file(file, "edit")

    try:
        pdf = fitz.open(file_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]

        # 解析顏色
        color_rgb = hex_to_rgb(color)

        # 插入文字
        pdf_page.insert_text(
            point=(x, y),
            text=text,
            fontsize=font_size,
            color=color_rgb
        )

        output_path = generate_output_path("edited.pdf")
        save_compatible_pdf(pdf, output_path, title="Edited PDF")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="edited.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 新增圖片 ============
@router.post("/add-image")
async def add_image(
    pdf_file: UploadFile = File(...),
    image_file: UploadFile = File(...),
    page: int = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    width: float = Form(...),
    height: float = Form(...)
):
    """
    在 PDF 上新增圖片
    """
    pdf_path = await save_upload_file(pdf_file, "edit")
    img_path = await save_upload_file(image_file, "edit")

    try:
        pdf = fitz.open(pdf_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]

        # 定義圖片位置
        rect = fitz.Rect(x, y, x + width, y + height)

        # 插入圖片
        pdf_page.insert_image(rect, filename=str(img_path))

        output_path = generate_output_path("with_image.pdf")
        save_compatible_pdf(pdf, output_path, title="PDF with Image")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="with_image.pdf",
            media_type="application/pdf"
        )

    finally:
        pdf_path.unlink(missing_ok=True)
        img_path.unlink(missing_ok=True)


# ============ 新增連結 ============
@router.post("/add-link")
async def add_link(
    file: UploadFile = File(...),
    page: int = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    width: float = Form(...),
    height: float = Form(...),
    url: str = Form(...)
):
    """
    在 PDF 上新增超連結
    """
    file_path = await save_upload_file(file, "edit")

    try:
        pdf = fitz.open(file_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]

        # 定義連結區域
        rect = fitz.Rect(x, y, x + width, y + height)

        # 建立連結
        link = {
            "kind": fitz.LINK_URI,
            "from": rect,
            "uri": url
        }
        pdf_page.insert_link(link)

        output_path = generate_output_path("with_link.pdf")
        save_compatible_pdf(pdf, output_path, title="PDF with Link")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="with_link.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 替換文字 ============
@router.post("/replace-text")
async def replace_text(
    file: UploadFile = File(...),
    search: str = Form(..., description="要搜尋的文字"),
    replace: str = Form(..., description="替換為"),
    match_case: bool = Form(True, description="區分大小寫")
):
    """
    搜尋並替換 PDF 中的文字

    注意：這會重新建立文字，可能影響格式
    """
    file_path = await save_upload_file(file, "edit")

    try:
        pdf = fitz.open(file_path)
        replaced_count = 0

        for page in pdf:
            # 搜尋文字
            text_instances = page.search_for(search)

            for inst in text_instances:
                # 用白色矩形覆蓋原文字
                page.draw_rect(inst, color=(1, 1, 1), fill=(1, 1, 1))

                # 插入新文字
                page.insert_text(
                    point=(inst.x0, inst.y1),
                    text=replace,
                    fontsize=10
                )
                replaced_count += 1

        output_path = generate_output_path("replaced.pdf")
        save_compatible_pdf(pdf, output_path, title="Text Replaced")
        pdf.close()

        return {
            "success": True,
            "replaced_count": replaced_count,
            "download_url": f"/download/{output_path.name}"
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ 刪除圖片 ============
@router.post("/remove-images")
async def remove_images(
    file: UploadFile = File(...),
    pages: str = Form("all", description="頁碼，如 '1,3,5' 或 'all'")
):
    """
    移除 PDF 中的圖片
    """
    file_path = await save_upload_file(file, "edit")

    try:
        pdf = fitz.open(file_path)
        removed_count = 0

        # 解析頁碼
        if pages.lower() == "all":
            page_indices = list(range(len(pdf)))
        else:
            page_indices = [int(p.strip()) - 1 for p in pages.split(",")]

        for i in page_indices:
            if 0 <= i < len(pdf):
                page = pdf[i]
                image_list = page.get_images()

                for img in image_list:
                    xref = img[0]
                    # 移除圖片引用
                    page.delete_image(xref)
                    removed_count += 1

        output_path = generate_output_path("no_images.pdf")
        save_compatible_pdf(pdf, output_path, title="Images Removed")
        pdf.close()

        return {
            "success": True,
            "removed_count": removed_count,
            "download_url": f"/download/{output_path.name}"
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ 套用編輯（前端編輯器用） ============
@router.post("/apply-edits")
async def apply_edits(
    file: UploadFile = File(...),
    edits: str = Form(..., description="JSON 格式的編輯內容"),
    scale: float = Form(1.0, description="縮放比例")
):
    """
    套用前端編輯器的所有編輯

    edits 格式：
    {
        "1": [  // 頁碼
            {
                "type": "text",
                "x": 100, "y": 200,
                "text": "Hello",
                "color": "#000000",
                "fontSize": 16
            },
            {
                "type": "highlight",
                "x": 50, "y": 100,
                "width": 200, "height": 30,
                "color": "#FFFF00"
            }
        ]
    }
    """
    import json

    file_path = await save_upload_file(file, "edit")

    try:
        pdf = fitz.open(file_path)
        edits_data = json.loads(edits)

        # 遍歷每個頁面的編輯
        for page_num_str, elements in edits_data.items():
            page_num = int(page_num_str)
            if page_num < 1 or page_num > len(pdf):
                continue

            pdf_page = pdf[page_num - 1]

            for element in elements:
                elem_type = element.get("type")
                # 座標需要除以縮放比例還原到實際 PDF 座標
                x = element.get("x", 0) / scale
                y = element.get("y", 0) / scale

                if elem_type == "text":
                    # 文字
                    text = element.get("text", "")
                    color = element.get("color", "#000000")
                    font_size = element.get("fontSize", 12) / scale
                    color_rgb = hex_to_rgb(color)

                    pdf_page.insert_text(
                        point=(x, y + font_size),  # PDF 文字座標從底部算
                        text=text,
                        fontsize=font_size,
                        color=color_rgb
                    )

                elif elem_type == "highlight":
                    # 螢光筆
                    width = element.get("width", 100) / scale
                    height = element.get("height", 20) / scale
                    color = element.get("color", "#FFFF00")
                    color_rgb = hex_to_rgb(color)

                    rect = fitz.Rect(x, y, x + width, y + height)
                    # 半透明填充
                    shape = pdf_page.new_shape()
                    shape.draw_rect(rect)
                    shape.finish(color=None, fill=color_rgb, fill_opacity=0.4)
                    shape.commit()

                elif elem_type == "rectangle":
                    # 矩形
                    width = element.get("width", 100) / scale
                    height = element.get("height", 50) / scale
                    color = element.get("color", "#FF0000")
                    color_rgb = hex_to_rgb(color)

                    rect = fitz.Rect(x, y, x + width, y + height)
                    pdf_page.draw_rect(rect, color=color_rgb, width=2)

                elif elem_type == "circle":
                    # 圓形
                    width = element.get("width", 50) / scale
                    height = element.get("height", 50) / scale
                    color = element.get("color", "#0000FF")
                    color_rgb = hex_to_rgb(color)

                    # 使用橢圓繪製
                    rect = fitz.Rect(x, y, x + width, y + height)
                    shape = pdf_page.new_shape()
                    shape.draw_oval(rect)
                    shape.finish(color=color_rgb, width=2)
                    shape.commit()

                elif elem_type == "image":
                    # 圖片（Base64）
                    width = element.get("width", 100) / scale
                    height = element.get("height", 100) / scale
                    data_url = element.get("dataUrl", "")

                    if data_url and "," in data_url:
                        # 解析 data URL
                        base64_data = data_url.split(",")[1]
                        img_bytes = base64.b64decode(base64_data)

                        rect = fitz.Rect(x, y, x + width, y + height)
                        pdf_page.insert_image(rect, stream=img_bytes)

                elif elem_type == "signature":
                    # 簽名（Base64 圖片）
                    width = element.get("width", 200) / scale
                    height = element.get("height", 100) / scale
                    data_url = element.get("dataUrl", "")

                    if data_url and "," in data_url:
                        base64_data = data_url.split(",")[1]
                        img_bytes = base64.b64decode(base64_data)

                        rect = fitz.Rect(x, y, x + width, y + height)
                        pdf_page.insert_image(rect, stream=img_bytes)

        output_path = generate_output_path("edited.pdf")
        save_compatible_pdf(pdf, output_path, title="Edited PDF")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="edited.pdf",
            media_type="application/pdf"
        )

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="無效的 JSON 格式")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"編輯失敗：{str(e)}")
    finally:
        file_path.unlink(missing_ok=True)


# ============ 工具函式 ============
def hex_to_rgb(hex_color: str) -> tuple:
    """將 hex 顏色轉為 RGB (0-1 範圍)"""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) / 255
    g = int(hex_color[2:4], 16) / 255
    b = int(hex_color[4:6], 16) / 255
    return (r, g, b)
