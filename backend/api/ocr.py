"""
OCR API - 文字辨識
優先使用 Gemini Vision（更準確），回退到 PaddleOCR
"""
import fitz  # PyMuPDF
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import Optional, Tuple, List, Dict
import logging

from utils.file_handler import save_upload_file, generate_output_path
from utils.pdf_compat import save_compatible_pdf
from utils.gemini_ocr import ocr_image as gemini_ocr, is_gemini_available
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# 檢查 Gemini 可用性
_use_gemini = None

def should_use_gemini() -> bool:
    """檢查是否應該使用 Gemini OCR"""
    global _use_gemini
    if _use_gemini is None:
        _use_gemini = is_gemini_available()
        if _use_gemini:
            logger.info("Gemini OCR 可用，將優先使用")
        else:
            logger.info("Gemini API Key 未設定，將使用 PaddleOCR")
    return _use_gemini


# 延遲載入 PaddleOCR（較慢，作為備用）
_paddle_ocr = None

def get_paddle_ocr():
    """取得 PaddleOCR 引擎（備用方案）"""
    global _paddle_ocr
    if _paddle_ocr is None:
        try:
            from paddleocr import PaddleOCR
            _paddle_ocr = PaddleOCR(
                use_angle_cls=True,
                lang='ch',
                use_gpu=False,
                show_log=False
            )
        except ImportError:
            logger.warning("PaddleOCR 未安裝，OCR 功能需要 Gemini API")
            return None
    return _paddle_ocr


def do_ocr(image_path: Path, lang: str = "ch") -> Tuple[str, List[Dict]]:
    """
    執行 OCR，優先使用 Gemini，回退到 PaddleOCR

    Returns:
        (text, details_list)
    """
    # 優先使用 Gemini
    if should_use_gemini():
        try:
            text, details = gemini_ocr(image_path, lang)
            return text, details
        except Exception as e:
            logger.warning(f"Gemini OCR 失敗，嘗試 PaddleOCR: {e}")

    # 回退到 PaddleOCR
    paddle = get_paddle_ocr()
    if paddle is None:
        raise HTTPException(
            status_code=500,
            detail="OCR 服務不可用。請設定 GEMINI_API_KEY 環境變數，或安裝 PaddleOCR"
        )

    result = paddle.ocr(str(image_path), cls=True)
    texts = []
    details = []

    if result and result[0]:
        for line in result[0]:
            box = line[0]
            text = line[1][0]
            confidence = line[1][1]
            texts.append(text)
            details.append({
                "text": text,
                "confidence": round(confidence, 3),
                "box": box,
                "source": "paddleocr"
            })

    return "\n".join(texts), details


# ============ OCR 文字辨識 ============
@router.post("/recognize")
async def ocr_recognize(
    file: UploadFile = File(...),
    lang: str = Form("ch", description="語言：ch (中文), en (英文), japan (日文)")
):
    """
    OCR 文字辨識

    - 支援 PDF 或圖片
    - 優先使用 Gemini Vision，回退到 PaddleOCR
    - 回傳辨識的文字內容
    """
    file_path = await save_upload_file(file, "ocr")

    try:
        ext = file_path.suffix.lower()
        all_text = []

        if ext == ".pdf":
            # PDF：先轉圖片再 OCR
            pdf = fitz.open(file_path)
            for i, page in enumerate(pdf):
                # 高解析度渲染
                mat = fitz.Matrix(2.0, 2.0)  # 2x 放大
                pix = page.get_pixmap(matrix=mat)

                # 轉為圖片
                img_path = file_path.with_suffix(f".page{i}.png")
                pix.save(str(img_path))

                try:
                    # OCR
                    text, _ = do_ocr(img_path, lang)
                    if text:
                        all_text.append(f"=== Page {i+1} ===\n{text}")
                finally:
                    # 清理暫存圖片
                    img_path.unlink(missing_ok=True)

            pdf.close()
        else:
            # 圖片：直接 OCR
            text, _ = do_ocr(file_path, lang)
            if text:
                all_text.append(text)

        return {
            "success": True,
            "text": "\n\n".join(all_text) if all_text else "",
            "page_count": len(all_text) if ext == ".pdf" else 1,
            "engine": "gemini" if should_use_gemini() else "paddleocr"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR 失敗: {e}")
        raise HTTPException(status_code=500, detail=f"OCR 處理失敗：{str(e)}")
    finally:
        file_path.unlink(missing_ok=True)


# ============ PDF 轉可搜尋 PDF ============
@router.post("/make-searchable")
async def make_searchable_pdf(
    file: UploadFile = File(...),
    lang: str = Form("ch")
):
    """
    將掃描版 PDF 轉為可搜尋 PDF

    - OCR 辨識文字
    - 將文字層疊加到 PDF 上
    - 保持原始外觀
    """
    file_path = await save_upload_file(file, "ocr")

    try:
        pdf = fitz.open(file_path)
        output_path = generate_output_path("searchable.pdf")

        for i, page in enumerate(pdf):
            # 渲染頁面為圖片
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat)
            img_path = file_path.with_suffix(f".page{i}.png")
            pix.save(str(img_path))

            try:
                # OCR
                text, details = do_ocr(img_path, lang)

                if text:
                    # 對於 Gemini OCR，我們沒有精確座標，所以在頁面中央添加隱形文字
                    # 這樣文字仍然可以被搜尋到
                    page_rect = page.rect

                    # 添加隱形文字層（用於搜尋）
                    page.insert_textbox(
                        page_rect,
                        text,
                        fontsize=1,  # 極小字體
                        color=(1, 1, 1),  # 白色（隱形）
                        fill_opacity=0,
                        render_mode=3  # 隱形
                    )

            finally:
                img_path.unlink(missing_ok=True)

        save_compatible_pdf(pdf, output_path, title="Searchable PDF")
        pdf.close()

        return FileResponse(
            path=output_path,
            filename="searchable.pdf",
            media_type="application/pdf"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"建立可搜尋 PDF 失敗: {e}")
        raise HTTPException(status_code=500, detail=f"處理失敗：{str(e)}")
    finally:
        file_path.unlink(missing_ok=True)


# ============ 圖片 OCR ============
@router.post("/image-to-text")
async def image_to_text(
    file: UploadFile = File(...),
    lang: str = Form("ch")
):
    """
    圖片文字辨識

    - 支援 JPG, PNG 等圖片格式
    - 回傳辨識的文字
    """
    file_path = await save_upload_file(file, "ocr")

    try:
        text, details = do_ocr(file_path, lang)

        return {
            "success": True,
            "text": text,
            "details": details,
            "engine": "gemini" if should_use_gemini() else "paddleocr"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"圖片 OCR 失敗: {e}")
        raise HTTPException(status_code=500, detail=f"OCR 處理失敗：{str(e)}")
    finally:
        file_path.unlink(missing_ok=True)
