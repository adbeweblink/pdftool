"""
批次資料提取 API - 表單欄位提取、名片 OCR
"""
import fitz
import json
import csv
import io
import os
import base64
import httpx
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse, JSONResponse
from typing import List, Optional
from pydantic import BaseModel

from utils.file_handler import save_upload_file, generate_output_path

router = APIRouter()

# Gemini API 設定
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# 延遲載入 PaddleOCR
_ocr_engine = None

def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        from paddleocr import PaddleOCR
        _ocr_engine = PaddleOCR(
            use_angle_cls=True,
            lang='ch',
            use_gpu=False,
            show_log=False
        )
    return _ocr_engine


# ============ 資料模型 ============
class FieldMapping(BaseModel):
    """欄位對應設定"""
    source_field: str  # 原始欄位名稱
    target_field: str  # 輸出欄位名稱
    include: bool = True  # 是否包含


class BusinessCardData(BaseModel):
    """名片資料結構"""
    name: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    raw_text: Optional[str] = None


# ============ 輔助函數 ============
async def call_gemini_for_extraction(text: str, prompt: str) -> dict:
    """呼叫 Gemini API 進行智能提取"""
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="AI 服務未設定。請聯繫管理員設定 GEMINI_API_KEY。"
        )

    full_prompt = f"""{prompt}

以下是要分析的文字內容：
---
{text}
---

請以 JSON 格式回傳結果。只回傳 JSON，不要其他文字。"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                json={
                    "contents": [{"parts": [{"text": full_prompt}]}],
                    "generationConfig": {
                        "temperature": 0.1,
                        "maxOutputTokens": 4096,
                    }
                }
            )

            if response.status_code == 429:
                raise HTTPException(
                    status_code=503,
                    detail="AI 服務暫時繁忙，請稍等幾分鐘後再試。"
                )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=500,
                    detail="AI 服務暫時無法使用，請稍後再試。"
                )

            result = response.json()
            text_result = result["candidates"][0]["content"]["parts"][0]["text"]

            # 清理 JSON（移除 markdown 標記）
            text_result = text_result.strip()
            if text_result.startswith("```json"):
                text_result = text_result[7:]
            if text_result.startswith("```"):
                text_result = text_result[3:]
            if text_result.endswith("```"):
                text_result = text_result[:-3]

            return json.loads(text_result.strip())

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="AI 回應格式錯誤，請重試。"
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="AI 服務回應超時，請稍後再試。"
        )


def extract_text_from_pdf(file_path: Path) -> str:
    """從 PDF 提取文字"""
    pdf = fitz.open(file_path)
    all_text = []

    for page in pdf:
        text = page.get_text()
        if text.strip():
            all_text.append(text)

    pdf.close()
    return "\n".join(all_text)


def extract_text_with_ocr(file_path: Path) -> str:
    """使用 OCR 從 PDF 或圖片提取文字"""
    ocr = get_ocr_engine()
    ext = file_path.suffix.lower()
    all_text = []

    if ext == ".pdf":
        pdf = fitz.open(file_path)
        for i, page in enumerate(pdf):
            # 高解析度渲染
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat)
            img_path = file_path.with_suffix(f".page{i}.png")
            pix.save(str(img_path))

            # OCR
            result = ocr.ocr(str(img_path), cls=True)
            if result and result[0]:
                for line in result[0]:
                    all_text.append(line[1][0])

            img_path.unlink(missing_ok=True)
        pdf.close()
    else:
        # 直接 OCR 圖片
        result = ocr.ocr(str(file_path), cls=True)
        if result and result[0]:
            for line in result[0]:
                all_text.append(line[1][0])

    return "\n".join(all_text)


# ============ 分析表單欄位結構 ============
@router.post("/analyze-form")
async def analyze_form_structure(
    file: UploadFile = File(...),
    use_ocr: bool = Form(False, description="是否使用 OCR（掃描檔需要）")
):
    """
    分析 PDF 表單結構，辨識所有欄位

    回傳可提取的欄位清單，供用戶選擇
    """
    file_path = await save_upload_file(file, "batch")

    try:
        # 提取文字
        if use_ocr:
            text = extract_text_with_ocr(file_path)
        else:
            text = extract_text_from_pdf(file_path)
            # 如果沒有提取到文字，自動使用 OCR
            if not text.strip():
                text = extract_text_with_ocr(file_path)

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="無法從文件中提取文字。請確認文件內容是否正確。"
            )

        # 使用 AI 分析欄位結構
        prompt = """請分析這份文件的表單結構，找出所有可提取的欄位。

請辨識：
1. 表單欄位名稱（如：姓名、地址、電話、日期等）
2. 欄位的資料類型（文字、數字、日期等）
3. 欄位是否有值

回傳格式：
{
    "form_type": "表單類型描述",
    "fields": [
        {
            "field_name": "欄位名稱",
            "field_type": "text/number/date/email/phone",
            "sample_value": "範例值（如有）",
            "description": "欄位說明"
        }
    ],
    "total_fields": 欄位數量
}"""

        result = await call_gemini_for_extraction(text, prompt)
        result["raw_text_preview"] = text[:500] + "..." if len(text) > 500 else text

        return {
            "success": True,
            "analysis": result
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ 批次提取表單資料 ============
@router.post("/extract-batch")
async def extract_batch_form_data(
    files: List[UploadFile] = File(...),
    fields: str = Form(..., description="要提取的欄位（逗號分隔或 JSON 陣列）"),
    use_ocr: bool = Form(False, description="是否使用 OCR")
):
    """
    批次從多個 PDF 提取指定欄位的資料

    fields 格式: "欄位1,欄位2,欄位3" 或 ["欄位1", "欄位2", "欄位3"]

    回傳 CSV 檔案
    """
    # 支援逗號分隔或 JSON 陣列兩種格式
    try:
        field_list = json.loads(fields)
    except json.JSONDecodeError:
        # 如果不是 JSON，嘗試解析逗號分隔格式
        field_list = [f.strip() for f in fields.split(",") if f.strip()]

    if not isinstance(field_list, list):
        raise HTTPException(status_code=400, detail="欄位格式錯誤")

    if not field_list:
        raise HTTPException(status_code=400, detail="請至少選擇一個欄位")

    if len(files) > 100:
        raise HTTPException(status_code=400, detail="單次最多處理 100 個檔案")

    all_data = []
    errors = []

    for file in files:
        file_path = await save_upload_file(file, "batch")

        try:
            # 提取文字
            if use_ocr:
                text = extract_text_with_ocr(file_path)
            else:
                text = extract_text_from_pdf(file_path)
                if not text.strip():
                    text = extract_text_with_ocr(file_path)

            if not text.strip():
                errors.append({
                    "filename": file.filename,
                    "error": "無法提取文字內容"
                })
                continue

            # 使用 AI 提取指定欄位
            fields_str = "、".join(field_list)
            prompt = f"""請從這份文件中提取以下欄位的值：
{fields_str}

回傳格式（必須包含所有欄位，沒有值的填 null）：
{{
    "欄位1": "值",
    "欄位2": "值",
    ...
}}

只回傳 JSON，不要其他文字。"""

            result = await call_gemini_for_extraction(text, prompt)
            result["_filename"] = file.filename
            all_data.append(result)

        except HTTPException as e:
            errors.append({
                "filename": file.filename,
                "error": e.detail
            })
        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e)
            })
        finally:
            file_path.unlink(missing_ok=True)

    if not all_data:
        raise HTTPException(
            status_code=400,
            detail=f"所有檔案處理失敗：{errors}"
        )

    # 生成 CSV
    output = io.StringIO()

    # 欄位：檔案名 + 選擇的欄位
    csv_fields = ["檔案名稱"] + field_list
    writer = csv.DictWriter(output, fieldnames=csv_fields)
    writer.writeheader()

    for row in all_data:
        csv_row = {"檔案名稱": row.get("_filename", "")}
        for field in field_list:
            csv_row[field] = row.get(field, "")
        writer.writerow(csv_row)

    # 回傳 CSV
    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),  # BOM for Excel
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=extracted_data.csv"
        }
    )


# ============ 名片 OCR ============
@router.post("/business-card")
async def extract_business_card(
    file: UploadFile = File(...)
):
    """
    從名片圖片提取聯絡資訊

    支援 JPG、PNG 等圖片格式
    """
    file_path = await save_upload_file(file, "batch")

    try:
        # OCR 提取文字
        text = extract_text_with_ocr(file_path)

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="無法辨識名片內容。請確認圖片清晰度。"
            )

        # 使用 AI 結構化名片資訊
        prompt = """這是一張名片的 OCR 結果，請提取其中的聯絡資訊。

請辨識並提取：
- name: 姓名
- company: 公司名稱
- title: 職稱
- phone: 市話（含區碼）
- mobile: 手機
- email: 電子郵件
- address: 地址
- website: 網站
- fax: 傳真（如有）
- line_id: LINE ID（如有）

回傳格式：
{
    "name": "姓名",
    "company": "公司",
    "title": "職稱",
    "phone": "市話",
    "mobile": "手機",
    "email": "email",
    "address": "地址",
    "website": "網站",
    "fax": "傳真",
    "line_id": "LINE ID"
}

沒有的欄位填 null。只回傳 JSON。"""

        result = await call_gemini_for_extraction(text, prompt)
        result["raw_text"] = text

        return {
            "success": True,
            "data": result
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ 批次名片處理 ============
@router.post("/business-cards-batch")
async def extract_business_cards_batch(
    files: List[UploadFile] = File(...)
):
    """
    批次處理多張名片，整理成客戶資料表

    回傳 CSV 檔案
    """
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="單次最多處理 50 張名片")

    all_cards = []
    errors = []

    for file in files:
        file_path = await save_upload_file(file, "batch")

        try:
            text = extract_text_with_ocr(file_path)

            if not text.strip():
                errors.append({
                    "filename": file.filename,
                    "error": "無法辨識內容"
                })
                continue

            prompt = """這是一張名片的 OCR 結果，請提取聯絡資訊。

回傳格式：
{
    "name": "姓名",
    "company": "公司",
    "title": "職稱",
    "phone": "市話",
    "mobile": "手機",
    "email": "email",
    "address": "地址"
}

沒有的欄位填 null。只回傳 JSON。"""

            result = await call_gemini_for_extraction(text, prompt)
            result["_filename"] = file.filename
            all_cards.append(result)

        except HTTPException as e:
            errors.append({
                "filename": file.filename,
                "error": e.detail
            })
        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e)
            })
        finally:
            file_path.unlink(missing_ok=True)

    if not all_cards:
        raise HTTPException(
            status_code=400,
            detail=f"所有名片處理失敗：{errors}"
        )

    # 生成 CSV
    output = io.StringIO()
    csv_fields = ["檔案名稱", "姓名", "公司", "職稱", "市話", "手機", "Email", "地址"]
    field_mapping = {
        "檔案名稱": "_filename",
        "姓名": "name",
        "公司": "company",
        "職稱": "title",
        "市話": "phone",
        "手機": "mobile",
        "Email": "email",
        "地址": "address"
    }

    writer = csv.DictWriter(output, fieldnames=csv_fields)
    writer.writeheader()

    for card in all_cards:
        row = {}
        for csv_field, json_field in field_mapping.items():
            row[csv_field] = card.get(json_field, "") or ""
        writer.writerow(row)

    output.seek(0)

    response_data = {
        "success": True,
        "processed": len(all_cards),
        "errors": len(errors),
        "error_details": errors if errors else None,
        "cards": all_cards
    }

    return response_data


# ============ 批次名片匯出 CSV ============
@router.post("/business-cards-csv")
async def export_business_cards_csv(
    files: List[UploadFile] = File(...)
):
    """
    批次處理名片並直接匯出 CSV
    """
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="單次最多處理 50 張名片")

    all_cards = []

    for file in files:
        file_path = await save_upload_file(file, "batch")

        try:
            text = extract_text_with_ocr(file_path)

            if not text.strip():
                continue

            prompt = """這是一張名片的 OCR 結果，請提取聯絡資訊。

回傳格式：
{
    "name": "姓名",
    "company": "公司",
    "title": "職稱",
    "phone": "市話",
    "mobile": "手機",
    "email": "email",
    "address": "地址"
}

沒有的欄位填 null。只回傳 JSON。"""

            result = await call_gemini_for_extraction(text, prompt)
            result["_filename"] = file.filename
            all_cards.append(result)

        except:
            pass
        finally:
            file_path.unlink(missing_ok=True)

    if not all_cards:
        raise HTTPException(
            status_code=400,
            detail="無法處理任何名片，請確認圖片品質"
        )

    # 生成 CSV
    output = io.StringIO()
    csv_fields = ["檔案名稱", "姓名", "公司", "職稱", "市話", "手機", "Email", "地址"]
    field_mapping = {
        "檔案名稱": "_filename",
        "姓名": "name",
        "公司": "company",
        "職稱": "title",
        "市話": "phone",
        "手機": "mobile",
        "Email": "email",
        "地址": "address"
    }

    writer = csv.DictWriter(output, fieldnames=csv_fields)
    writer.writeheader()

    for card in all_cards:
        row = {}
        for csv_field, json_field in field_mapping.items():
            row[csv_field] = card.get(json_field, "") or ""
        writer.writerow(row)

    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=business_cards.csv"
        }
    )
