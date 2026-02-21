"""
多媒體嵌入 API - 在 PDF 中嵌入影片、音訊
"""
import fitz
import io
import base64
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import List, Optional

from utils.file_handler import save_upload_file, generate_output_path
from utils.pdf_compat import save_compatible_pdf

router = APIRouter()


# ============ 嵌入影片 ============
@router.post("/embed-video")
async def embed_video(
    pdf_file: UploadFile = File(...),
    video_file: UploadFile = File(...),
    page: int = Form(1, description="頁碼"),
    x: float = Form(100),
    y: float = Form(100),
    width: float = Form(400),
    height: float = Form(300),
    poster_file: Optional[UploadFile] = File(None, description="影片封面圖")
):
    """
    在 PDF 中嵌入影片

    注意：嵌入的影片需要在支援多媒體的 PDF 閱讀器中才能播放
    瀏覽器 PDF 閱讀器通常不支援

    支援格式：MP4, MOV, AVI, FLV
    """
    pdf_path = await save_upload_file(pdf_file, "multimedia")
    video_path = await save_upload_file(video_file, "multimedia")
    poster_path = None

    if poster_file:
        poster_path = await save_upload_file(poster_file, "multimedia")

    try:
        pdf = fitz.open(pdf_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]

        # 定義影片區域
        rect = fitz.Rect(x, y, x + width, y + height)

        # 讀取影片檔案
        with open(video_path, "rb") as f:
            video_data = f.read()

        # 建立 RichMedia 註解（PDF 標準的多媒體嵌入方式）
        # 注意：PyMuPDF 對 RichMedia 的支援有限，這裡使用 FileAttachment 作為替代

        # 建立檔案附件註解
        annot = pdf_page.add_file_annot(
            point=fitz.Point(x, y),
            buffer=video_data,
            filename=video_file.filename,
            desc=f"影片：{video_file.filename}"
        )

        # 設定註解外觀
        annot.set_rect(rect)

        # 如果有封面圖，在該位置顯示
        if poster_path:
            pdf_page.insert_image(rect, filename=str(poster_path))
            # 加入播放提示
            pdf_page.insert_text(
                fitz.Point(x + width/2 - 30, y + height/2),
                "▶ 點擊播放",
                fontsize=14,
                color=(1, 1, 1)
            )
        else:
            # 繪製預設影片預覽框
            pdf_page.draw_rect(rect, color=(0.2, 0.2, 0.2), fill=(0.1, 0.1, 0.1))
            pdf_page.insert_text(
                fitz.Point(x + width/2 - 50, y + height/2),
                "🎬 影片附件",
                fontsize=16,
                color=(1, 1, 1)
            )
            pdf_page.insert_text(
                fitz.Point(x + width/2 - 60, y + height/2 + 20),
                f"({video_file.filename})",
                fontsize=10,
                color=(0.7, 0.7, 0.7)
            )

        output_path = generate_output_path("with_video.pdf")
        save_compatible_pdf(pdf, output_path, title="PDF with Video")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="with_video.pdf",
            media_type="application/pdf"
        )

    finally:
        pdf_path.unlink(missing_ok=True)
        video_path.unlink(missing_ok=True)
        if poster_path:
            poster_path.unlink(missing_ok=True)


# ============ 嵌入音訊 ============
@router.post("/embed-audio")
async def embed_audio(
    pdf_file: UploadFile = File(...),
    audio_file: UploadFile = File(...),
    page: int = Form(1),
    x: float = Form(100),
    y: float = Form(100),
    width: float = Form(200),
    height: float = Form(50)
):
    """
    在 PDF 中嵌入音訊

    支援格式：MP3, WAV, OGG
    """
    pdf_path = await save_upload_file(pdf_file, "multimedia")
    audio_path = await save_upload_file(audio_file, "multimedia")

    try:
        pdf = fitz.open(pdf_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]
        rect = fitz.Rect(x, y, x + width, y + height)

        # 讀取音訊檔案
        with open(audio_path, "rb") as f:
            audio_data = f.read()

        # 建立檔案附件
        annot = pdf_page.add_file_annot(
            point=fitz.Point(x, y),
            buffer=audio_data,
            filename=audio_file.filename,
            desc=f"音訊：{audio_file.filename}"
        )
        annot.set_rect(rect)

        # 繪製音訊播放器外觀
        pdf_page.draw_rect(rect, color=(0.3, 0.3, 0.8), fill=(0.9, 0.9, 1))
        pdf_page.insert_text(
            fitz.Point(x + 10, y + height/2 + 5),
            f"🔊 {audio_file.filename}",
            fontsize=12,
            color=(0.2, 0.2, 0.6)
        )

        output_path = generate_output_path("with_audio.pdf")
        save_compatible_pdf(pdf, output_path, title="PDF with Audio")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="with_audio.pdf",
            media_type="application/pdf"
        )

    finally:
        pdf_path.unlink(missing_ok=True)
        audio_path.unlink(missing_ok=True)


# ============ 嵌入 YouTube 連結 ============
@router.post("/embed-youtube")
async def embed_youtube(
    pdf_file: UploadFile = File(...),
    youtube_url: str = Form(..., description="YouTube 影片網址"),
    page: int = Form(1),
    x: float = Form(100),
    y: float = Form(100),
    width: float = Form(400),
    height: float = Form(300)
):
    """
    在 PDF 中嵌入 YouTube 連結

    點擊後會在瀏覽器開啟影片
    """
    pdf_path = await save_upload_file(pdf_file, "multimedia")

    try:
        pdf = fitz.open(pdf_path)

        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=400, detail="無效的頁碼")

        pdf_page = pdf[page - 1]
        rect = fitz.Rect(x, y, x + width, y + height)

        # 繪製 YouTube 風格的預覽框
        pdf_page.draw_rect(rect, color=(0.8, 0.1, 0.1), fill=(0.1, 0.1, 0.1))

        # 繪製播放按鈕
        center_x = x + width / 2
        center_y = y + height / 2
        button_size = 40

        # 播放按鈕背景（紅色圓形）
        pdf_page.draw_circle(
            fitz.Point(center_x, center_y),
            button_size,
            color=(0.8, 0.1, 0.1),
            fill=(0.9, 0.1, 0.1)
        )

        # 播放符號
        pdf_page.insert_text(
            fitz.Point(center_x - 10, center_y + 10),
            "▶",
            fontsize=30,
            color=(1, 1, 1)
        )

        # YouTube 標誌
        pdf_page.insert_text(
            fitz.Point(x + 10, y + 20),
            "YouTube",
            fontsize=12,
            color=(1, 1, 1)
        )

        # 加入超連結
        link = {
            "kind": fitz.LINK_URI,
            "from": rect,
            "uri": youtube_url
        }
        pdf_page.insert_link(link)

        output_path = generate_output_path("with_youtube.pdf")
        save_compatible_pdf(pdf, output_path, title="PDF with YouTube")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="with_youtube.pdf",
            media_type="application/pdf"
        )

    finally:
        pdf_path.unlink(missing_ok=True)


# ============ 嵌入多個附件 ============
@router.post("/embed-attachments")
async def embed_attachments(
    pdf_file: UploadFile = File(...),
    attachments: List[UploadFile] = File(...)
):
    """
    在 PDF 中嵌入多個檔案附件

    附件會顯示在 PDF 閱讀器的附件面板中
    """
    pdf_path = await save_upload_file(pdf_file, "multimedia")
    attachment_paths = []

    try:
        for att in attachments:
            att_path = await save_upload_file(att, "multimedia")
            attachment_paths.append((att_path, att.filename))

        pdf = fitz.open(pdf_path)

        # 在第一頁加入附件清單說明
        first_page = pdf[0]
        y_pos = first_page.rect.height - 100

        first_page.insert_text(
            fitz.Point(20, y_pos),
            "📎 本文件包含以下附件：",
            fontsize=10,
            color=(0.3, 0.3, 0.3)
        )

        for i, (att_path, att_name) in enumerate(attachment_paths):
            with open(att_path, "rb") as f:
                att_data = f.read()

            # 嵌入附件到 PDF
            pdf.embfile_add(
                name=att_name,
                buffer=att_data,
                filename=att_name,
                desc=f"附件 {i + 1}: {att_name}"
            )

            # 在頁面上顯示附件名稱
            first_page.insert_text(
                fitz.Point(30, y_pos + 15 + i * 12),
                f"• {att_name}",
                fontsize=8,
                color=(0.4, 0.4, 0.4)
            )

        output_path = generate_output_path("with_attachments.pdf")
        save_compatible_pdf(pdf, output_path, title="PDF with Attachments")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="with_attachments.pdf",
            media_type="application/pdf"
        )

    finally:
        pdf_path.unlink(missing_ok=True)
        for att_path, _ in attachment_paths:
            att_path.unlink(missing_ok=True)


# ============ 提取附件 ============
@router.post("/extract-attachments")
async def extract_attachments(pdf_file: UploadFile = File(...)):
    """
    提取 PDF 中的所有附件
    """
    import zipfile

    pdf_path = await save_upload_file(pdf_file, "multimedia")

    try:
        pdf = fitz.open(pdf_path)

        # 取得所有嵌入檔案
        embfile_count = pdf.embfile_count()

        if embfile_count == 0:
            return {"success": False, "message": "此 PDF 沒有嵌入的附件"}

        # 建立 ZIP
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for i in range(embfile_count):
                embfile_info = pdf.embfile_info(i)
                embfile_data = pdf.embfile_get(i)

                filename = embfile_info.get("name", f"attachment_{i}")
                zip_file.writestr(filename, embfile_data)

        pdf.close()
        zip_buffer.seek(0)

        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=attachments.zip"}
        )

    finally:
        pdf_path.unlink(missing_ok=True)
