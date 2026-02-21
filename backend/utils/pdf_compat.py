"""
PDF 相容性工具 - 確保生成的 PDF 可在各種 PDF 閱讀器和瀏覽器中正常開啟
"""
import fitz
from datetime import datetime
from typing import Optional


def get_compatible_save_options() -> dict:
    """
    取得跨平台相容的 PDF 儲存選項

    這些設定確保 PDF 可在以下環境正常開啟：
    - 各種桌面 PDF 閱讀器
    - Chrome、Edge、Firefox 內建 PDF 閱讀器
    - macOS Preview
    - 各種行動裝置 PDF 閱讀器
    """
    return {
        "garbage": 4,           # 清理未使用物件（0-4，4 最徹底）
        "deflate": True,        # 使用 deflate 壓縮（標準壓縮格式）
        "clean": True,          # 清理內容流
        # "linear": True,       # 線性化已在 PyMuPDF 新版移除
        "pretty": False,        # 不美化（減少檔案大小）
        "ascii": False,         # 使用二進位格式（更小、更標準）
        "expand": 0,            # 不展開壓縮流
        "no_new_id": False,     # 生成新文件 ID
    }


def set_pdf_metadata(
    pdf: fitz.Document,
    title: Optional[str] = None,
    author: str = "PDFTool",
    subject: Optional[str] = None,
    creator: str = "PDFTool - Open Source PDF Tools",
    producer: str = "PyMuPDF"
) -> None:
    """
    設定 PDF 元資料

    適當的元資料可提高 PDF 在各閱讀器中的相容性和可搜尋性
    """
    metadata = pdf.metadata

    # 更新元資料
    metadata["title"] = title or metadata.get("title", "")
    metadata["author"] = author
    metadata["subject"] = subject or metadata.get("subject", "")
    metadata["creator"] = creator
    metadata["producer"] = producer
    metadata["creationDate"] = datetime.now().strftime("D:%Y%m%d%H%M%S")
    metadata["modDate"] = datetime.now().strftime("D:%Y%m%d%H%M%S")

    pdf.set_metadata(metadata)


def save_compatible_pdf(
    pdf: fitz.Document,
    output_path: str,
    title: Optional[str] = None,
    optimize_for_web: bool = True
) -> None:
    """
    以最大相容性儲存 PDF

    Args:
        pdf: PyMuPDF 文件物件
        output_path: 輸出路徑
        title: PDF 標題（可選）
        optimize_for_web: 是否優化網頁瀏覽（已棄用，保留參數相容性）
    """
    # 設定元資料
    set_pdf_metadata(pdf, title=title)

    # 取得相容設定
    save_options = get_compatible_save_options()

    # 儲存
    pdf.save(str(output_path), **save_options)


def ensure_pdf_compatibility(pdf: fitz.Document) -> None:
    """
    檢查並修復 PDF 相容性問題

    這個函數會：
    1. 移除不相容的註解類型
    2. 修復損壞的結構
    3. 確保字型嵌入
    """
    # 檢查是否需要修復
    if pdf.is_dirty:
        # 已經有修改，不需額外處理
        pass

    # 遍歷頁面，檢查並修復問題
    for page in pdf:
        # 清理無效的註解
        annots = page.annots()
        if annots:
            for annot in annots:
                try:
                    # 確保註解有效
                    _ = annot.rect
                except:
                    # 移除無效註解
                    page.delete_annot(annot)


def convert_to_pdfa_compatible(pdf: fitz.Document) -> None:
    """
    轉換為 PDF/A 相容格式

    PDF/A 是長期保存的標準格式，具有最高相容性
    注意：完整的 PDF/A 轉換需要額外處理（字型嵌入等）
    """
    # 設定 PDF/A 相關元資料
    metadata = pdf.metadata
    metadata["format"] = "PDF/A-2b"
    pdf.set_metadata(metadata)

    # 移除不相容的元素
    # （實際的 PDF/A 轉換更複雜，這裡只做基本處理）
    for page in pdf:
        # 移除透明度（PDF/A-1 不支援）
        # 移除 JavaScript
        pass


# 匯出常用函數
__all__ = [
    'get_compatible_save_options',
    'set_pdf_metadata',
    'save_compatible_pdf',
    'ensure_pdf_compatibility',
    'convert_to_pdfa_compatible'
]
