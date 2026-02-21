"""
Gemini Vision OCR - 使用 Gemini API 進行 OCR 文字辨識
比 PaddleOCR 更準確，特別是對中文和混合語言
"""
import base64
import logging
from pathlib import Path
from typing import List, Dict, Tuple
import google.generativeai as genai

logger = logging.getLogger(__name__)

# 設定 Gemini API - BYOK 模式
_last_configured_key = None

def configure_gemini(api_key: str = None):
    """設定 Gemini API - BYOK 模式"""
    global _last_configured_key

    if not api_key:
        raise ValueError("⚠️ 請提供您的 Gemini API Key 才能使用 OCR 功能")

    # 只在 key 變更時重新設定
    if api_key != _last_configured_key:
        genai.configure(api_key=api_key)
        _last_configured_key = api_key


def image_to_base64(image_path: Path) -> str:
    """將圖片轉為 base64"""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def get_mime_type(image_path: Path) -> str:
    """根據副檔名取得 MIME type"""
    ext = image_path.suffix.lower()
    mime_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp"
    }
    return mime_map.get(ext, "image/png")


def ocr_image(image_path: Path, lang: str = "ch", api_key: str = None) -> Tuple[str, List[Dict]]:
    """
    使用 Gemini Vision 進行 OCR - BYOK 模式

    Args:
        image_path: 圖片路徑
        lang: 語言提示（ch=中文, en=英文, japan=日文）
        api_key: 用戶的 Gemini API Key

    Returns:
        (文字內容, 詳細資訊列表)
    """
    configure_gemini(api_key)

    # 讀取圖片
    image_data = image_to_base64(image_path)
    mime_type = get_mime_type(image_path)

    # 語言提示
    lang_hints = {
        "ch": "中文（繁體或簡體）",
        "en": "English",
        "ch+en": "中英混合（Chinese and English mixed）",
        "japan": "日本語",
        "korean": "한국어"
    }
    lang_hint = lang_hints.get(lang, "中文")

    # 建立 prompt
    prompt = f"""請仔細辨識這張圖片中的所有文字內容。

重要指示：
1. 按照圖片中文字的閱讀順序（通常是從上到下、從左到右）輸出
2. 保持原始的段落和換行格式
3. 如果有表格，請嘗試保留表格結構
4. 主要語言應該是 {lang_hint}，但也要辨識其他語言的文字
5. 只輸出辨識到的文字內容，不要加入任何解釋或評論
6. 如果圖片中沒有文字，請回覆「（無文字內容）」

請開始辨識："""

    try:
        # 使用 Gemini 2.0 Flash（快速且便宜）
        model = genai.GenerativeModel("gemini-2.0-flash")

        response = model.generate_content([
            {
                "mime_type": mime_type,
                "data": image_data
            },
            prompt
        ])

        text = response.text.strip()

        # 簡單的詳細資訊（Gemini 不提供座標）
        details = [{
            "text": text,
            "confidence": 0.95,  # Gemini 通常很準確
            "source": "gemini-vision"
        }]

        return text, details

    except Exception as e:
        logger.error(f"Gemini OCR 失敗: {e}")
        raise


def ocr_image_with_boxes(image_path: Path, lang: str = "ch", api_key: str = None) -> Tuple[str, List[Dict]]:
    """
    使用 Gemini Vision 進行 OCR，嘗試取得文字區塊位置 - BYOK 模式

    注意：Gemini 的座標資訊不如專門的 OCR 引擎精確，
    這個函數主要用於需要大致位置資訊的場景
    """
    configure_gemini(api_key)

    image_data = image_to_base64(image_path)
    mime_type = get_mime_type(image_path)

    prompt = """請辨識這張圖片中的所有文字，並以 JSON 格式輸出。

格式要求：
```json
{
  "blocks": [
    {
      "text": "辨識到的文字",
      "position": "top-left" | "top-center" | "top-right" | "middle-left" | "middle-center" | "middle-right" | "bottom-left" | "bottom-center" | "bottom-right"
    }
  ],
  "full_text": "所有文字的完整內容，保持原始格式"
}
```

請直接輸出 JSON，不要加入其他說明。"""

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")

        response = model.generate_content([
            {
                "mime_type": mime_type,
                "data": image_data
            },
            prompt
        ])

        text = response.text.strip()

        # 嘗試解析 JSON
        import json
        # 移除可能的 markdown 標記
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        try:
            data = json.loads(text)
            full_text = data.get("full_text", "")
            blocks = data.get("blocks", [])

            details = []
            for block in blocks:
                details.append({
                    "text": block.get("text", ""),
                    "position": block.get("position", "unknown"),
                    "confidence": 0.9,
                    "source": "gemini-vision"
                })

            return full_text, details

        except json.JSONDecodeError:
            # 如果 JSON 解析失敗，回退到簡單模式
            return ocr_image(image_path, lang, api_key)

    except Exception as e:
        logger.error(f"Gemini OCR with boxes 失敗: {e}")
        raise


def is_gemini_available(api_key: str = None) -> bool:
    """檢查 Gemini API 是否可用 - BYOK 模式，需要用戶提供 API Key"""
    return bool(api_key)


# 匯出
__all__ = [
    'ocr_image',
    'ocr_image_with_boxes',
    'is_gemini_available',
    'configure_gemini'
]
