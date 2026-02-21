"""
AI 助手 API - 使用 Gemini 分析 PDF
"""
import fitz
import base64
import os
import json
import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel

from utils.file_handler import save_upload_file

router = APIRouter()

# Gemini API 設定
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


class AIQuery(BaseModel):
    question: str
    context: Optional[str] = None


# ============ 提取 PDF 內容 ============
def extract_pdf_content(file_path, max_pages: int = 20) -> dict:
    """提取 PDF 的文字和圖片內容"""
    pdf = fitz.open(file_path)

    content = {
        "page_count": len(pdf),
        "metadata": pdf.metadata,
        "pages": []
    }

    for i, page in enumerate(pdf):
        if i >= max_pages:
            break

        page_content = {
            "page_number": i + 1,
            "text": page.get_text(),
            "images": []
        }

        # 提取圖片（轉為 base64）
        image_list = page.get_images(full=True)
        for img_index, img in enumerate(image_list[:5]):  # 最多 5 張圖
            xref = img[0]
            try:
                base_image = pdf.extract_image(xref)
                if base_image:
                    image_bytes = base_image["image"]
                    image_b64 = base64.b64encode(image_bytes).decode()
                    page_content["images"].append({
                        "index": img_index,
                        "format": base_image["ext"],
                        "base64": image_b64[:1000] + "..." if len(image_b64) > 1000 else image_b64
                    })
            except:
                pass

        content["pages"].append(page_content)

    pdf.close()
    return content


# ============ 呼叫 Gemini API ============
async def call_gemini(prompt: str, pdf_content: dict, api_key: str = None) -> str:
    """呼叫 Gemini API 進行分析"""
    # 優先使用用戶提供的 API Key，否則使用環境變數
    effective_api_key = api_key or GEMINI_API_KEY

    if not effective_api_key:
        raise HTTPException(
            status_code=400,
            detail="請先設定 Gemini API Key。您可以在設定中輸入自己的 API Key。"
        )

    # 建立完整提示
    full_prompt = f"""你是一個專業的 PDF 文件分析助手。以下是 PDF 文件的內容：

文件資訊：
- 頁數：{pdf_content['page_count']}
- 標題：{pdf_content['metadata'].get('title', '未知')}
- 作者：{pdf_content['metadata'].get('author', '未知')}

文件內容：
"""

    for page in pdf_content["pages"]:
        full_prompt += f"\n=== 第 {page['page_number']} 頁 ===\n"
        full_prompt += page["text"][:3000]  # 限制每頁文字長度

    full_prompt += f"\n\n用戶問題：{prompt}\n\n請用繁體中文回答。"

    # 呼叫 API
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{GEMINI_API_URL}?key={effective_api_key}",
            json={
                "contents": [{
                    "parts": [{"text": full_prompt}]
                }],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 2048,
                }
            }
        )

        if response.status_code != 200:
            # 提供友善的錯誤訊息
            if response.status_code == 400:
                detail = "API Key 無效，請確認您的 Gemini API Key 是否正確。"
            elif response.status_code == 403:
                detail = "API Key 權限不足或已被停用，請檢查您的 Google AI Studio 設定。"
            elif response.status_code == 429:
                detail = "AI 服務暫時繁忙，請稍等幾分鐘後再試。"
            elif response.status_code == 500:
                detail = "AI 服務暫時無法使用，請稍後再試。"
            else:
                detail = f"AI 服務發生錯誤（{response.status_code}），請稍後再試。"

            raise HTTPException(
                status_code=response.status_code,
                detail=detail
            )

        result = response.json()

        try:
            return result["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise HTTPException(status_code=500, detail="無法解析 Gemini 回應")


# ============ AI 分析 PDF ============
@router.post("/analyze")
async def analyze_pdf(
    file: UploadFile = File(...),
    question: str = Form("請總結這份文件的主要內容"),
    api_key: str = Form(None, description="用戶的 Gemini API Key")
):
    """
    使用 AI 分析 PDF 內容

    - 上傳 PDF
    - 輸入問題
    - 回傳 AI 分析結果
    """
    file_path = await save_upload_file(file, "ai")

    try:
        # 提取 PDF 內容
        pdf_content = extract_pdf_content(file_path)

        # 呼叫 AI（傳入用戶的 API Key）
        answer = await call_gemini(question, pdf_content, api_key)

        return {
            "success": True,
            "question": question,
            "answer": answer,
            "document_info": {
                "page_count": pdf_content["page_count"],
                "title": pdf_content["metadata"].get("title", ""),
                "author": pdf_content["metadata"].get("author", ""),
            }
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ AI 摘要 ============
@router.post("/summarize")
async def summarize_pdf(
    file: UploadFile = File(...),
    api_key: str = Form(None, description="用戶的 Gemini API Key")
):
    """
    自動產生 PDF 摘要
    """
    return await analyze_pdf(
        file=file,
        question="請用繁體中文總結這份文件的主要內容，包括：1. 文件類型 2. 主要主題 3. 關鍵要點（條列式）4. 結論或建議",
        api_key=api_key
    )


# ============ AI 問答 ============
@router.post("/chat")
async def chat_with_pdf(
    file: UploadFile = File(...),
    messages: str = Form(..., description="JSON 格式的對話紀錄"),
    api_key: str = Form(None, description="用戶的 Gemini API Key")
):
    """
    與 PDF 進行對話式問答
    """
    file_path = await save_upload_file(file, "ai")

    try:
        # 解析對話紀錄
        try:
            chat_history = json.loads(messages)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="無效的對話格式")

        # 提取 PDF 內容
        pdf_content = extract_pdf_content(file_path)

        # 建立對話提示
        conversation = "\n".join([
            f"{'用戶' if msg['role'] == 'user' else 'AI'}：{msg['content']}"
            for msg in chat_history
        ])

        prompt = f"以下是與用戶的對話紀錄：\n{conversation}\n\n請根據 PDF 內容回答最後一個問題。"

        # 呼叫 AI（傳入用戶的 API Key）
        answer = await call_gemini(prompt, pdf_content, api_key)

        return {
            "success": True,
            "answer": answer
        }

    finally:
        file_path.unlink(missing_ok=True)


# ============ AI 翻譯 ============
# 語言代碼對照表（前端傳送語言代碼，轉換為中文描述）
LANGUAGE_MAP = {
    "zh-TW": "繁體中文",
    "zh-CN": "簡體中文",
    "en": "英文",
    "ja": "日文",
    "ko": "韓文",
}


@router.post("/translate")
async def translate_pdf(
    file: UploadFile = File(...),
    target_lang: str = Form("zh-TW", description="目標語言代碼：zh-TW, zh-CN, en, ja, ko"),
    api_key: str = Form(None, description="用戶的 Gemini API Key")
):
    """
    使用 AI 翻譯 PDF 內容
    """
    # 將語言代碼轉換為中文描述
    target_language = LANGUAGE_MAP.get(target_lang, target_lang)

    return await analyze_pdf(
        file=file,
        question=f"請將這份文件的主要內容翻譯成{target_language}，保持原文的格式和結構。",
        api_key=api_key
    )


# ============ AI 提取資訊 ============
@router.post("/extract-info")
async def extract_info(
    file: UploadFile = File(...),
    info_type: str = Form("all", description="要提取的資訊類型：all, contacts, dates, numbers, tables"),
    api_key: str = Form(None, description="用戶的 Gemini API Key")
):
    """
    使用 AI 提取特定類型的資訊
    """
    prompts = {
        "all": "請從這份文件中提取所有重要資訊，包括聯絡方式、日期、金額、表格資料等。",
        "contacts": "請從這份文件中提取所有聯絡資訊（姓名、電話、Email、地址）。",
        "dates": "請從這份文件中提取所有日期和時間相關資訊。",
        "numbers": "請從這份文件中提取所有數字、金額、統計資料。",
        "tables": "請從這份文件中提取所有表格資料，並以結構化方式呈現。"
    }

    question = prompts.get(info_type, prompts["all"])

    return await analyze_pdf(file=file, question=question, api_key=api_key)
