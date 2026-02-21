"""
安全性 API - 加密、解密、權限、浮水印、編輯敏感資訊
"""
import fitz  # PyMuPDF
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import Optional

from utils.file_handler import save_upload_file, generate_output_path
from utils.pdf_compat import save_compatible_pdf

router = APIRouter()


# ============ 加密 PDF ============
@router.post("/encrypt")
async def encrypt_pdf(
    file: UploadFile = File(...),
    user_password: str = Form(..., description="使用者密碼（開啟文件用）"),
    owner_password: str = Form(None, description="擁有者密碼（編輯權限用，不設定則與使用者密碼相同）"),
    allow_print: bool = Form(True, description="允許列印"),
    allow_copy: bool = Form(True, description="允許複製"),
    allow_modify: bool = Form(False, description="允許修改"),
    allow_annotate: bool = Form(True, description="允許註解")
):
    """
    加密 PDF 並設定權限

    - user_password: 開啟文件需要的密碼
    - owner_password: 編輯權限需要的密碼
    - 可設定各種權限
    """
    file_path = await save_upload_file(file, "security")

    try:
        pdf = fitz.open(file_path)

        # 設定擁有者密碼
        if not owner_password:
            owner_password = user_password

        # 計算權限
        perm = fitz.PDF_PERM_ACCESSIBILITY  # 基本權限

        if allow_print:
            perm |= fitz.PDF_PERM_PRINT | fitz.PDF_PERM_PRINT_HQ
        if allow_copy:
            perm |= fitz.PDF_PERM_COPY
        if allow_modify:
            perm |= fitz.PDF_PERM_MODIFY
        if allow_annotate:
            perm |= fitz.PDF_PERM_ANNOTATE

        # 加密
        output_path = generate_output_path("encrypted.pdf")
        pdf.save(
            str(output_path),
            encryption=fitz.PDF_ENCRYPT_AES_256,
            user_pw=user_password,
            owner_pw=owner_password,
            permissions=perm
        )
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="encrypted.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 解密 PDF ============
@router.post("/decrypt")
async def decrypt_pdf(
    file: UploadFile = File(...),
    password: str = Form(..., description="密碼")
):
    """
    解密 PDF

    - 需要提供正確的密碼
    - 產生無密碼的 PDF
    """
    file_path = await save_upload_file(file, "security")

    try:
        pdf = fitz.open(file_path)

        # 嘗試解密
        if pdf.is_encrypted:
            if not pdf.authenticate(password):
                raise HTTPException(status_code=400, detail="密碼錯誤")

        # 儲存為無密碼 PDF（使用相容性設定）
        output_path = generate_output_path("decrypted.pdf")
        save_compatible_pdf(pdf, output_path, title="Decrypted PDF")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="decrypted.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 新增浮水印 ============
@router.post("/watermark")
async def add_watermark(
    file: UploadFile = File(...),
    text: str = Form(..., description="浮水印文字"),
    pages: str = Form("all", description="頁碼，如 '1,3,5' 或 'all'"),
    opacity: float = Form(0.3, description="透明度 (0-1)"),
    angle: float = Form(45, description="旋轉角度"),
    font_size: float = Form(60, description="字體大小"),
    color: str = Form("#888888", description="顏色（hex）")
):
    """
    新增文字浮水印

    - 可設定透明度、角度、大小、顏色
    """
    file_path = await save_upload_file(file, "security")

    try:
        pdf = fitz.open(file_path)

        # 解析顏色
        color_hex = color.lstrip('#')
        r = int(color_hex[0:2], 16) / 255
        g = int(color_hex[2:4], 16) / 255
        b = int(color_hex[4:6], 16) / 255

        # 解析頁碼
        if pages.lower() == "all":
            page_indices = list(range(len(pdf)))
        else:
            page_indices = [int(p.strip()) - 1 for p in pages.split(",")]

        for i in page_indices:
            if 0 <= i < len(pdf):
                page = pdf[i]
                rect = page.rect

                # 計算中心位置
                center_x = rect.width / 2
                center_y = rect.height / 2

                # 使用 TextWriter 來實現旋轉浮水印
                # PyMuPDF insert_text 的 rotate 只支援 0/90/180/270
                # 使用 Shape 繪製旋轉文字
                import math

                # 將角度轉為最接近的標準角度
                std_angle = round(angle / 90) * 90 % 360

                # 插入浮水印文字（使用標準角度 + 透明度）
                page.insert_text(
                    point=(center_x - len(text) * font_size / 4, center_y),
                    text=text,
                    fontsize=font_size,
                    color=(r, g, b),
                    rotate=int(std_angle),
                    fill_opacity=opacity
                )

        output_path = generate_output_path("watermarked.pdf")
        save_compatible_pdf(pdf, output_path, title="Watermarked PDF")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="watermarked.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 圖片浮水印 ============
@router.post("/watermark-image")
async def add_image_watermark(
    pdf_file: UploadFile = File(...),
    watermark_file: UploadFile = File(..., description="浮水印圖片"),
    pages: str = Form("all"),
    x: float = Form(None, description="X 位置（不設定則置中）"),
    y: float = Form(None, description="Y 位置（不設定則置中）"),
    width: float = Form(100),
    height: float = Form(100),
    opacity: float = Form(0.3)
):
    """
    新增圖片浮水印
    """
    pdf_path = await save_upload_file(pdf_file, "security")
    wm_path = await save_upload_file(watermark_file, "security")

    try:
        pdf = fitz.open(pdf_path)

        # 解析頁碼
        if pages.lower() == "all":
            page_indices = list(range(len(pdf)))
        else:
            page_indices = [int(p.strip()) - 1 for p in pages.split(",")]

        for i in page_indices:
            if 0 <= i < len(pdf):
                page = pdf[i]
                rect = page.rect

                # 計算位置
                if x is None:
                    x = (rect.width - width) / 2
                if y is None:
                    y = (rect.height - height) / 2

                img_rect = fitz.Rect(x, y, x + width, y + height)

                # 插入圖片
                page.insert_image(img_rect, filename=str(wm_path), overlay=True)

        output_path = generate_output_path("watermarked.pdf")
        save_compatible_pdf(pdf, output_path, title="Image Watermarked PDF")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="watermarked.pdf",
            media_type="application/pdf"
        )

    finally:
        pdf_path.unlink(missing_ok=True)
        wm_path.unlink(missing_ok=True)


# ============ 編輯敏感資訊（塗黑）============
@router.post("/redact")
async def redact_text(
    file: UploadFile = File(...),
    search_text: str = Form(..., description="要塗黑的文字"),
    redact_color: str = Form("#000000", description="塗黑顏色")
):
    """
    編輯敏感資訊（塗黑）

    - 搜尋並塗黑指定文字
    - 塗黑後無法還原
    """
    file_path = await save_upload_file(file, "security")

    try:
        pdf = fitz.open(file_path)
        redacted_count = 0

        # 解析顏色
        color_hex = redact_color.lstrip('#')
        r = int(color_hex[0:2], 16) / 255
        g = int(color_hex[2:4], 16) / 255
        b = int(color_hex[4:6], 16) / 255

        for page in pdf:
            # 搜尋文字
            instances = page.search_for(search_text)

            for inst in instances:
                # 添加塗黑標記
                annot = page.add_redact_annot(inst, fill=(r, g, b))
                redacted_count += 1

            # 套用塗黑
            page.apply_redactions()

        output_path = generate_output_path("redacted.pdf")
        save_compatible_pdf(pdf, output_path, title="Redacted PDF")
        pdf.close()

        return {
            "success": True,
            "redacted_count": redacted_count,
            "download_url": f"/download/{output_path.name}"
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ 移除元數據 ============
@router.post("/remove-metadata")
async def remove_metadata(file: UploadFile = File(...)):
    """
    移除 PDF 元數據

    - 移除作者、標題、建立日期等資訊
    """
    file_path = await save_upload_file(file, "security")

    try:
        pdf = fitz.open(file_path)

        # 清除元數據
        pdf.set_metadata({})

        output_path = generate_output_path("no_metadata.pdf")
        # 保留清除元資料的需求，但加入線性化以提高相容性
        pdf.save(str(output_path), garbage=4, clean=True, deflate=True, linear=True)
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="no_metadata.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)


# ============ 設定元數據 ============
@router.post("/set-metadata")
async def set_metadata(
    file: UploadFile = File(...),
    title: str = Form(None),
    author: str = Form(None),
    subject: str = Form(None),
    keywords: str = Form(None),
    creator: str = Form(None)
):
    """
    設定 PDF 元數據
    """
    file_path = await save_upload_file(file, "security")

    try:
        pdf = fitz.open(file_path)

        metadata = pdf.metadata
        if title:
            metadata["title"] = title
        if author:
            metadata["author"] = author
        if subject:
            metadata["subject"] = subject
        if keywords:
            metadata["keywords"] = keywords
        if creator:
            metadata["creator"] = creator

        pdf.set_metadata(metadata)

        output_path = generate_output_path("with_metadata.pdf")
        # 使用相容性設定但不覆蓋用戶設定的元資料
        pdf.save(str(output_path), garbage=4, deflate=True, clean=True, linear=True)
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="with_metadata.pdf",
            media_type="application/pdf"
        )

    finally:
        file_path.unlink(missing_ok=True)
